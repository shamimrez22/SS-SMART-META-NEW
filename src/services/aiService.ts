import { GoogleGenAI, Type } from "@google/genai";
import UTIF from "utif";

export async function testApiConnection(provider: 'gemini' | 'groq' | 'mistral', apiKey: string): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanKey = (apiKey || '').trim();

    // Helpful detection if keys are pasted into the wrong provider slot
    if (cleanKey) {
      if (provider === 'gemini' && cleanKey.startsWith('gsk_')) {
        return { 
          success: false, 
          message: "You pasted a Groq API Key (starts with gsk_) into the Gemini slot. Please paste it under 'GROQ API KEYS' below!" 
        };
      }
      if (provider === 'groq' && cleanKey.startsWith('AIza')) {
        return { 
          success: false, 
          message: "You pasted a Gemini API Key (starts with AIza) into the Groq slot. Please paste it under 'GEMINI API KEYS' above!" 
        };
      }
    } else if (provider !== 'gemini') {
      return { success: false, message: "API Key is required" };
    }

    if (provider === 'gemini') {
      const activeKey = cleanKey || process.env.GEMINI_API_KEY || '';
      if (!activeKey) {
        return { success: false, message: "Gemini API Key is required" };
      }
      const ai = new GoogleGenAI({ apiKey: activeKey });
      
      const testModels = [
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
      ];
      let lastErr: any = null;
      for (const model of testModels) {
        try {
          await ai.models.generateContent({
            model,
            contents: "test"
          });
          return { success: true };
        } catch (err: any) {
          lastErr = err;
        }
      }
      return { success: false, message: lastErr?.message || "Connection failed with Gemini models" };
    } else if (provider === 'groq' || provider === 'mistral') {
      const url = provider === 'groq' 
        ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://api.mistral.ai/v1/chat/completions";

      const response = await fetch("/api/ai-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url,
          apiKey: cleanKey,
          body: {
            model: provider === 'groq' ? "llama-3.3-70b-versatile" : "mistral-small-latest",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 5
          }
        })
      });
      if (response.ok) return { success: true };
      const data = await response.json().catch(() => ({}));
      return { success: false, message: data.error?.message || "Connection failed" };
    }
    return { success: false, message: "Unknown provider" };
  } catch (error: any) {
    console.error(`Connection test failed for ${provider}:`, error);
    return { success: false, message: error.message || "Network error" };
  }
}

export async function generateMetadata(
  file: File, 
  settings: any, 
  apiConfig: any,
  activeProvider?: string
) {
  const geminiKey = apiConfig.gemini || process.env.GEMINI_API_KEY;
  
  const providers = [
    { name: 'gemini', key: geminiKey },
    { name: 'groq', key: apiConfig.groq },
    { name: 'mistral', key: apiConfig.mistral }
  ].filter(p => p.key && p.key.trim() !== '');

  if (providers.length === 0 && !geminiKey) {
    throw new Error("No API Keys configured. Please add a key in Settings.");
  }

  // If a specific provider was requested, use it if it has a key
  let provider = activeProvider ? providers.find(p => p.name === activeProvider) : null;

  // If no specific provider or requested provider not found in available list, 
  // use the first available or prioritize Gemini for images/videos
  const ext = file?.name?.split('.').pop()?.toLowerCase() || '';
  const isVisualMedia = file && (
    file.type.startsWith('image/') || 
    file.type.startsWith('video/') || 
    ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi', 'm4v', 'webm', 'eps'].includes(ext)
  );

  if (!provider) {
    provider = isVisualMedia 
      ? (providers.find(p => p.name === 'gemini') || providers[0] || { name: 'gemini', key: geminiKey })
      : (providers[0] || { name: 'gemini', key: geminiKey });
  }

  if (!provider || !provider.key) {
    throw new Error("API Key not found for the selected provider.");
  }

  try {
    if (provider.name === 'gemini') {
      return await generateWithGemini(file, settings, provider.key);
    } else {
      return await generateWithOpenAICompatible(file, settings, provider.key, provider.name as any);
    }
  } catch (error) {
    console.error(`Error with ${provider.name}:`, error);
    throw error;
  }
}

const SUPPORTED_GEMINI_MIMES = [
  'image/png', 
  'image/jpeg', 
  'image/webp', 
  'image/heic', 
  'image/heif',
  'application/pdf'
];

function cleanBase64(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x[0-9a-fA-F]+;/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-zA-Z]+;/g, '')
    .replace(/[\r\n\t\s]+/g, '');
}

