import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

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
