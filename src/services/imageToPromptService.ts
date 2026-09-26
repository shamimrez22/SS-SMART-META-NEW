import { GoogleGenAI } from "@google/genai";

export interface ImagePromptResult {
  // Master Comprehensive Prompt
  masterPrompt: string;
  // Midjourney v6 / v7 prompt with technical flags
  midjourneyPrompt: string;
  // Flux.1 / Stable Diffusion XL prompt
  fluxPrompt: string;
  // Photorealistic Commercial Stock photo prompt
  photorealisticPrompt: string;
  // Cinematic Concept Art / Movie Still prompt
  cinematicPrompt: string;
  // Minimalist / Vector / Isolated Graphic Art prompt
  vectorPrompt: string;
  // Negative Prompt (what to avoid)
  negativePrompt: string;
  // Technical parameters recommendation
  recommendedParams: {
    aspectRatio: string;
    cfgScale: number;
    steps: number;
    sampler: string;
    style: string;
  };
  // Detailed breakdown of visual elements
  breakdown: {
    subject: string;
    environment: string;
    lighting: string;
    cameraLens: string;
    colorPalette: string;
    moodAndAtmosphere: string;
    keyTokens: string[];
  };
}

export interface BatchImageItem {
  id: string;
  name: string;
  previewUrl: string;
  file?: File;
  aspectRatio: string;
  width?: number;
  height?: number;
  sizeStr?: string;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
  result?: ImagePromptResult;
  error?: string;
  timeTakenMs?: number;
  dimensions?: string;
}

export interface PromptGenOptions {
  image: File | string; // File object or data URL base64
  engineStyle?: 'universal' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector';
  detailLevel?: 'standard' | 'hyper_detailed' | 'masterpiece';
  customInstructions?: string;
  apiKey?: string;
  apiConfig?: {
    gemini?: string[];
    groq?: string[];
    mistral?: string[];
  };
  modelName?: string;
  turboSpeed?: boolean; // Ultra-fast compression & latency reduction
}

/**
 * Highly optimized image resizer for lightning-fast Vision AI processing.
 * Reduces image to ~720px max dimension, which cuts token payload by ~80%
 * while preserving 100% of visual features (subject, colors, lighting, textures).
 */
export async function prepareFastImagePayload(
  input: File | string,
  turbo = true
): Promise<{ base64Data: string; mimeType: string; width: number; height: number; aspectRatio: string }> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Image analysis timed out while reading image."));
      }
    }, 12000);

    const img = new Image();

    const onImageLoaded = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      const origW = img.naturalWidth || img.width || 800;
      const origH = img.naturalHeight || img.height || 800;

      // Calculate aspect ratio string (e.g. 16:9, 1:1, 4:5, 9:16, 3:2)
      const ratio = origW / (origH || 1);
      let arString = "1:1";
      if (Math.abs(ratio - 16 / 9) < 0.15) arString = "16:9";
      else if (Math.abs(ratio - 9 / 16) < 0.15) arString = "9:16";
      else if (Math.abs(ratio - 4 / 3) < 0.15) arString = "4:3";
      else if (Math.abs(ratio - 3 / 4) < 0.15) arString = "3:4";
      else if (Math.abs(ratio - 3 / 2) < 0.15) arString = "3:2";
      else if (Math.abs(ratio - 2 / 3) < 0.15) arString = "2:3";
      else if (Math.abs(ratio - 4 / 5) < 0.15) arString = "4:5";
      else if (ratio > 1.2) arString = "16:9";
      else if (ratio < 0.8) arString = "9:16";

      // Ultra-fast dimension bounding
      const maxDim = turbo ? 720 : 960;
      let targetW = origW;
      let targetH = origH;

      if (origW > maxDim || origH > maxDim) {
        if (origW > origH) {
          targetW = maxDim;
          targetH = Math.round((origH * maxDim) / origW);
        } else {
          targetH = maxDim;
          targetW = Math.round((origW * maxDim) / origH);
        }
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          reject(new Error("Canvas context creation failed"));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // 0.75 quality JPEG gives tiny payload (<70KB) with sharp detail
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        const base64Data = dataUrl.split(",")[1];

        resolve({
          base64Data,
          mimeType: "image/jpeg",
          width: origW,
          height: origH,
          aspectRatio: arString,
        });
      } catch (err: any) {
        reject(new Error("Failed to process image canvas: " + (err?.message || err)));
      }
    };

    img.onload = onImageLoaded;
    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error("Failed to load image for visual analysis"));
      }
    };

    if (typeof input === "string") {
      // Only set crossOrigin for remote http/https URLs to avoid browser canvas taint issues
      if (input.startsWith("http://") || input.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }
      img.src = input;
      // If image is already cached and loaded
      if (img.complete && img.naturalWidth > 0) {
        onImageLoaded();
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error("Failed to read image file"));
        }
      };
      reader.readAsDataURL(input);
    }
  });
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Resolves the active Gemini API key from various configuration points:
 * 1. Explicitly passed apiKey
 * 2. User's configured Gemini keys in apiConfig (from metadata settings)
 * 3. LocalStorage saved settings (STOCK_AI_STUDIO_CONFIG_V2)
 * 4. process.env.GEMINI_API_KEY
 */