// Fallback visual generator: Creates a crisp artboard thumbnail for EPS vectors
function generateVectorArtboardThumbnail(filename: string, headerText: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // Elegant vector blueprint theme
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, 400, 400);

    // Subtle isometric/vector grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 20; x < 400; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 400);
      ctx.stroke();
    }
    for (let y = 20; y < 400; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(400, y);
      ctx.stroke();
    }

    // Centered Artboard canvas frame
    const bbMatch = headerText.match(/%%(?:HiRes)?BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
    let artW = 280;
    let artH = 280;
    if (bbMatch) {
      const origW = Math.abs(parseInt(bbMatch[3], 10) - parseInt(bbMatch[1], 10)) || 280;
      const origH = Math.abs(parseInt(bbMatch[4], 10) - parseInt(bbMatch[2], 10)) || 280;
      const aspect = origW / origH;
      if (aspect > 1) {
        artW = 280;
        artH = Math.max(120, Math.round(280 / aspect));
      } else {
        artH = 280;
        artW = Math.max(120, Math.round(280 * aspect));
      }
    }

    const artX = (400 - artW) / 2;
    const artY = (400 - artH) / 2;

    // Artboard shadow & fill
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(artX + 4, artY + 4, artW, artH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(artX, artY, artW, artH);
    ctx.strokeStyle = '#38bdf8'; // sky-400
    ctx.lineWidth = 2;
    ctx.strokeRect(artX, artY, artW, artH);

    // Vector anchor points & stylized bezier curves
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(artX + artW * 0.2, artY + artH * 0.7);
    ctx.bezierCurveTo(
      artX + artW * 0.3, artY + artH * 0.2,
      artX + artW * 0.7, artY + artH * 0.8,
      artX + artW * 0.8, artY + artH * 0.3
    );
    ctx.stroke();

    // Corner handle points
    const points = [
      [artX + artW * 0.2, artY + artH * 0.7],
      [artX + artW * 0.5, artY + artH * 0.5],
      [artX + artW * 0.8, artY + artH * 0.3]
    ];
    for (const [px, py] of points) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px - 4, py - 4, 8, 8);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, py - 4, 8, 8);
    }

    // Vector Format Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(artX + 10, artY + 10, 80, 22, 4);
    } else {
      ctx.rect(artX + 10, artY + 10, 80, 22);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('EPS VECTOR', artX + 16, artY + 25);

    // Title label at bottom
    const titleMatch = headerText.match(/%%Title:\s*([^\n\r]+)/i);
    const cleanTitle = (titleMatch ? titleMatch[1].trim() : filename).slice(0, 30);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(cleanTitle, artX + 12, artY + artH - 12);

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    return undefined;
  }
}

/**
 * Fast filter to detect corrupted stride-shift barcode / vertical zebra stripe artifacts
 * common when decoding unaligned 1-bit / 8-bit TIFF or raw hex rasters
 */
function isBarcodeOrCorrupted(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): boolean {
  if (!rgba || width < 12 || height < 12) return true;
  
  const sampleW = Math.min(width, 60);
  const sampleH = Math.min(height, 60);
  const startX = Math.floor((width - sampleW) / 2);
  const startY = Math.floor((height - sampleH) / 2);

  let horizontalFlips = 0;
  let verticalFlips = 0;
  let totalSamples = 0;

  for (let y = startY; y < startY + sampleH - 1; y++) {
    for (let x = startX; x < startX + sampleW - 1; x++) {
      const idx = (y * width + x) * 4;
      const rightIdx = (y * width + (x + 1)) * 4;
      const downIdx = ((y + 1) * width + x) * 4;

      const lum = (rgba[idx] * 299 + rgba[idx + 1] * 587 + rgba[idx + 2] * 114) / 1000;
      const lumRight = (rgba[rightIdx] * 299 + rgba[rightIdx + 1] * 587 + rgba[rightIdx + 2] * 114) / 1000;
      const lumDown = (rgba[downIdx] * 299 + rgba[downIdx + 1] * 587 + rgba[downIdx + 2] * 114) / 1000;

      if (Math.abs(lum - lumRight) > 60) horizontalFlips++;
      if (Math.abs(lum - lumDown) > 60) verticalFlips++;
      totalSamples++;
    }
  }

  // Extreme vertical barcode / picket-fence artifact:
  // Heavy horizontal oscillating stripes with almost 0 vertical change
  if (totalSamples > 0) {
    const horizRatio = horizontalFlips / totalSamples;
    const vertRatio = verticalFlips / totalSamples;
    if (horizRatio > 0.45 && vertRatio < 0.05) {
      return true;
    }
  }

  // Completely blank / single uniform color check
  let firstR = rgba[0], firstG = rgba[1], firstB = rgba[2];
  let isUniform = true;
  for (let i = 0; i < rgba.length; i += 16) {
    if (Math.abs(rgba[i] - firstR) > 8 || Math.abs(rgba[i + 1] - firstG) > 8 || Math.abs(rgba[i + 2] - firstB) > 8) {
      isUniform = false;
      break;
    }
  }
  return isUniform;
}

/**
 * Searches for high-res true-color JPEG/PNG thumbnails embedded in Adobe Illustrator XMP blocks
 */
