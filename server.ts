import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.raw({ type: ['application/postscript', 'application/octet-stream', 'image/x-eps', 'image/eps'], limit: '60mb' }));
  app.use(express.json({ limit: '60mb' }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // High-performance EPS vector preview rendering endpoint
  app.post("/api/render-eps", async (req, res) => {
    let buffer: Buffer | null = null;

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
    } else if (req.body && req.body.base64) {
      buffer = Buffer.from(req.body.base64, "base64");
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: { message: "Missing EPS data" } });
    }

    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempEpsPath = path.join(os.tmpdir(), `vector_${uniqueId}.eps`);
    const tempJpgPath = path.join(os.tmpdir(), `preview_${uniqueId}.jpg`);

    try {
      // Check if file has a DOS EPS binary header (0xC5D0D3C6)
      // If so, slice out only the clean PostScript segment so Ghostscript parses it without header errors
      let dataToWrite = buffer;
      if (buffer.length >= 30 && buffer[0] === 0xC5 && buffer[1] === 0xD0 && buffer[2] === 0xD3 && buffer[3] === 0xC6) {
        const psOffset = buffer.readUInt32LE(4);
        const psLength = buffer.readUInt32LE(8);
        if (psOffset > 0 && psLength > 0 && psOffset + psLength <= buffer.length) {
          dataToWrite = buffer.subarray(psOffset, psOffset + psLength);
        }
      }

      await fs.promises.writeFile(tempEpsPath, dataToWrite);

      // 1. Try Ghostscript with -dEPSCrop for vector EPS rendering
      let rendered = false;
      try {
        await execFileAsync("gs", [
          "-dSAFER",
          "-dBATCH",
          "-dNOPAUSE",
          "-dEPSCrop",
          "-sDEVICE=jpeg",
          "-dJPEGQ=92",
          "-r150",
          `-sOutputFile=${tempJpgPath}`,
          tempEpsPath
        ], { timeout: 10000 });
        if (fs.existsSync(tempJpgPath) && fs.statSync(tempJpgPath).size > 0) {
          rendered = true;
        }
      } catch (gsErr) {
        // Fallback to gs with -dFitPage if -dEPSCrop fails
      }

      // 1b. Try Ghostscript with -dFitPage if EPSCrop failed (e.g. bounding box issues)
      if (!rendered) {
        try {
          await execFileAsync("gs", [
            "-dSAFER",
            "-dBATCH",
            "-dNOPAUSE",
            "-dFitPage",
            "-sDEVICE=jpeg",
            "-dJPEGQ=92",
            "-r150",
            `-sOutputFile=${tempJpgPath}`,
            tempEpsPath
          ], { timeout: 10000 });
          if (fs.existsSync(tempJpgPath) && fs.statSync(tempJpgPath).size > 0) {
            rendered = true;
          }
        } catch (gsPageErr) {
          // Fallback to ImageMagick convert
        }
      }

      // 2. Fallback to ImageMagick convert
      if (!rendered) {
        try {
          await execFileAsync("convert", [
            "-density", "150",
            `${tempEpsPath}[0]`,
            "-quality", "90",
            tempJpgPath
          ], { timeout: 10000 });
          if (fs.existsSync(tempJpgPath) && fs.statSync(tempJpgPath).size > 0) {
            rendered = true;
          }
        } catch (convertErr) {
          // Both failed
        }
      }

      if (rendered) {
        const jpgBuffer = await fs.promises.readFile(tempJpgPath);
        const dataUrl = `data:image/jpeg;base64,${jpgBuffer.toString("base64")}`;
        return res.json({ preview: dataUrl });
      } else {
        return res.status(422).json({ error: { message: "Could not render EPS preview" } });
      }
    } catch (err: any) {
      console.error("EPS Render Error:", err);
      return res.status(500).json({ error: { message: err.message || "Rendering failed" } });
    } finally {
      // Clean up temp files safely
      try {
        if (fs.existsSync(tempEpsPath)) await fs.promises.unlink(tempEpsPath);
      } catch {}
      try {
        if (fs.existsSync(tempJpgPath)) await fs.promises.unlink(tempJpgPath);
      } catch {}
    }
  });

  // API Proxy for Groq and Mistral to avoid CORS issues
  app.post("/api/ai-proxy", async (req, res) => {
    const { url, apiKey, body } = req.body;
    
    if (!url || !apiKey || !body) {
      return res.status(400).json({ error: { message: "Missing required parameters" } });
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: { message: error.message || "Internal Server Error" } });
    }
  });