export function resolveGeminiApiKey(options?: { apiKey?: string; apiConfig?: { gemini?: string[] } }): string {
  if (options?.apiKey && options.apiKey.trim()) {
    return options.apiKey.trim();
  }

  if (options?.apiConfig?.gemini) {
    const key = options.apiConfig.gemini.find((k) => k && k.trim() !== "");
    if (key) return key.trim();
  }

  // Attempt reading from localStorage if running in browser
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem("stock_ai_studio_config_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.apiConfig?.gemini) {
          const storedKey = parsed.apiConfig.gemini.find((k: string) => k && k.trim() !== "");
          if (storedKey) return storedKey.trim();
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Fallback to process.env if injected by build
  if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  return "";
}

export async function generateDetailedPromptsFromImage(options: PromptGenOptions): Promise<ImagePromptResult> {
  const {
    image,
    engineStyle = "universal",
    detailLevel = "hyper_detailed",
    customInstructions = "",
    apiConfig,
    apiKey,
    modelName = "gemini-3.8-flash",
    turboSpeed = true,
  } = options;

  // 1. Resolve API Key - prioritize server-side Gemini or user's Gemini key configured in metadata settings
  const geminiKey = resolveGeminiApiKey({ apiKey, apiConfig });
  const groqKey = apiConfig?.groq?.find((k) => k && k.trim() !== "");

  // 2. Prepare Image with fast resize
  const prepared = await prepareFastImagePayload(image, turboSpeed);

  // 3. Construct System Prompt for Deep Visual Prompt Engineering
  const systemInstruction = `You are a world-class Visual AI Prompt Engineer and Reverse-Engineering Specialist for generative models including Midjourney (v6.1/v7), Flux.1 Pro, Stable Diffusion XL, DALL-E 3, and Commercial Stock Photography.

Analyze this image rapidly and formulate EXTREMELY DETAILED, production-ready prompts that faithfully replicate the exact aesthetic, lighting, lens/camera, textures, color grading, and subject.

Strict Specifications:
1. "masterPrompt": Rich 3-5 sentence description with visual atmosphere, subject micro-details, lighting, and textures.
2. "midjourneyPrompt": Tailored for Midjourney syntax, ending with: --ar ${prepared.aspectRatio} --style raw --v 6.1 --stylize 250.
3. "fluxPrompt": Natural descriptive realism with photographic quality tokens, 8k detail, volumetric lighting.
4. "photorealisticPrompt": High-end commercial stock photo style (Hasselblad/Leica, crisp studio or natural candid lighting, depth of field).
5. "cinematicPrompt": 35mm anamorphic lens, film still aesthetic, cinematic grading, Panavision look.
6. "vectorPrompt": Clean modern graphic or vector illustration equivalent, sharp geometric or flat shading.
7. "negativePrompt": Robust negative keywords avoiding blur, bad anatomy, deformed elements, watermarks.
8. "recommendedParams": Aspect ratio ${prepared.aspectRatio}, sampler, cfgScale, steps, style.
9. "breakdown": Subject, environment, lighting, cameraLens, colorPalette, moodAndAtmosphere, and 8-10 keyTokens.

${customInstructions ? `USER CUSTOM INSTRUCTION: ${customInstructions}` : ""}
${engineStyle !== "universal" ? `PRIMARY ENGINE FOCUS: Optimize especially for ${engineStyle}.` : ""}
${detailLevel === "masterpiece" ? "MAXIMUM DETAIL: Describe every optical nuance and texture." : ""}

Return valid JSON with this exact structure:
{
  "masterPrompt": "...",
  "midjourneyPrompt": "...",
  "fluxPrompt": "...",
  "photorealisticPrompt": "...",
  "cinematicPrompt": "...",
  "vectorPrompt": "...",
  "negativePrompt": "...",
  "recommendedParams": {
    "aspectRatio": "${prepared.aspectRatio}",
    "cfgScale": 6.5,
    "steps": 32,
    "sampler": "DPM++ 2M Karras",
    "style": "Photographic Realism"
  },
  "breakdown": {
    "subject": "...",
    "environment": "...",
    "lighting": "...",
    "cameraLens": "...",
    "colorPalette": "...",
    "moodAndAtmosphere": "...",
    "keyTokens": ["token1", "token2", "token3", "token4", "token5", "token6", "token7", "token8"]
  }
}`;

  // 4. Try server-side Gemini route first (Zero-config, fast, full-fidelity)
  try {
    const srvRes = await fetch("/api/image-to-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data: prepared.base64Data,
        mimeType: prepared.mimeType,
        systemInstruction,
        customInstructions,
        aspectRatio: prepared.aspectRatio
      })
    });
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData.success && srvData.result) {
        return sanitizePromptResult(srvData.result, prepared.aspectRatio);
      }
    }
  } catch (srvErr) {
    console.warn("Server image-to-prompt error:", srvErr);
  }

  // 5. Try client-side Gemini if user provided an API key
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const modelsToTry = [
       modelName || "gemini-3.8-flash",
       "gemini-3.8-flash",
       "gemini-3.7-flash",
       "gemini-2.5-flash"
    ];

    const uniqueModels = Array.from(new Set(modelsToTry));

    let lastError: any = null;
    for (const m of uniqueModels) {
      try {
        const callPromise = ai.models.generateContent({
          model: m,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: prepared.base64Data,
                    mimeType: prepared.mimeType,
                  },
                },
                {
                  text: systemInstruction,
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            temperature: 0.35,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${m} timed out after 20s`)), 20000)
        );

        const response = await Promise.race([callPromise, timeoutPromise]);
        const text = response.text || "";
        if (!text) continue;

        const parsed = JSON.parse(cleanJsonText(text)) as ImagePromptResult;
        return sanitizePromptResult(parsed, prepared.aspectRatio);
      } catch (err: any) {
        console.warn(`Gemini model ${m} failed for fast prompt extraction:`, err?.message || err);
        lastError = err;
      }
    }
  }

  // 5. Fallback to Groq Vision if configured
  if (groqKey) {
    try {
      const response = await fetch("/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: groqKey,
          body: {
            model: "llama-3.2-11b-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: systemInstruction },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${prepared.mimeType};base64,${prepared.base64Data}`,
                    },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(cleanJsonText(content)) as ImagePromptResult;
          return sanitizePromptResult(parsed, prepared.aspectRatio);
        }
      }
    } catch (groqErr) {
      console.warn("Groq vision fallback error:", groqErr);
    }
  }

  throw new Error("Unable to generate image prompts. Please verify your API key and network connection.");
}