function findXmpJpegThumbnail(text: string): { dataUrl: string; mime: string } | null {
  // 1. Any tag ending in :image> or <image>
  const imageTagMatches = text.matchAll(/<([a-zA-Z0-9_]+:)?image\b[^>]*>([\s\S]*?)<\/\1?image>/gi);
  for (const m of imageTagMatches) {
    const b64 = cleanBase64(m[2]);
    if (b64.length > 80) {
      const mime = b64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
      return { dataUrl: `data:${mime};base64,${b64}`, mime };
    }
  }

  // 2. Alt / Thumbnails container: <xmp:Thumbnails>...<image>...
  const thumbMatch = text.match(/<xmp:Thumbnails>[\s\S]*?<image>([\s\S]*?)<\/image>/i);
  if (thumbMatch) {
    const b64 = cleanBase64(thumbMatch[1]);
    if (b64.length > 80) {
      const mime = b64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
      return { dataUrl: `data:${mime};base64,${b64}`, mime };
    }
  }

  // 3. Attribute format: image="..." or :image="..."
  const attrMatches = text.matchAll(/(?:[a-zA-Z0-9_]+:)?image="([^"]+)"/gi);
  for (const m of attrMatches) {
    const b64 = cleanBase64(m[1]);
    if (b64.length > 80) {
      const mime = b64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
      return { dataUrl: `data:${mime};base64,${b64}`, mime };
    }
  }

  // 4. Raw base64 JPEG sequence starting with /9j/ inside XMP
  const directJpeg = text.match(/\/9j\/[a-zA-Z0-9+/=&#;\s]{120,}/);
  if (directJpeg) {
    const b64 = cleanBase64(directJpeg[0]);
    if (b64.length > 80) {
      return { dataUrl: `data:image/jpeg;base64,${b64}`, mime: 'image/jpeg' };
    }
  }

  return null;
}

/**
 * Searches for embedded raw binary JFIF/JPEG streams in an EPS ArrayBuffer
 */
function findEmbeddedBinaryJpeg(buf: ArrayBuffer): string | null {
  const u8 = new Uint8Array(buf);
  const len = u8.length;
  // Scan for JPEG SOI (FF D8 FF)
  for (let i = 0; i < len - 100; i++) {
    if (u8[i] === 0xFF && u8[i + 1] === 0xD8 && u8[i + 2] === 0xFF) {
      // Find JPEG EOI (FF D9)
      const maxScan = Math.min(len - 1, i + 8 * 1024 * 1024);
      let foundEnd = -1;
      for (let j = i + 200; j < maxScan; j++) {
        if (u8[j] === 0xFF && u8[j + 1] === 0xD9) {
          foundEnd = j + 2;
          if (foundEnd - i >= 4096) break;
        }
      }
      if (foundEnd > i + 1024) {
        const jpegBytes = u8.subarray(i, foundEnd);
        let binary = '';
        const chunk = 8192;
        for (let c = 0; c < jpegBytes.length; c += chunk) {
          const sub = jpegBytes.subarray(c, Math.min(c + chunk, jpegBytes.length));
          binary += String.fromCharCode.apply(null, sub as unknown as number[]);
        }
        return `data:image/jpeg;base64,${btoa(binary)}`;
      }
    }
  }
  return null;
}

export async function extractEpsThumbnail(file: File, forAi: boolean = false): Promise<string | undefined> {
  try {
    // 1. High-Resolution True-Color XMP JPEG/PNG Thumbnail (Best Quality, Universal)
    // Adobe Illustrator, Freepik, Adobe Stock, Shutterstock, and Vecteezy embed a 300-800px full-color preview in XMP
    try {
      const headSlice = await file.slice(0, Math.min(6291456, file.size)).arrayBuffer();
      const headText = new TextDecoder('latin1').decode(headSlice);

      let xmpResult = findXmpJpegThumbnail(headText);
      if (!xmpResult && file.size > 6291456) {
        try {
          const tailSlice = await file.slice(Math.max(0, file.size - 4194304)).arrayBuffer();
          const tailText = new TextDecoder('latin1').decode(tailSlice);
          xmpResult = findXmpJpegThumbnail(tailText);
        } catch {}
      }

      if (xmpResult && xmpResult.dataUrl) {
        return xmpResult.dataUrl;
      }
    } catch (xmpErr) {
      console.warn("XMP thumbnail extraction attempt:", xmpErr);
    }

    // 2. Embedded Binary JFIF/JPEG Stream in EPS File
    try {
      const scanLen = Math.min(8 * 1024 * 1024, file.size);
      const scanBuf = await file.slice(0, scanLen).arrayBuffer();
      const jpegDataUrl = findEmbeddedBinaryJpeg(scanBuf);
      if (jpegDataUrl) {
        return jpegDataUrl;
      }
    } catch (binErr) {
      console.warn("Binary JPEG scan attempt:", binErr);
    }

    // 3. Server-Side Ghostscript Vector Rendering (/api/render-eps)
    // When running in full-stack container, Ghostscript renders PostScript paths at 150 DPI
    if (typeof window !== 'undefined' && file.size <= 45 * 1024 * 1024) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        // Stream raw file directly to server for maximum speed and zero memory overhead
        const res = await fetch('/api/render-eps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/postscript' },
          body: file,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const resData = await res.json();
          if (resData.preview) {
            return resData.preview;
          }
        }
      } catch (apiErr) {
        // Handled silently for static hosts like Cloudflare Pages
      }
    }

    // 4. Safe DOS EPS Header TIFF Preview (with Barcode/Glitch Detection)
    if (file.size >= 30) {
      try {
        const headerBuf = await file.slice(0, 30).arrayBuffer();
        const headerBytes = new Uint8Array(headerBuf);
        // DOS EPS magic bytes: 0xC5, 0xD0, 0xD3, 0xC6
        if (headerBytes[0] === 0xC5 && headerBytes[1] === 0xD0 && headerBytes[2] === 0xD3 && headerBytes[3] === 0xC6) {
          const view = new DataView(headerBuf);
          const tiffOffset = view.getUint32(20, true);
          const tiffLength = view.getUint32(24, true);

          if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= file.size + 1000) {
            const tiffBuf = await file.slice(tiffOffset, tiffOffset + tiffLength).arrayBuffer();
            const ifds = UTIF.decode(tiffBuf);
            if (ifds && ifds.length > 0) {
              UTIF.decodeImage(tiffBuf, ifds[0]);
              const rgba = UTIF.toRGBA8(ifds[0]);
              const width = ifds[0].width;
              const height = ifds[0].height;
              if (width > 0 && height > 0 && rgba) {
                // Verify this preview is NOT a corrupted vertical zebra-stripe/barcode artifact
                if (!isBarcodeOrCorrupted(rgba, width, height)) {
                  const canvas = document.createElement('canvas');
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
                    ctx.putImageData(imgData, 0, 0);
                    return canvas.toDataURL('image/jpeg', 0.88);
                  }
                } else {
                  console.warn("TIFF preview rejected: detected stride/barcode glitch pattern");
                }
              }
            }
          }
        }
      } catch (tiffErr) {
        console.warn("TIFF preview extraction fallback:", tiffErr);
      }
    }

    // 5. PostScript %%BeginPreview: hex raster (with Glitch Detection)
    try {
      const headSlice = await file.slice(0, Math.min(524288, file.size)).arrayBuffer();
      const headText = new TextDecoder('latin1').decode(headSlice);
      const previewMatch = headText.match(/%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)([\s\S]*?)%%EndPreview/i);
      if (previewMatch) {
        const width = parseInt(previewMatch[1], 10);
        const height = parseInt(previewMatch[2], 10);
        const depth = parseInt(previewMatch[3], 10);
        const hexData = previewMatch[5].replace(/^[ \t]*%[ \t]*/gm, '').replace(/[^0-9a-fA-F]/g, '');
        if (width > 10 && height > 10 && hexData.length > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imgData = ctx.createImageData(width, height);
            const data = imgData.data;
            if (depth === 1) {
              const bytesPerRow = Math.ceil(width / 8);
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const byteIdx = y * bytesPerRow + Math.floor(x / 8);
                  const hexByte = hexData.substr(byteIdx * 2, 2);
                  const byteVal = parseInt(hexByte, 16) || 0;
                  const bit = (byteVal >> (7 - (x % 8))) & 1;
                  const pixelIdx = (y * width + x) * 4;
                  const val = bit ? 0 : 255;
                  data[pixelIdx] = val;
                  data[pixelIdx + 1] = val;
                  data[pixelIdx + 2] = val;
                  data[pixelIdx + 3] = 255;
                }
              }
            } else if (depth === 8) {
              for (let i = 0; i < width * height; i++) {
                const byteVal = parseInt(hexData.substr(i * 2, 2), 16) || 255;
                data[i * 4] = byteVal;
                data[i * 4 + 1] = byteVal;
                data[i * 4 + 2] = byteVal;
                data[i * 4 + 3] = 255;
              }
            }
            if (!isBarcodeOrCorrupted(data, width, height)) {
              ctx.putImageData(imgData, 0, 0);
              return canvas.toDataURL('image/jpeg', 0.88);
            }
          }
        }
      }
    } catch (hexErr) {
      console.warn("Hex preview extraction fallback:", hexErr);
    }

    // 6. Vector Artboard Fallback
    // CRITICAL: When generating for AI vision model, return undefined!
    // Never send synthetic blueprint curves to the AI, or it will hallucinate grid/blueprint metadata!
    if (forAi) {
      return undefined;
    }

    // For UI display, render clean vector artboard card
    const headSlice = await file.slice(0, Math.min(65536, file.size)).arrayBuffer();
    const headText = new TextDecoder('latin1').decode(headSlice);
    return generateVectorArtboardThumbnail(file.name, headText);
  } catch (e) {
    console.error("EPS preview error:", e);
    return undefined;
  }
}

