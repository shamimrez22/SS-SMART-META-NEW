import { GoogleGenAI, Type } from "@google/genai";

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
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.8-flash"
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

export async function extractEpsThumbnail(file: File): Promise<string | undefined> {
  try {
    // Read a larger chunk to find XMP (up to 512KB as XMP can be deep in complex files)
    const buffer = await file.slice(0, 524288).arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    
    // Look for xmpGImg:image which contains base64 thumbnail (common in Adobe EPS)
    const thumbMatch = text.match(/<xmpGImg:image>([\s\S]*?)<\/xmpGImg:image>/i);
    if (thumbMatch) {
      const base64 = thumbMatch[1].replace(/\s/g, '');
      return `data:image/jpeg;base64,${base64}`;
    }
    
    return undefined;
  } catch (e) {
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
    // Read a larger chunk to find more metadata (64KB)
    const buffer = await file.slice(0, 65536).arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    
    const titleMatch = text.match(/%%Title:\s*(.*)/i);
    const creatorMatch = text.match(/%%Creator:\s*(.*)/i);
    const keywordsMatch = text.match(/%%Keywords:\s*(.*)/i);
    const subjectMatch = text.match(/%%Subject:\s*(.*)/i);
    
    let info = "";
    if (titleMatch) info += `Title Hint: ${titleMatch[1].trim()}\n`;
    if (creatorMatch) info += `Creator Hint: ${creatorMatch[1].trim()}\n`;
    if (subjectMatch) info += `Subject Hint: ${subjectMatch[1].trim()}\n`;
    if (keywordsMatch) info += `Keywords Hint: ${keywordsMatch[1].trim()}\n`;

    // Look for XML metadata (XMP) which is often embedded in modern EPS
    const xmpMatch = text.match(/<x:xmpmeta[^>]*>([\s\S]*?)<\/x:xmpmeta>/i);
    if (xmpMatch) {
      const xmp = xmpMatch[1];
      const dcTitle = xmp.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
      const dcDesc = xmp.match(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
      if (dcTitle) info += `XMP Title: ${dcTitle[1].trim()}\n`;
      if (dcDesc) info += `XMP Description: ${dcDesc[1].trim()}\n`;
    }
    
    return info;
  } catch (e) {
    return "";
  }
}

// Cache the last successful model to avoid failing through unsupported models on every single image
let cachedWorkingModel: string | null = null;

async function generateWithGemini(file: File, settings: any, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const ext = file?.name.split('.').pop()?.toLowerCase() || '';
  const isSupportedImage = file && (SUPPORTED_GEMINI_MIMES.includes(file.type) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext));
  const isEps = file && (ext === 'eps' || file.type === 'application/postscript' || file.type === 'image/x-eps');
  const isVideo = file && (file.type.startsWith('video/') || ['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(ext));

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
    const thumbnail = await extractEpsThumbnail(file);
    if (thumbnail) {
      parts.push({
        inlineData: {
          data: thumbnail.split(',')[1],
          mimeType: 'image/jpeg'
        }
      });
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
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: EPS Vector Illustration\n${epsInfo}\nNote: ${parts.length > 1 ? "A visual thumbnail has been provided for analysis." : "Visual preview unavailable for this EPS file. Use the filename and metadata hints to generate accurate stock metadata."}`;
  } else if (isVideo) {
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: Video Footage (${file.name})\nNote: ${parts.length > 1 ? "An actual visual frame captured directly from this video has been provided above. Analyze this frame carefully to identify the exact real-world subject matter, action, environment, objects, and setting." : "Visual preview unavailable. Generate metadata based on filename: " + file.name}`;
  } else if (!isSupportedImage) {
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: ${file.type || 'Unknown'}\nNote: Visual preview unavailable. Generate metadata based on filename: "${file.name}".`;
  }

  console.log("Starting Gemini generation for:", file?.name);
  
  // Base list of fast models
  const baseModels = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.6-flash",
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
  const isSupportedImage = file && (SUPPORTED_GEMINI_MIMES.includes(file.type) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext));
  const isEps = file && (ext === 'eps' || file.type === 'application/postscript' || file.type === 'image/x-eps');
  const isVideo = file && (file.type.startsWith('video/') || ['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(ext));

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
    imageData = await extractEpsThumbnail(file);
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
  // Groq: llama-3.2-90b-vision is the current stable vision model
  const model = provider === 'groq' 
    ? (imageData ? "llama-3.2-90b-vision" : "llama-3.3-70b-versatile")
    : (imageData ? "pixtral-12b-2409" : "mistral-small-latest");

  const prompt = getPrompt(settings, file?.name || "unnamed_file", isVideo);
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