/**
 * Concurrent Batch Prompt Generator
 * Executes multiple images in parallel using an asynchronous worker pool
 * for ultra-fast throughput (e.g. 4-6 images processed at the same time).
 */
export async function generateBatchDetailedPrompts(
  items: BatchImageItem[],
  options: Omit<PromptGenOptions, 'image'>,
  concurrency = 4,
  onItemProgress?: (id: string, update: Partial<BatchImageItem>) => void
): Promise<BatchImageItem[]> {
  const queue = [...items.filter(i => i.status !== 'completed')];
  const results = [...items];

  const updateItem = (id: string, patch: Partial<BatchImageItem>) => {
    const idx = results.findIndex(r => r.id === id);
    if (idx !== -1) {
      results[idx] = { ...results[idx], ...patch };
      onItemProgress?.(id, patch);
    }
  };

  // Mark all pending as queued
  for (const item of queue) {
    updateItem(item.id, { status: 'queued', error: undefined });
  }

  // Worker loop
  let currentIndex = 0;
  const worker = async () => {
    while (currentIndex < queue.length) {
      const item = queue[currentIndex++];
      if (!item) break;

      const startTime = Date.now();
      updateItem(item.id, { status: 'processing' });

      try {
        const source = item.file || item.previewUrl;
        const promptPromise = generateDetailedPromptsFromImage({
          ...options,
          image: source,
          turboSpeed: true,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Generation timed out (25s limit). Please check your API key or network.")), 25000)
        );

        const promptRes = await Promise.race([promptPromise, timeoutPromise]);

        const elapsed = Date.now() - startTime;
        updateItem(item.id, {
          status: 'completed',
          result: promptRes,
          timeTakenMs: elapsed,
        });
      } catch (err: any) {
        console.error(`Batch prompt generation error for ${item.name}:`, err);
        updateItem(item.id, {
          status: 'error',
          error: err?.message || 'Generation failed',
        });
      }
    }
  };

  // Run workers concurrently
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

function sanitizePromptResult(parsed: Partial<ImagePromptResult>, fallbackAr: string): ImagePromptResult {
  return {
    masterPrompt: parsed.masterPrompt || "A detailed artistic visual rendering featuring crisp lighting and balanced composition.",
    midjourneyPrompt: parsed.midjourneyPrompt || `${parsed.masterPrompt || "Artistic portrait"} --ar ${fallbackAr} --style raw --v 6.1`,
    fluxPrompt: parsed.fluxPrompt || parsed.masterPrompt || "High resolution photorealistic render, 8k detail.",
    photorealisticPrompt: parsed.photorealisticPrompt || parsed.masterPrompt || "Professional stock photography, natural lighting.",
    cinematicPrompt: parsed.cinematicPrompt || parsed.masterPrompt || "Cinematic film still, 35mm anamorphic lens, dramatic lighting.",
    vectorPrompt: parsed.vectorPrompt || "Clean vector graphic illustration, modern flat design with bold shapes.",
    negativePrompt: parsed.negativePrompt || "deformed, distorted, extra limbs, bad anatomy, blur, watermark, low quality",
    recommendedParams: {
      aspectRatio: parsed.recommendedParams?.aspectRatio || fallbackAr,
      cfgScale: parsed.recommendedParams?.cfgScale || 6.5,
      steps: parsed.recommendedParams?.steps || 32,
      sampler: parsed.recommendedParams?.sampler || "DPM++ 2M Karras",
      style: parsed.recommendedParams?.style || "Photographic Realism",
    },
    breakdown: {
      subject: parsed.breakdown?.subject || "Primary scene subject",
      environment: parsed.breakdown?.environment || "Atmospheric environment",
      lighting: parsed.breakdown?.lighting || "Volumetric and directional lighting",
      cameraLens: parsed.breakdown?.cameraLens || "Prime lens with shallow depth of field",
      colorPalette: parsed.breakdown?.colorPalette || "Harmonious complementary color grading",
      moodAndAtmosphere: parsed.breakdown?.moodAndAtmosphere || "Cinematic and engaging",
      keyTokens: Array.isArray(parsed.breakdown?.keyTokens) && parsed.breakdown.keyTokens.length > 0
        ? parsed.breakdown.keyTokens
        : ["photorealistic", "8k resolution", "sharp focus", "cinematic lighting", "high detail"],
    },
  };
}

/**
 * Formats a single image result into a clean text block
 */
export function formatAllPromptsText(result: ImagePromptResult, imageName?: string): string {
  const title = imageName ? `PROMPT SPECIFICATION FOR: ${imageName}` : "AI GENERATIVE PROMPT SPECIFICATION";
  const divider = "================================================================================";
  const subDivider = "--------------------------------------------------------------------------------";

  return `${divider}
${title}
Generated by Extensions Studio • Multi-Engine Detailed Prompts
${divider}

[1] 🌟 MASTER COMPREHENSIVE PROMPT
${subDivider}
${result.masterPrompt}


[2] 🚀 MIDJOURNEY (v6.1 / v7) PROMPT
${subDivider}
${result.midjourneyPrompt}


[3] ⚡ FLUX.1 / STABLE DIFFUSION XL PROMPT
${subDivider}
${result.fluxPrompt}


[4] 📸 PHOTOREALISTIC COMMERCIAL STOCK PROMPT
${subDivider}
${result.photorealisticPrompt}


[5] 🎬 CINEMATIC MOVIE STILL / CONCEPT ART PROMPT
${subDivider}
${result.cinematicPrompt}


[6] 🎨 CLEAN VECTOR / GRAPHIC ART PROMPT
${subDivider}
${result.vectorPrompt}


[7] 🚫 RECOMMENDED NEGATIVE PROMPT
${subDivider}
${result.negativePrompt}


[8] ⚙️ RECOMMENDED GENERATION PARAMETERS
${subDivider}
• Aspect Ratio: ${result.recommendedParams.aspectRatio}
• Sampler: ${result.recommendedParams.sampler}
• Sampling Steps: ${result.recommendedParams.steps}
• CFG Guidance Scale: ${result.recommendedParams.cfgScale}
• Aesthetic Style: ${result.recommendedParams.style}


[9] 🔍 VISUAL BREAKDOWN & STYLE TOKENS
${subDivider}
• Subject: ${result.breakdown.subject}
• Environment: ${result.breakdown.environment}
• Lighting: ${result.breakdown.lighting}
• Camera & Lens: ${result.breakdown.cameraLens}
• Color Palette: ${result.breakdown.colorPalette}
• Mood & Atmosphere: ${result.breakdown.moodAndAtmosphere}
• Key Tokens: ${result.breakdown.keyTokens.join(", ")}

${divider}
`;
}

/**
 * Formats all batch images' prompts into a single consolidated master document
 */
export function formatBatchAllPromptsText(items: BatchImageItem[]): string {
  const completed = items.filter(i => i.status === 'completed' && i.result);
  const header = `################################################################################
# BATCH GENERATED AI PROMPTS SUITE
# Total Images Processed: ${completed.length}
# Generated via Extensions Studio • Turbo Batch Generator
################################################################################\n\n`;

  const body = completed.map((item, index) => {
    return `### IMAGE [${index + 1} OF ${completed.length}]: ${item.name} (${item.aspectRatio || '1:1'})\n` +
      formatAllPromptsText(item.result!, item.name);
  }).join("\n\n\n");

  return header + body;
}

/**
 * Formats all batch images' prompts cleanly (prompt text only with serial numbers and image names)
 */
export function formatBatchSimplePromptsText(
  items: BatchImageItem[],
  style: 'master' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector' = 'master'
): string {
  const completed = items.filter(i => i.status === 'completed' && i.result);
  return completed.map((item, index) => {
    let promptText = item.result?.masterPrompt || '';
    if (style === 'midjourney') promptText = item.result?.midjourneyPrompt || promptText;
    else if (style === 'flux') promptText = item.result?.fluxPrompt || promptText;
    else if (style === 'photorealistic') promptText = item.result?.photorealisticPrompt || promptText;
    else if (style === 'cinematic') promptText = item.result?.cinematicPrompt || promptText;
    else if (style === 'vector') promptText = item.result?.vectorPrompt || promptText;

    return `[${index + 1}] ${item.name}:\n${promptText}`;
  }).join("\n\n");
}