export async function extractVideoThumbnail(file: File): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  return new Promise((resolve) => {
    let resolved = false;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(undefined);
      }
    }, 7000);

    video.onloadedmetadata = () => {
      try {
        // Seek into video (e.g. 20% or 1s) to avoid black first frames
        const duration = video.duration || 2;
        const seekTime = Math.min(Math.max(duration * 0.25, 0.5), duration > 1 ? duration - 0.2 : 0);
        video.currentTime = seekTime;
      } catch (e) {
        capture();
      }
    };

    video.onseeked = () => {
      capture();
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(undefined);
      }
    };

    function capture() {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 480;
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 360;

        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          cleanup();
          resolve(dataUrl);
          return;
        }
      } catch (e) {
        console.warn('Canvas video capture warning:', e);
      }
      cleanup();
      resolve(undefined);
    }
  });
}

async function extractEpsMetadata(file: File): Promise<string> {
  try {
    // Read up to 2MB to capture headers, XMP block, AI layers, typography, and color tables
    const maxRead = Math.min(2 * 1024 * 1024, file.size);
    const buffer = await file.slice(0, maxRead).arrayBuffer();
    const text = new TextDecoder('latin1').decode(buffer);

    const titleMatch = text.match(/%%Title:\s*([^\r\n]+)/i);
    const creatorMatch = text.match(/%%Creator:\s*([^\r\n]+)/i);
    const colorsMatch = text.match(/%%DocumentCustomColors:\s*([^\r\n]+)/i);
    const processColors = text.match(/%%DocumentProcessColors:\s*([^\r\n]+)/i);
    const bboxMatch = text.match(/%%(?:HiRes)?BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);

    // 1. Layer Names (Illustrator %AI5_LayerName: tells exact visual elements)
    const layerNames: string[] = [];
    const layerRegex = /%AI5_LayerName:\s*([^\r\n]+)/gi;
    let lm: RegExpExecArray | null;
    while ((lm = layerRegex.exec(text)) !== null) {
      const l = lm[1].replace(/\\/g, '').trim();
      if (l && !layerNames.includes(l) && !l.toLowerCase().startsWith('layer ') && l !== 'Layer') {
        layerNames.push(l);
      }
    }

    // 2. XMP Dublin Core Title & Description
    const dcTitle = text.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
    const dcDesc = text.match(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
    const headline = text.match(/<photoshop:Headline>([\s\S]*?)<\/photoshop:Headline>/i);

    // 3. XMP Keywords / Subjects
    const xmpKeywords: string[] = [];
    const subjectBlock = text.match(/<dc:subject>[\s\S]*?<\/dc:subject>/i);
    if (subjectBlock) {
      const liRegex = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi;
      let km: RegExpExecArray | null;
      while ((km = liRegex.exec(subjectBlock[0])) !== null) {
        const k = km[1].trim();
        if (k && !xmpKeywords.includes(k)) xmpKeywords.push(k);
      }
    }

    // 4. PostScript Typography / Embedded Text Strings
    const textStrings: string[] = [];
    const showRegex = /\(([^)\\r\\n]{3,60})\)\s*(?:show|ashow|widthshow|kshow)/gi;
    let tm: RegExpExecArray | null;
    while ((tm = showRegex.exec(text)) !== null) {
      const t = tm[1].trim();
      if (t && !textStrings.includes(t) && !/^[\d\s.,:/%_-]+$/.test(t) && !t.startsWith('%')) {
        textStrings.push(t);
        if (textStrings.length >= 8) break;
      }
    }

    // Format into rich, high-density context lines for the AI
    const lines: string[] = [];
    if (dcTitle?.[1]?.trim()) {
      lines.push(`Embedded Artwork Title: "${dcTitle[1].trim()}"`);
    } else if (titleMatch?.[1]?.trim() && !titleMatch[1].trim().toLowerCase().startsWith('untitled')) {
      lines.push(`Vector Title: "${titleMatch[1].trim()}"`);
    }

    if (headline?.[1]?.trim()) {
      lines.push(`Artwork Headline: "${headline[1].trim()}"`);
    }
    if (dcDesc?.[1]?.trim()) {
      lines.push(`Embedded Artwork Description: "${dcDesc[1].trim()}"`);
    }
    if (xmpKeywords.length > 0) {
      lines.push(`Embedded Vector Keywords: ${xmpKeywords.slice(0, 30).join(', ')}`);
    }
    if (layerNames.length > 0) {
      lines.push(`Vector Layers Detected (${layerNames.length}): ${layerNames.slice(0, 15).join(' | ')}`);
    }
    if (textStrings.length > 0) {
      lines.push(`Typography / Text within Vector: "${textStrings.join('", "')}"`);
    }
    if (colorsMatch?.[1]?.trim()) {
      lines.push(`Color Palette / Custom Colors: ${colorsMatch[1].trim()}`);
    } else if (processColors?.[1]?.trim()) {
      lines.push(`Process Colors: ${processColors[1].trim()}`);
    }
    if (bboxMatch) {
      const w = Math.round(Math.abs(parseFloat(bboxMatch[3]) - parseFloat(bboxMatch[1])));
      const h = Math.round(Math.abs(parseFloat(bboxMatch[4]) - parseFloat(bboxMatch[2])));
      lines.push(`Vector Artboard Bounds: ${w}x${h} px (${w === h ? 'Square 1:1' : w > h ? 'Landscape' : 'Portrait'})`);
    }
    if (creatorMatch?.[1]?.trim()) {
      lines.push(`Vector Creator Software: ${creatorMatch[1].trim()}`);
    }

    return lines.join('\n');
  } catch (e) {
    return "";
  }
}