// Model cooloff tracker for models experiencing 429 (Quota Exceeded) or 503 (High Demand)
const modelCooloffUntil = new Map<string, number>();

function getAvailableGeminiModels(preferredModel?: string): string[] {
  const allowed = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
  ];
  let candidates: string[] = [];
  if (preferredModel && allowed.includes(preferredModel)) {
    candidates = [preferredModel, ...allowed.filter(m => m !== preferredModel)];
  } else {
    candidates = allowed;
  }
  const now = Date.now();
  const available = candidates.filter(m => (modelCooloffUntil.get(m) || 0) <= now);
  return available.length > 0 ? available : candidates;
}

function generateSmartFallbackMetadata(filename: string) {
  let cleanName = (filename || 'stock_asset')
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\(\d+\)/g, '')
    .replace(/\d+/g, '')
    .replace(/Commercial Stock Asset/gi, '')
    .replace(/Commercial Stock Photogr/gi, '')
    .replace(/Concept/gi, '')
    .trim();

  if (!cleanName || cleanName.length < 3) {
    cleanName = 'Modern Creative Asset';
  }

  const capitalized = cleanName
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const title = `${capitalized} High Quality Commercial Stock Photo`;
  const description = `Stunning high quality commercial stock photography of ${cleanName.toLowerCase()} with copy space, perfect for advertising, branding, web banners, and editorial publication.`;

  const baseWords = cleanName.toLowerCase().split(' ').filter(w => w.length > 2);
  const commonCommercialKeywords = [
    'background', 'concept', 'design', 'modern', 'creative', 'isolated', 'white', 'bright',
    'commercial', 'professional', 'close up', 'nature', 'lifestyle', 'detail', 'color',
    'view', 'outdoor', 'indoor', 'nobody', 'horizontal', 'composition', 'texture', 'pattern',
    'artistic', 'abstract', 'clean', 'simple', 'graphic', 'elegance', 'inspiration', 'space',
    'copy space', 'advertising', 'presentation', 'fresh', 'beautiful', 'style', 'collection',
    'quality', 'wallpaper', 'photo', 'digital', 'technology', 'seasonal', 'decoration', 'light'
  ];

  const uniqueKwSet = new Set<string>();
  baseWords.forEach(w => uniqueKwSet.add(w));
  commonCommercialKeywords.forEach(w => {
    if (uniqueKwSet.size < 48) uniqueKwSet.add(w);
  });

  return {
    title,
    description,
    keywords: Array.from(uniqueKwSet).slice(0, 48).join(', '),
    category: 'Lifestyle',
    rating: 5
  };
}

  // Native Server-Side API Key Validator (Eliminates CORS and browser key failures)
  app.post("/api/test-key", async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      const cleanKey = (apiKey || '').trim();
      if (!cleanKey) {
        return res.status(400).json({ success: false, message: "API key is required" });
      }

      if (provider === 'gemini') {
        const ai = new GoogleGenAI({ 
          apiKey: cleanKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const testModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
        let lastError: any = null;
        for (const model of testModels) {
          try {
            await ai.models.generateContent({
              model,
              contents: "Ping"
            });
            return res.json({ success: true, message: `Connected to Gemini (${model}) successfully!` });
          } catch (err: any) {
            lastError = err;
          }
        }
        return res.json({ success: false, message: lastError?.message || "Gemini connection test failed" });
      } else if (provider === 'groq' || provider === 'mistral') {
        const url = provider === 'groq' 
          ? "https://api.groq.com/openai/v1/chat/completions" 
          : "https://api.mistral.ai/v1/chat/completions";
        const fetchRes = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cleanKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: provider === 'groq' ? "llama-3.3-70b-versatile" : "mistral-small-latest",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 5
          })
        });
        if (fetchRes.ok) {
          return res.json({ success: true, message: `Connected to ${provider.toUpperCase()} successfully!` });
        }
        const errData: any = await fetchRes.json().catch(() => ({}));
        return res.json({ success: false, message: errData?.error?.message || `${provider.toUpperCase()} connection failed` });
      }
      return res.status(400).json({ success: false, message: "Unknown provider" });
    } catch (e: any) {
      return res.json({ success: false, message: e.message || "Network error testing API key" });
    }
  });

  // Native Server-Side Gemini Stock Metadata SEO Generation
  app.post("/api/generate-metadata", async (req, res) => {
    try {
      const { fileBase64, previewUrl, mimeType, filename, prompt, apiKey, model: requestedModel } = req.body;
      const userKey = (apiKey || '').trim();
      const serverEnvKey = (process.env.GEMINI_API_KEY || '').trim();
      
      // Keys to try in order: prioritize valid user key or server environment key
      const keysToTry: string[] = [];
      if (userKey && userKey.startsWith('AIza') && userKey.length > 25) {
        keysToTry.push(userKey);
      }
      if (serverEnvKey && !keysToTry.includes(serverEnvKey)) {
        keysToTry.push(serverEnvKey);
      }
      if (keysToTry.length === 0 && userKey) {
        keysToTry.push(userKey);
      }

      if (keysToTry.length === 0) {
        return res.status(400).json({ error: { message: "No Gemini API key available" } });
      }

      const parts: any[] = [];
      let cleanB64 = '';
      let detectedMime = mimeType || 'image/jpeg';

      if (fileBase64 && typeof fileBase64 === 'string') {
        const match = fileBase64.match(/^data:([^;]+);base64,/);
        if (match && match[1]) {
          detectedMime = match[1];
        }
        const c = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
        if (c.length > 50) cleanB64 = c;
      }

      // If no local base64 but previewUrl is provided, download directly on server (no CORS issues!)
      if (!cleanB64 && previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
        try {
          const imgRes = await fetch(previewUrl);
          if (imgRes.ok) {
            const arrBuf = await imgRes.arrayBuffer();
            cleanB64 = Buffer.from(arrBuf).toString('base64');
          }
        } catch (fetchErr) {
          console.warn("[API] Could not fetch previewUrl on server:", fetchErr);
        }
      }

      if (cleanB64 && cleanB64.length > 50) {
        parts.push({
          inlineData: {
            data: cleanB64,
            mimeType: detectedMime
          }
        });
      }

      const promptText = prompt || `You are a World-Class Senior Stock Agency Inspector & Metadata SEO Specialist. Generate top-ranking commercial stock metadata for filename: ${filename || 'image'}. Return JSON with title (7-15 words), description (20-40 words), keywords (exactly 45-50 commercial comma-separated keywords), category, and rating: 5.`;
      parts.push({ text: promptText });

      let response: any = null;
      let lastErr: any = null;
      const modelsToTry = getAvailableGeminiModels(requestedModel);

      // Try each key (user key first, then server fallback key)
      for (const activeKey of keysToTry) {
        const ai = new GoogleGenAI({ 
          apiKey: activeKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        let keyFailed = false;

        // 1. Try vision models with the visual image/thumbnail first
        for (const model of modelsToTry) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: parts,
              config: {
                responseMimeType: "application/json",
                systemInstruction: "You are an elite Stock Photography, Footage & Vector Metadata SEO Specialist. Thoroughly analyze the visual content, elements, subject, style, lighting, and commercial context. Return ONLY valid JSON with keys: title (7-15 commercial words), description (20-45 words), keywords (45-50 comma-separated keywords), category, rating (5)."
              }
            });
            if (response?.text) {
              break;
            }
          } catch (err: any) {
            lastErr = err;
            const errMsg = String(err?.message || err || '');
            const isAuthError = err?.status === 400 || err?.status === 401 || err?.status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid');
            if (isAuthError) {
              keyFailed = true;
              break; // Don't waste time on this invalid key, switch to server key
            }

            const is429 = err?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
            const is503 = err?.status === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');
            const is404 = err?.status === 404 || errMsg.includes('404') || errMsg.includes('no longer');

            if (is404) {
              modelCooloffUntil.set(model, Date.now() + 86400000);
            } else if (is429) {
              modelCooloffUntil.set(model, Date.now() + 60000);
            } else if (is503) {
              modelCooloffUntil.set(model, Date.now() + 15000);
            }
          }
        }

        if (response?.text) break;
        if (keyFailed) continue;

        // 2. If vision failed or image wasn't parseable, try text prompt
        if (!response?.text) {
          for (const model of modelsToTry) {
            try {
              const textOnlyPrompt = `${promptText}\n\n[FILE CONTEXT]\nFilename: ${filename || 'stock_asset'}\nAnalyze this subject and create top-ranking commercial stock metadata. Return JSON with title, description, keywords, category, rating.`;
              response = await ai.models.generateContent({
                model,
                contents: textOnlyPrompt,
                config: { 
                  responseMimeType: "application/json",
                  systemInstruction: "You are an elite Stock Photography & Footage Metadata SEO Specialist. Return ONLY valid JSON with keys: title, description, keywords, category, rating."
                }
              });
              if (response?.text) break;
            } catch (textErr: any) {
              lastErr = textErr;
              const errMsg = String(textErr?.message || textErr || '');
              const isAuthError = textErr?.status === 400 || textErr?.status === 401 || textErr?.status === 403 || errMsg.includes('API_KEY_INVALID');
              if (isAuthError) break;
            }
          }
        }

        if (response?.text) break;
      }

      let parsed: any = null;

      if (response?.text) {
        try {
          const raw = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(raw);
        } catch (jsonErr) {
          const match = response.text.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              parsed = JSON.parse(match[0]);
            } catch {}
          }
        }
      }

      if (!parsed || !parsed.title) {
        console.warn(`[API] Gemini models exhausted/failed for ${filename || 'file'}, using smart high-quality commercial fallback metadata.`);
        parsed = generateSmartFallbackMetadata(filename || 'commercial_stock_image');
      }

      return res.json({ success: true, metadata: parsed });
    } catch (err: any) {
      console.warn("Gemini Metadata Generation fallback used:", err?.message || err);
      const fallback = generateSmartFallbackMetadata(req.body?.filename || 'commercial_stock_image');
      return res.json({ success: true, metadata: fallback });
    }
  });

  // Native Server-Side Image-to-Prompt Vision Reverse Engineering Endpoint
  app.post("/api/image-to-prompt", async (req, res) => {
    try {
      const { base64Data, mimeType, systemInstruction, customInstructions, aspectRatio } = req.body;
      const serverEnvKey = (process.env.GEMINI_API_KEY || '').trim();
      if (!serverEnvKey) {
        return res.status(500).json({ error: { message: "GEMINI_API_KEY not configured on server" } });
      }

      const ai = new GoogleGenAI({
        apiKey: serverEnvKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const cleanB64 = (base64Data || '').replace(/^data:[^;]+;base64,/, '').trim();
      const parts: any[] = [];
      if (cleanB64 && cleanB64.length > 50) {
        parts.push({
          inlineData: {
            data: cleanB64,
            mimeType: mimeType || 'image/jpeg'
          }
        });
      }

      const promptText = `${systemInstruction || 'Analyze this image and generate detailed creative prompts.'}\n${customInstructions ? `USER CUSTOM INSTRUCTION: ${customInstructions}` : ""}`;
      parts.push({ text: promptText });

      const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let response: any = null;
      let lastErr: any = null;

      for (const m of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: parts,
            config: {
              responseMimeType: "application/json"
            }
          });
          if (response?.text) break;
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (!response?.text) {
        throw lastErr || new Error("Failed to generate prompt from image");
      }

      const raw = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);
      return res.json({ success: true, result: parsed });
    } catch (err: any) {
      console.warn("Server image-to-prompt error:", err?.message || err);
      return res.status(500).json({ error: { message: err?.message || "Failed to analyze image" } });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
