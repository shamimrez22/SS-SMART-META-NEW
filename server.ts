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
  const allowed = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
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

  // Native Server-Side Gemini Stock Metadata SEO Generation
  app.post("/api/generate-metadata", async (req, res) => {
    try {
      const { fileBase64, mimeType, filename, prompt, apiKey, model: requestedModel } = req.body;
      const activeKey = (apiKey || '').trim() || process.env.GEMINI_API_KEY || '';

      if (!activeKey) {
        return res.status(400).json({ error: { message: "No Gemini API key available" } });
      }

      const ai = new GoogleGenAI({ 
        apiKey: activeKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const parts: any[] = [];

      let hasValidImage = false;
      if (fileBase64 && typeof fileBase64 === 'string') {
        const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
        // Needs a realistic minimum length for an image
        if (cleanB64.length > 200) {
          parts.push({
            inlineData: {
              data: cleanB64,
              mimeType: mimeType || 'image/jpeg'
            }
          });
          hasValidImage = true;
        }
      }

      const promptText = prompt || `You are a World-Class Senior Stock Agency Inspector & Metadata SEO Specialist. Generate top-ranking commercial stock metadata for filename: ${filename || 'image'}. Return JSON with title (7-15 words), description (20-40 words), keywords (exactly 45-50 commercial comma-separated keywords), category, and rating: 5.`;
      parts.push({ text: promptText });

      // Prepare contents for @google/genai SDK
      let response: any = null;
      let lastErr: any = null;

      // High-quota robust vision models (gemini-2.5-flash, gemini-3.1-flash-lite, gemini-3.8-flash)
      const modelsToTry = getAvailableGeminiModels(requestedModel);

      if (activeKey) {
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
              console.log(`[API] Model ${model} generated response for ${filename || 'image'}`);
              break;
            }
          } catch (err: any) {
            lastErr = err;
            const errMsg = String(err?.message || err || '');
            const is429 = err?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
            const is503 = err?.status === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');
            const is404 = err?.status === 404 || errMsg.includes('404') || errMsg.includes('no longer');

            if (is404) {
              modelCooloffUntil.set(model, Date.now() + 86400000); // 24 hours
              console.log(`[API] Model ${model} not found or retired (404), bypassed permanently.`);
            } else if (is429) {
              modelCooloffUntil.set(model, Date.now() + 60000);
              console.log(`[API] Model ${model} quota paused (429), switching to next fallback model...`);
            } else if (is503) {
              modelCooloffUntil.set(model, Date.now() + 15000);
              console.log(`[API] Model ${model} temporarily unavailable (503), switching to next fallback model...`);
            } else {
              console.log(`[API] Model ${model} attempt bypassed (${errMsg.substring(0, 80)}), trying next fallback...`);
            }
          }
        }

        // 2. If vision failed and there was no valid image provided, try text prompt
        if (!response?.text && !hasValidImage) {
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
              if (textErr?.status === 429 || errMsg.includes('429')) {
                modelCooloffUntil.set(model, Date.now() + 60000);
              }
            }
          }
        }
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
        return res.status(500).json({ 
          error: { 
            message: lastErr?.message || "AI vision model could not analyze the image. Please retry." 
          } 
        });
      }

      return res.json({ success: true, metadata: parsed });
    } catch (err: any) {
      console.error("Gemini Metadata Generation Error:", err);
      return res.status(500).json({ error: { message: err.message || "Failed to generate metadata" } });
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