// Cache the last successful model to avoid failing through unsupported models on every single image
let cachedWorkingModel: string | null = null;

async function generateWithGemini(file: File, settings: any, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const ext = file?.name.split('.').pop()?.toLowerCase() || '';
  const isSupportedImage = file && (
    SUPPORTED_GEMINI_MIMES.includes(file.type) || 
    ['jpg', 'jpeg', 'png', 'webp', 'svg', 'bmp', 'gif', 'avif', 'tiff', 'tif', 'heic'].includes(ext) ||
    Boolean(file.type?.startsWith('image/'))
  );
  const isEps = file && (ext === 'eps' || ext === 'ai' || file.type === 'application/postscript' || file.type === 'image/x-eps');
  const isVideo = file && (file.type.startsWith('video/') || ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv', 'flv', '3gp'].includes(ext));

  const parts: any[] = [];

  if (isSupportedImage) {
    try {
      // 400x400 at 0.5 quality is ultra-fast to encode & transmit (~35KB), giving 3x speed boost
      const resizedBase64 = await resizeImage(file, 400, 400, 0.5);
      parts.push({
        inlineData: {
          data: resizedBase64.split(',')[1],
          mimeType: 'image/jpeg'
        }
      });
    } catch (e) {
      console.error("Error resizing image:", e);
      try {
        const base64Data = await fileToBase64(file);
        parts.push({
          inlineData: {
            data: base64Data.split(',')[1],
            mimeType: file.type || 'image/jpeg'
          }
        });
      } catch (err) {
        console.error("Error converting file to base64:", err);
      }
    }
  } else if (isEps) {
    // Try to extract thumbnail for EPS so Gemini can "see" it
    const thumbnail = await extractEpsThumbnail(file, true);
    if (thumbnail && thumbnail.startsWith('data:')) {
      const mime = thumbnail.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const cleanB64 = cleanBase64(thumbnail.split(',')[1] || '');
      if (cleanB64 && cleanB64.length > 80) {
        parts.push({
          inlineData: {
            data: cleanB64,
            mimeType: mime
          }
        });
      }
    }
  } else if (isVideo) {
    // Extract actual visual keyframe from video so Gemini can analyze real subject matter
    try {
      const videoThumb = await extractVideoThumbnail(file);
      if (videoThumb) {
        parts.push({
          inlineData: {
            data: videoThumb.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }
    } catch (vErr) {
      console.warn("Could not extract video keyframe:", vErr);
    }
  }

  // Add prompt after image for better context
  parts.push({ text: getPrompt(settings, file?.name || "unnamed_file", isVideo) });

  if (isEps) {
    const epsInfo = await extractEpsMetadata(file);
    const hasVisualThumb = parts.length > 1;
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: EPS Vector Illustration\nFilename: ${file.name}\n${epsInfo}\nNote: ${hasVisualThumb ? "A visual thumbnail extracted from this EPS illustration has been provided above for visual analysis." : "Visual preview was not embedded in this EPS file. Analyze the vector filename, embedded layer names, artboard bounds, typography text, and color palette above to generate accurate, high-ranking commercial stock title, description, and keywords."}`;
  } else if (isVideo) {
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: Video Footage (${file.name})\nNote: ${parts.length > 1 ? "An actual visual frame captured directly from this video has been provided above. Analyze this frame carefully to identify the exact real-world subject matter, action, environment, objects, and setting." : "Visual preview unavailable. Generate metadata based on filename: " + file.name}`;
  } else if (!isSupportedImage) {
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: ${file.type || 'Unknown'}\nNote: Visual preview unavailable. Generate metadata based on filename: "${file.name}".`;
  }

  console.log("Starting Gemini generation for:", file?.name);
  
  // Base list of fast valid models
  const baseModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash"
  ];

  // Put cached successful model first to prevent wasted attempts
  const modelsToTry = cachedWorkingModel 
    ? [cachedWorkingModel, ...baseModels.filter(m => m !== cachedWorkingModel)]
    : baseModels;

  let lastError: any = null;
  let response: any = null;

  for (const model of modelsToTry) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              keywords: { type: Type.STRING },
              category: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              analysis: {
                type: Type.OBJECT,
                properties: {
                  theme: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  objects: { type: Type.ARRAY, items: { type: Type.STRING } },
                  colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  concepts: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            required: ["title", "description", "keywords", "category", "rating"]
          }
        }
      });
      if (response && response.text) {
        cachedWorkingModel = model; // Remember this fast model for next files
        break; // Successfully got response
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed, trying next fallback:`, err?.message || err);
      lastError = err;
      if (cachedWorkingModel === model) {
        cachedWorkingModel = null;
      }
    }
  }

  if (!response) {
    throw lastError || new Error("Failed to generate metadata with Gemini.");
  }

  try {
    console.log("Gemini response received:", response);
    let result: any = {};
    try {
      const text = response.text || "{}";
      result = JSON.parse(repairJson(text));
    } catch (e) {
      console.error("Failed to parse Gemini JSON response, extracting via regex:", e, response.text);
      const raw = response.text || "";
      const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/i);
      const descMatch = raw.match(/"description"\s*:\s*"([^"]+)"/i);
      const kwMatch = raw.match(/"keywords"\s*:\s*"([^"]+)"/i);
      const catMatch = raw.match(/"category"\s*:\s*"([^"]+)"/i);
      result = {
        title: titleMatch ? titleMatch[1] : (file?.name ? file.name.replace(/\.[^/.]+$/, "") : "Stock Asset"),
        description: descMatch ? descMatch[1] : "High quality commercial stock asset suitable for digital and print media.",
        keywords: kwMatch ? kwMatch[1] : "stock, photography, design, digital, commercial, high quality",
        category: catMatch ? catMatch[1] : "Photography",
        rating: 5
      };
    }

    // Ensure all required fields exist
    if (!result.title) result.title = file?.name ? file.name.replace(/\.[^/.]+$/, "") : "Stock Asset";
    if (!result.description) result.description = `${result.title}. High quality stock photo.`;
    if (!result.keywords) result.keywords = "stock, commercial, media, creative, photo";
    if (!result.category) result.category = "Commercial";
    if (!result.rating) result.rating = 5;
    if (!result.analysis) {
      result.analysis = {
        theme: result.category,
        subject: result.title,
        objects: [],
        colors: [],
        concepts: []
      };
    }
    
    if (settings.optimizeKeywords) {
      result.keywords = optimizeKeywords(result.keywords, settings.maxKeywords || 50);
      result.keywordScore = calculateKeywordScore(result.keywords, settings.minKeywords || 20);
    }
    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const msg = error.message || "Unknown Gemini Error";
    if (msg.includes("429")) throw new Error("Rate limit exceeded (429). Please wait a moment.");
    if (msg.includes("401")) throw new Error("Invalid API Key (401).");
    if (msg.includes("SAFETY")) throw new Error("Content blocked by safety filters.");
    throw new Error(msg);
  }
}

