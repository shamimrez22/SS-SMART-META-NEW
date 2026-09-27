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
  // Reliable models ordered by capability, speed, and generous rate limits
  const allowed = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
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
    .replace(/Stock Photo/gi, '')
    .replace(/Concept/gi, '')
    .trim();

  if (!cleanName || cleanName.length < 3) {
    cleanName = 'Visual Subject';
  }

  const words = cleanName.split(/\s+/).filter(Boolean);
  const capitalized = words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const title = words.length >= 5 
    ? capitalized 
    : `${capitalized} High Resolution Visual`;

  const description = `Detailed perspective of ${cleanName.toLowerCase()}, showcasing key visual features, fine textures, and clean background composition suitable for creative publication.`;

  const uniqueKwSet = new Set<string>();
  
  // Extract core keywords and phrases directly from the actual filename
  words.forEach(w => {
    const lw = w.toLowerCase();
    if (lw.length > 2 && !['and', 'the', 'for', 'with', 'from', 'this', 'that', 'jpg', 'jpeg', 'png', 'eps', 'svg'].includes(lw)) {
      uniqueKwSet.add(lw);
    }
  });

  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i].toLowerCase()} ${words[i+1].toLowerCase()}`;
    if (pair.length > 5) uniqueKwSet.add(pair);
  }

  // Safe visual and composition descriptors directly relevant to stock visuals
  const safeStockTags = [
    'design', 'creative', 'graphic', 'visual', 'composition', 'color', 'detail', 
    'modern', 'texture', 'style', 'element', 'backdrop', 'presentation', 'art', 
    'clean', 'clarity', 'focus', 'palette', 'contemporary', 'pattern'
  ];

  safeStockTags.forEach(kw => {
    if (uniqueKwSet.size < 35) uniqueKwSet.add(kw);
  });

  return {
    title,
    description,
    keywords: Array.from(uniqueKwSet).join(', '),
    category: 'Objects',
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
        const testModels = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash"];
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
              const isDailyQuota = errMsg.includes('limit: 20') || errMsg.includes('FreeTier') || errMsg.includes('per_day');
              modelCooloffUntil.set(model, Date.now() + (isDailyQuota ? 7200000 : 3000));
              await new Promise(r => setTimeout(r, 600));
            } else if (is503) {
              modelCooloffUntil.set(model, Date.now() + 2000);
              await new Promise(r => setTimeout(r, 400));
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

      if (parsed) {
        if (Array.isArray(parsed.keywords)) {
          parsed.keywords = parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean).join(', ');
        }
        if (typeof parsed.keywords === 'string') {
          // Remove unwanted generic buzzwords like "concept", "commercial", "stock photo"
          parsed.keywords = parsed.keywords
            .split(',')
            .map((k: string) => k.trim())
            .filter((k: string) => {
              const lk = k.toLowerCase();
              return lk && !['universal', 'marketplace', 'marketplaces', 'concept', 'commercial', 'stock photo', 'stock image', 'asset'].includes(lk);
            })
            .join(', ');
        }
        if (typeof parsed.title === 'string') {
          parsed.title = parsed.title.replace(/^["'`\s]+|["'`\s]+$/g, '').trim();
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

      const modelsToTry = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash"];
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

  // ==========================================
  // SERVER-AUTHORITATIVE LICENSE & USER TRACKING SYSTEM
  // ==========================================
  const LICENSES_FILE = path.join(process.cwd(), 'data', 'licenses.json');
  const ADMIN_MASTER_LICENSE_KEY = 'ADMIN-SHAMIM-321';
  const MASTER_ADMIN_RECORD = {
    id: 'master-admin-shamim-key',
    key: ADMIN_MASTER_LICENSE_KEY,
    duration: 'lifetime',
    durationDays: 36500,
    clientName: '👑 Master Admin (Shamim) - Permanent Lifetime',
    createdAt: 1774320000000,
    expiresAt: 4927536000000,
    status: 'active',
    activatedAt: 1774320000000,
    activeUsers: []
  };

  function parseDeviceLabel(ua?: string): string {
    if (!ua) return 'Web Client';
    let browser = 'Browser';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';

    let os = 'Device';
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
  }

  function loadLicenses(): any[] {
    try {
      if (fs.existsSync(LICENSES_FILE)) {
        const data = fs.readFileSync(LICENSES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          if (!parsed.some(l => l.key?.toUpperCase() === ADMIN_MASTER_LICENSE_KEY)) {
            parsed.unshift(MASTER_ADMIN_RECORD);
            saveLicenses(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading licenses:', err);
    }
    return [MASTER_ADMIN_RECORD];
  }

  function saveLicenses(list: any[]): void {
    try {
      fs.mkdirSync(path.dirname(LICENSES_FILE), { recursive: true });
      fs.writeFileSync(LICENSES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving licenses:', err);
    }
  }

  // 1. GET ALL LICENSES (with live active user counts and devices for Admin Panel)
  app.get('/api/licenses', (req, res) => {
    try {
      const list = loadLicenses();
      const now = Date.now();
      // Calculate online status (heartbeat within 90s)
      const enriched = list.map(item => {
        const users = Array.isArray(item.activeUsers) ? item.activeUsers : [];
        const onlineUsers = users.filter((u: any) => now - (u.lastActiveAt || 0) <= 90000);
        return {
          ...item,
          activeUsers: users,
          activeUsersCount: users.length,
          onlineUsersCount: onlineUsers.length,
          isOnline: onlineUsers.length > 0
        };
      });
      return res.json({ success: true, licenses: enriched });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to get licenses' } });
    }
  });

  // 2. VALIDATE & ACTIVATE LICENSE KEY
  app.post('/api/licenses/validate', (req, res) => {
    try {
      const { key, sessionId, deviceLabel } = req.body || {};
      const cleanKey = (key || '').trim().toUpperCase();
      if (!cleanKey) {
        return res.status(400).json({ valid: false, message: 'Please enter a license key.' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';
      const resolvedDevice = deviceLabel || parseDeviceLabel(userAgent);
      const now = Date.now();

      // Master Admin Key
      if (cleanKey === ADMIN_MASTER_LICENSE_KEY) {
        return res.json({
          valid: true,
          isAdmin: true,
          message: 'Master Admin Key (ADMIN-SHAMIM-321) verified successfully.',
          license: MASTER_ADMIN_RECORD
        });
      }

      const licenses = loadLicenses();
      let record = licenses.find(l => l.key?.toUpperCase() === cleanKey);

      // Algorithmic self-registration fallback if key follows SSM standard
      if (!record && /^SSM-(1M|6M|1Y|LIFE|[0-9]{1,4}D|CUST)-[A-Z0-9]{4,5}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
        const parts = cleanKey.split('-');
        const code = parts[1];
        let duration = '1m';
        let days = 30;
        if (code === '6M') { duration = '6m'; days = 180; }
        else if (code === '1Y') { duration = '1y'; days = 365; }
        else if (code === 'LIFE') { duration = 'lifetime'; days = 36500; }
        else if (code.endsWith('D')) { duration = 'custom'; days = Math.max(1, parseInt(code.replace('D', ''), 10) || 30); }

        record = {
          id: `lic_${now}_${Math.random().toString(36).slice(2, 7)}`,
          key: cleanKey,
          duration,
          durationDays: days,
          clientName: 'Authorized Client',
          createdAt: now,
          expiresAt: duration === 'lifetime' ? now + (100 * 365 * 24 * 60 * 60 * 1000) : now + (days * 24 * 60 * 60 * 1000),
          status: 'active',
          activatedAt: now,
          activeUsers: []
        };
        licenses.unshift(record);
      }

      if (!record) {
        return res.status(404).json({ valid: false, message: 'Invalid license key. Key does not exist.' });
      }

      if (record.status === 'revoked') {
        return res.status(403).json({ valid: false, revoked: true, message: 'This license key has been revoked by the administrator.' });
      }

      if (record.duration !== 'lifetime' && now > record.expiresAt) {
        return res.status(403).json({ valid: false, expired: true, message: 'This license key has expired. Please contact admin to renew.' });
      }

      // Track active user session
      if (!Array.isArray(record.activeUsers)) {
        record.activeUsers = [];
      }

      const activeSessionId = sessionId || `sess_${Math.random().toString(36).slice(2, 9)}`;
      const existingUserIdx = record.activeUsers.findIndex((u: any) => u.sessionId === activeSessionId);

      const sessionObj = {
        sessionId: activeSessionId,
        ip: clientIp,
        userAgent,
        deviceLabel: resolvedDevice,
        activatedAt: existingUserIdx >= 0 ? record.activeUsers[existingUserIdx].activatedAt : now,
        lastActiveAt: now
      };

      if (existingUserIdx >= 0) {
        record.activeUsers[existingUserIdx] = sessionObj;
      } else {
        record.activeUsers.unshift(sessionObj);
      }

      // Limit stored sessions per key to last 50 devices
      if (record.activeUsers.length > 50) {
        record.activeUsers = record.activeUsers.slice(0, 50);
      }

      if (!record.activatedAt) {
        record.activatedAt = now;
      }

      saveLicenses(licenses);

      const daysRemaining = record.duration === 'lifetime' 
        ? 9999 
        : Math.max(0, Math.ceil((record.expiresAt - now) / (1000 * 60 * 60 * 24)));

      return res.json({
        valid: true,
        sessionId: activeSessionId,
        daysRemaining,
        license: {
          key: record.key,
          duration: record.duration,
          durationDays: record.durationDays,
          expiresAt: record.expiresAt,
          activatedAt: record.activatedAt,
          clientName: record.clientName
        },
        message: `License successfully verified! (${record.duration === 'lifetime' ? 'Lifetime Access' : `${record.durationDays} Days Valid`})`
      });
    } catch (err: any) {
      return res.status(500).json({ valid: false, message: err?.message || 'Server error verifying license.' });
    }
  });

  // 3. CONTINUOUS HEARTBEAT & REAL-TIME REVOCATION CHECK
  // Clients ping this every 15s. If Admin deleted the key, it returns valid: false!
  app.post('/api/licenses/heartbeat', (req, res) => {
    try {
      const { key, sessionId, deviceLabel } = req.body || {};
      const cleanKey = (key || '').trim().toUpperCase();
      if (!cleanKey) {
        return res.json({ valid: false, message: 'No license key provided.' });
      }

      if (cleanKey === ADMIN_MASTER_LICENSE_KEY) {
        return res.json({ valid: true, isAdmin: true });
      }

      const licenses = loadLicenses();
      const record = licenses.find(l => l.key?.toUpperCase() === cleanKey);

      // IF KEY WAS DELETED OR DOES NOT EXIST ON SERVER -> INSTANT TERMINATION!
      if (!record) {
        return res.json({
          valid: false,
          terminated: true,
          message: '⚠️ আপনার লাইসেন্সটি অ্যাডমিন দ্বারা মুছে ফেলা হয়েছে। অনুগ্রহ করে নতুন লাইসেন্স কী দিন।'
        });
      }

      // IF KEY WAS REVOKED -> INSTANT TERMINATION!
      if (record.status === 'revoked') {
        return res.json({
          valid: false,
          terminated: true,
          message: '⚠️ এই লাইসেন্সটি অ্যাডমিন বাতিল করেছেন। অনুগ্রহ করে নতুন লাইসেন্স কী দিন।'
        });
      }

      const now = Date.now();
      if (record.duration !== 'lifetime' && now > record.expiresAt) {
        return res.json({
          valid: false,
          expired: true,
          message: '⚠️ এই লাইসেন্সটির মেয়াদ শেষ হয়েছে। অনুগ্রহ করে নতুন লাইসেন্স কী দিন।'
        });
      }

      // Update user last active timestamp
      if (Array.isArray(record.activeUsers) && sessionId) {
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
        const userIdx = record.activeUsers.findIndex((u: any) => u.sessionId === sessionId);
        if (userIdx >= 0) {
          record.activeUsers[userIdx].lastActiveAt = now;
          if (deviceLabel) record.activeUsers[userIdx].deviceLabel = deviceLabel;
        } else {
          record.activeUsers.unshift({
            sessionId,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || '',
            deviceLabel: deviceLabel || parseDeviceLabel(req.headers['user-agent']),
            activatedAt: now,
            lastActiveAt: now
          });
        }
        saveLicenses(licenses);
      }

      return res.json({ valid: true });
    } catch (err: any) {
      return res.json({ valid: true }); // Transient network error won't immediately lock out
    }
  });

  // 4. GENERATE NEW LICENSE (from Admin Panel)
  app.post('/api/licenses/generate', (req, res) => {
    try {
      const { duration, clientName, customDays } = req.body || {};
      const now = Date.now();

      let durationDays = 30;
      switch (duration) {
        case '1m': durationDays = 30; break;
        case '6m': durationDays = 180; break;
        case '1y': durationDays = 365; break;
        case 'lifetime': durationDays = 36500; break;
        case 'custom': durationDays = Math.max(1, Number(customDays) || 30); break;
        default: durationDays = 30;
      }

      const prefixMap: Record<string, string> = {
        '1m': '1M',
        '6m': '6M',
        '1y': '1Y',
        'lifetime': 'LIFE',
        'custom': `${durationDays}D`
      };

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randStr = (len: number) => {
        let s = '';
        for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
      };

      const timeHex = (now % 10000000).toString(36).toUpperCase().padStart(4, 'X').slice(-4);
      const key = `SSM-${prefixMap[duration] || '1M'}-${timeHex}${randStr(1)}-${randStr(4)}-${randStr(4)}`;

      const expiresAt = duration === 'lifetime' 
        ? now + (100 * 365 * 24 * 60 * 60 * 1000) 
        : now + (durationDays * 24 * 60 * 60 * 1000);

      const record = {
        id: `lic_${now}_${Math.random().toString(36).slice(2, 7)}`,
        key,
        duration: duration || '1m',
        durationDays,
        customDays: duration === 'custom' ? durationDays : undefined,
        clientName: clientName?.trim() || 'Valued User',
        createdAt: now,
        expiresAt,
        status: 'active',
        activeUsers: []
      };

      const licenses = loadLicenses();
      licenses.unshift(record);
      saveLicenses(licenses);

      return res.json({ success: true, license: record });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to generate license' } });
    }
  });

  // 5. DELETE LICENSE (IMMEDIATELY TERMINATES ALL ACTIVE SESSIONS RUNNING THIS KEY!)
  app.delete('/api/licenses/:id', (req, res) => {
    try {
      const { id } = req.params;
      if (!id || id === ADMIN_MASTER_LICENSE_KEY || id === 'master-admin-shamim-key') {
        return res.status(400).json({ error: { message: 'Master Admin key cannot be deleted.' } });
      }

      let licenses = loadLicenses();
      const target = licenses.find(l => l.id === id || l.key === id);
      if (!target) {
        return res.status(404).json({ error: { message: 'License not found.' } });
      }

      // Remove from server database
      licenses = licenses.filter(l => l.id !== id && l.key !== id);
      saveLicenses(licenses);

      console.log(`[LICENSE] Terminated & Deleted license key: ${target.key} (active users disconnected)`);

      return res.json({
        success: true,
        message: `✓ License key ${target.key} has been permanently deleted from server. All active users running this key are now immediately terminated and locked out!`
      });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to delete license' } });
    }
  });

  // Also support POST /api/licenses/delete for universal browser compatibility
  app.post('/api/licenses/delete', (req, res) => {
    try {
      const { id } = req.body || {};
      if (!id || id === ADMIN_MASTER_LICENSE_KEY || id === 'master-admin-shamim-key') {
        return res.status(400).json({ error: { message: 'Master Admin key cannot be deleted.' } });
      }

      let licenses = loadLicenses();
      const target = licenses.find(l => l.id === id || l.key === id);
      if (!target) {
        return res.status(404).json({ error: { message: 'License not found.' } });
      }

      licenses = licenses.filter(l => l.id !== id && l.key !== id);
      saveLicenses(licenses);

      console.log(`[LICENSE] Terminated & Deleted license key: ${target.key}`);

      return res.json({
        success: true,
        message: `✓ License key ${target.key} deleted. Active users are now terminated!`
      });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to delete license' } });
    }
  });

  // 6. REVOKE LICENSE
  app.post('/api/licenses/revoke', (req, res) => {
    try {
      const { id } = req.body || {};
      if (!id || id === ADMIN_MASTER_LICENSE_KEY || id === 'master-admin-shamim-key') {
        return res.status(400).json({ error: { message: 'Master Admin key cannot be revoked.' } });
      }

      const licenses = loadLicenses();
      const target = licenses.find(l => l.id === id || l.key === id);
      if (!target) {
        return res.status(404).json({ error: { message: 'License not found.' } });
      }

      target.status = 'revoked';
      saveLicenses(licenses);

      return res.json({ success: true, message: `License ${target.key} has been revoked.` });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to revoke license' } });
    }
  });

  // 7. SYNC LOCAL LICENSES TO SERVER (Ensures no previously generated keys are lost)
  app.post('/api/licenses/sync', (req, res) => {
    try {
      const { keys } = req.body || {};
      if (!Array.isArray(keys) || keys.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const current = loadLicenses();
      let added = 0;

      for (const k of keys) {
        if (!k.key || k.key === ADMIN_MASTER_LICENSE_KEY) continue;
        if (!current.some(c => c.key?.toUpperCase() === k.key?.toUpperCase())) {
          current.push({
            id: k.id || `lic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            key: k.key,
            duration: k.duration || '1m',
            durationDays: k.durationDays || 30,
            clientName: k.clientName || 'Saved User',
            createdAt: k.createdAt || Date.now(),
            expiresAt: k.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: k.status || 'active',
            activatedAt: k.activatedAt,
            activeUsers: []
          });
          added++;
        }
      }

      if (added > 0) {
        saveLicenses(current);
      }

      return res.json({ success: true, addedCount: added, total: current.length });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Failed to sync' } });
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