function repairJson(text: string): string {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
  } catch (e) {
    return text;
  }
}

async function generateWithOpenAICompatible(file: File, settings: any, apiKey: string, provider: 'groq' | 'mistral') {
  const url = provider === 'groq' 
    ? "https://api.groq.com/openai/v1/chat/completions" 
    : "https://api.mistral.ai/v1/chat/completions";
  
  const ext = file?.name.split('.').pop()?.toLowerCase() || '';
  const isSupportedImage = file && (
    SUPPORTED_GEMINI_MIMES.includes(file.type) || 
    ['jpg', 'jpeg', 'png', 'webp', 'svg', 'bmp', 'gif', 'avif', 'tiff', 'tif', 'heic'].includes(ext) ||
    Boolean(file.type?.startsWith('image/'))
  );
  const isEps = file && (ext === 'eps' || ext === 'ai' || file.type === 'application/postscript' || file.type === 'image/x-eps');
  const isVideo = file && (file.type.startsWith('video/') || ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv', 'flv', '3gp'].includes(ext));

  let imageData: string | undefined;
  if (isSupportedImage) {
    try {
      // 256px is extremely safe and still enough for metadata analysis
      imageData = await resizeImage(file, 256, 256, 0.4);
    } catch (e) {
      console.error("Resize failed, falling back to compressed base64", e);
      try {
        imageData = await resizeImage(file, 200, 200, 0.3);
      } catch (innerE) {
        imageData = await fileToBase64(file);
      }
    }
  } else if (isEps) {
    imageData = await extractEpsThumbnail(file, true);
  } else if (isVideo) {
    try {
      imageData = await extractVideoThumbnail(file);
    } catch (vErr) {
      console.warn("Video thumbnail extraction warning:", vErr);
    }
  }

  // Prevent sending massive payloads that will definitely fail
  // Groq has a strict limit on request body size (~4MB)
  if (imageData && imageData.length > 2 * 1024 * 1024) { // 2MB limit for extra safety
    throw new Error(`${provider.toUpperCase()} Error: Image data is too large for this provider. Please use a smaller file or try Gemini.`);
  }

  // Use vision models if image is available
  // Groq: llama-3.2-11b-vision-preview for vision, llama-3.3-70b-versatile for text
  const model = provider === 'groq' 
    ? (imageData ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile")
    : (imageData ? "pixtral-12b-2409" : "mistral-small-latest");

  let prompt = getPrompt(settings, file?.name || "unnamed_file", isVideo);
  if (isEps) {
    const epsInfo = await extractEpsMetadata(file);
    prompt += `\n\n[FILE CONTEXT]\nType: EPS Vector Illustration\nFilename: ${file.name}\n${epsInfo}`;
  }
  const systemInstruction = "You are a stock metadata expert. You MUST return a valid JSON object. Do not include any other text or markdown formatting outside the JSON.";
  
  // Groq/Mistral: Use string for text-only, array for vision
  let content: any;
  if (imageData) {
    content = [
      { type: "text", text: `${systemInstruction}\n\n${prompt}` },
      {
        type: "image_url",
        image_url: {
          url: imageData
        }
      }
    ];
  } else {
    content = `${systemInstruction}\n\n${prompt}`;
  }

  try {
    // Add a 60-second timeout to prevent indefinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch("/api/ai-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        apiKey,
        body: {
          model,
          messages: [
            { role: "user", content: content }
          ],
          // JSON mode can sometimes cause 400 errors with vision models in some providers
          response_format: imageData ? undefined : { type: "json_object" },
          temperature: 0.3,
          max_tokens: 1024
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || errorData.message || `API Error (${response.status})`;
      
      if (response.status === 429) throw new Error(`${provider.toUpperCase()} Rate Limit: Too many requests. Please wait.`);
      if (response.status === 401) throw new Error(`${provider.toUpperCase()} Error: Invalid API Key.`);
      
      throw new Error(`${provider.toUpperCase()}: ${msg}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error(`Empty response from ${provider.toUpperCase()}.`);
    }

    const result = JSON.parse(repairJson(data.choices[0].message.content));
    result.rating = result.rating || 5;
    
    if (settings.optimizeKeywords) {
      result.keywords = optimizeKeywords(result.keywords, settings.maxKeywords || 50);
      result.keywordScore = calculateKeywordScore(result.keywords, settings.minKeywords || 20);
    }
    return result;
  } catch (error: any) {
    console.error(`${provider} API Error:`, error);
    throw error;
  }
}

function optimizeKeywords(keywords: string, max: number): string {
  const list = keywords.split(',')
    .map(k => k.trim().toLowerCase())
    .filter((k, i, self) => k && self.indexOf(k) === i) // Unique
    .slice(0, max);
  
  return list.join(', ');
}

function calculateKeywordScore(keywords: string, min: number): number {
  const list = keywords.split(',').map(k => k.trim());
  const count = list.length;
  if (count < min / 2) return 30;
  if (count < min) return 60;
  if (count < (min + 10)) return 85;
  return 100;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

async function resizeImage(file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function getPrompt(settings: any, filename: string, isVideo: boolean = false) {
  const { 
    metadataFor, 
    titleChoice, 
    minTitleWords, 
    maxTitleWords, 
    minDescriptionWords, 
    maxDescriptionWords, 
    maxKeywords,
    singleWordKeywords,
    silhouette,
    transparentBackground,
    prohibitedWords,
    customPromptEnabled,
    customPrompt,
    savedKeywords
  } = settings;

  const roleDesc = isVideo
    ? "Act as a World-Class Stock Video & Footage SEO Expert. Analyze the provided visual footage frame and generate literal, high-converting stock video metadata strictly based on the exact subject matter, actions, objects, scene, and environment shown in the video."
    : "Act as a World-Class Stock Photography SEO Expert. Analyze the image and generate literal, high-converting stock metadata.";

  const titleDesc = isVideo
    ? `literal, descriptive stock video title describing the exact subject, action, and setting in the footage`
    : `literal, descriptive stock title`;

  const descriptionDesc = isVideo
    ? `detailed description of the video clip: exact subject, movement/action, camera angle (e.g. aerial, close-up, wide, panning), lighting, and setting`
    : `detailed description of subject, lighting, context`;
  
  return `${roleDesc}

OUTPUT FORMAT: Return a JSON object with:
{
  "title": "${minTitleWords}-${maxTitleWords} words ${titleDesc}",
  "description": "${minDescriptionWords}-${maxDescriptionWords} words ${descriptionDesc}",
  "keywords": "comma-separated list of exactly ${maxKeywords || 50} specific, relevant keywords ordered from most important to general",
  "category": "Adobe Stock category (e.g. Landscapes, Technology, Business, Animals, People, Food, Architecture)",
  "rating": 5
}

RULES:
- Subject Accuracy: You MUST describe the actual visual subject matter and scene present in the footage/image. Do not generate generic, unrelated filler.
- Title must be direct and literal, describing what is visually happening.
- Keywords: Exactly ${maxKeywords || 50} items. ${singleWordKeywords ? "Use strictly single words." : "Mix specific single words and 2-word phrases."}
${isVideo ? "- For video: Include footage-specific terms where appropriate (e.g. 4k, slow motion, drone, b-roll, cinematic, camera motion, action verbs)." : ""}
${silhouette ? "- Asset is a silhouette, emphasize shape and outline." : ""}
${transparentBackground ? "- Isolated on transparent/white background. Include: isolated, cutout, transparent." : ""}
${prohibitedWords ? "- Do NOT use: AI, generated, fake, mockup, template, download." : ""}
${savedKeywords?.length ? `- Mandatory keywords to integrate: ${savedKeywords.join(', ')}` : ""}
${customPromptEnabled && customPrompt ? `- Note: ${customPrompt}` : ""}`;
}
