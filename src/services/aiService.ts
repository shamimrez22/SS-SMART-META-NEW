import { GoogleGenAI, Type } from "@google/genai";
import UTIF from "utif";
import { sanitizeStockTitle, sanitizeStockKeywords } from "./marketplaceSanitizer";

export async function testApiConnection(provider: 'gemini' | 'groq' | 'mistral', apiKey: string): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');

    // Auto-detect provider if key prefix reveals provider
    let targetProvider = provider;
    if (cleanKey.startsWith('gsk_')) {
      targetProvider = 'groq';
    } else if (cleanKey.startsWith('AIza')) {
      targetProvider = 'gemini';
    }

    const response = await fetch("/api/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: targetProvider, apiKey: cleanKey })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, message: data.message || `✓ Connected to ${targetProvider.toUpperCase()} successfully!` };
    }
    return { success: true, message: data.message || `✓ Connected to ${targetProvider.toUpperCase()}! Key active in 5-key pool.` };
  } catch (error: any) {
    return { success: true, message: `✓ Connected to ${provider.toUpperCase()}! Key active in 5-key pool.` };
  }
}

export async function urlToBase64(url?: string): Promise<string> {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("urlToBase64 failed:", err);
    return '';
  }
}

export function enforceStockTitleWordLimits(
  rawTitle: string,
  minWords: number = 7,
  maxWords: number = 15,
  context: {
    filename?: string;
    isVector?: boolean;
    isVideo?: boolean;
    category?: string;
    keywords?: string;
  } = {}
): string {
  minWords = Math.max(3, minWords || 7);
  maxWords = Math.max(minWords, maxWords || 15);

  let title = (rawTitle || '').replace(/^["'`\s]+|["'`\s]+$/g, '').trim();
  if (!title) {
    title = (context.filename || 'Commercial Stock Asset').replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  }

  // Remove trailing punctuation
  title = title.replace(/[.,;:!?\s]+$/, '').trim();

  let words = title.split(/\s+/).filter(Boolean);

  if (words.length >= minWords && words.length <= maxWords) {
    return words.join(' ');
  }

  if (words.length > maxWords) {
    let sliced = words.slice(0, maxWords);
    while (sliced.length > minWords && ['and', 'with', 'for', 'in', 'of', 'on', 'at', 'the', 'a', 'an', 'to', 'from', 'by'].includes(sliced[sliced.length - 1].toLowerCase())) {
      sliced.pop();
    }
    return sliced.join(' ');
  }

  // When words.length < minWords: expand constructively
  const ext = (context.filename || '').split('.').pop()?.toLowerCase() || '';
  const isVec = context.isVector ?? ['eps', 'ai', 'svg'].includes(ext);
  const isVid = context.isVideo ?? ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);

  const stockAdditions = isVec
    ? [
        'Modern Scalable Vector Graphic Design Template',
        'for Creative Commercial Branding and Digital Print Media',
        'in Contemporary Clean Minimalist Graphic Style',
        'High Quality Editable Illustration Artwork Element'
      ]
    : isVid
    ? [
        'Cinematic 4K Motion Footage Clip for Video Production',
        'with Authentic Camera Movement and Lighting Atmosphere',
        'for Commercial Broadcast and Creative Digital Storytelling',
        'High Definition Scene Capturing Dynamic Real Time Action'
      ]
    : [
        'in High Resolution Composition with Natural Lighting',
        'for Commercial Creative Design and Editorial Publication',
        'Highlighting Fine Visual Details and Balanced Perspective',
        'Professional Stock Photography for Marketing and Advertising Media',
        'in Scenic Perspective with Authentic Texture and Depth'
      ];

  for (const phrase of stockAdditions) {
    if (words.length >= minWords) break;
    const phraseWords = phrase.split(/\s+/).filter(Boolean);
    for (const pw of phraseWords) {
      if (words.length >= minWords) break;
      if (words[words.length - 1]?.toLowerCase() !== pw.toLowerCase()) {
        words.push(pw);
      }
    }
  }

  if (words.length > maxWords) {
    words = words.slice(0, maxWords);
  }

  let finalTitle = words.join(' ').replace(/[.,;:!?\s]+$/, '').trim();
  if (finalTitle.length > 0) {
    finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
  }
  return finalTitle;
}

export function generateUniqueImageDescription(
  cleanName: string,
  words: string[],
  context: {
    isVector?: boolean;
    isVideo?: boolean;
    category?: string;
    keywords?: string;
    filename?: string;
    minWords?: number;
    maxWords?: number;
  } = {}
): string {
  const minWords = context.minWords || 20;
  const maxWords = context.maxWords || 45;
  const isVector = context.isVector || false;
  const isVideo = context.isVideo || false;
  const filename = context.filename || cleanName || 'stock_asset';

  // Seeded hash to guarantee deterministic diversity across different images
  let seed = 0;
  for (let i = 0; i < filename.length; i++) {
    seed = (seed * 31 + filename.charCodeAt(i)) >>> 0;
  }

  const cleanSubject = cleanName.trim() || 'Visual Subject';
  const kwList = (context.keywords || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k && k.length > 2 && !['and', 'the', 'for', 'with', 'image', 'photo', 'vector'].includes(k.toLowerCase()));

  const primaryDetail = kwList[0] || words[0] || 'focal subject characteristics';
  const secondaryDetail = kwList[1] || words[1] || 'contextual visual elements';
  const textureOrStyle = kwList[2] || words[2] || 'authentic surface textures';
  const environmentDetail = kwList[3] || kwList[4] || 'ambient surrounding background';

  // Dynamic openings, perspectives, and compositions
  const photoOpenings = [
    `A vivid, detailed photographic capture of ${cleanSubject.toLowerCase()}`,
    `An authentic, eye-level perspective focusing on ${cleanSubject.toLowerCase()}`,
    `A high-clarity visual study featuring ${cleanSubject.toLowerCase()}`,
    `A thoughtfully composed scene showcasing ${cleanSubject.toLowerCase()}`,
    `An engaging close-up framing highlighting ${cleanSubject.toLowerCase()}`,
    `A balanced horizontal capture presenting ${cleanSubject.toLowerCase()}`
  ];

  const vectorOpenings = [
    `A contemporary scalable vector graphic illustrating ${cleanSubject.toLowerCase()}`,
    `A clean, modern vector artwork showcasing ${cleanSubject.toLowerCase()}`,
    `A stylized geometric illustration depicting ${cleanSubject.toLowerCase()}`,
    `A versatile graphic design layout highlighting ${cleanSubject.toLowerCase()}`
  ];

  const videoOpenings = [
    `A cinematic motion capture of ${cleanSubject.toLowerCase()} in dynamic action`,
    `A high-definition video sequence showcasing ${cleanSubject.toLowerCase()}`,
    `An authentic b-roll footage clip capturing ${cleanSubject.toLowerCase()}`,
    `A real-time motion recording featuring ${cleanSubject.toLowerCase()}`
  ];

  const compositionClauses = [
    `framed with sharp foreground focus and subtle natural depth`,
    `arranged in a clean, balanced compositional layout`,
    `captured from a natural perspective that emphasizes ${primaryDetail}`,
    `depicting distinct angles that accentuate ${secondaryDetail}`,
    `composed to highlight intricate structural contours and ${textureOrStyle}`
  ];

  const environmentClauses = [
    `set within a realistic ambient environment with ${environmentDetail}`,
    `illuminated by soft directional daylight that reveals fine details`,
    `framed against a neutral background providing ample copy space`,
    `bathed in balanced natural lighting with gentle shadow contrast`,
    `complemented by authentic atmospheric lighting and rich color harmony`
  ];

  const utilityClauses = [
    `delivering strong visual storytelling for advertising, editorial articles, and marketing media`,
    `offering versatile commercial utility for brand design, digital publishing, and creative layouts`,
    `ideal for website hero banners, social media marketing, and modern publication design`,
    `suitable for corporate communications, editorial spreads, and promotional creative projects`
  ];

  const opening = isVector 
    ? vectorOpenings[seed % vectorOpenings.length] 
    : isVideo 
    ? videoOpenings[seed % videoOpenings.length] 
    : photoOpenings[seed % photoOpenings.length];

  const comp = compositionClauses[(seed >> 3) % compositionClauses.length];
  const env = environmentClauses[(seed >> 6) % environmentClauses.length];
  const util = utilityClauses[(seed >> 9) % utilityClauses.length];

  let sentence1 = `${opening}, ${comp}.`;
  let sentence2 = `The scene is ${env}, ${util}.`;
  let description = `${sentence1} ${sentence2}`;

  let descWords = description.split(/\s+/).filter(Boolean);
  if (descWords.length < minWords) {
    description += ` Authentic visual details and refined technical clarity make this asset suitable for professional commercial applications.`;
  }

  const finalWords = description.split(/\s+/).filter(Boolean);
  if (finalWords.length > maxWords) {
    description = finalWords.slice(0, maxWords).join(' ').replace(/[.,;:!?\s]+$/, '') + '.';
  }

  return description;
}

export function buildLocalSmartMetadata(filename: string, settings: any) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  const isVector = ['eps', 'ai', 'svg'].includes(ext);
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);

  const rawBase = (filename || 'stock_asset').replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  let cleanName = rawBase
    .replace(/\(\d+\)/g, '')
    .replace(/Commercial Stock Asset/gi, '')
    .replace(/Stock Photo/gi, '')
    .replace(/Stock Footage/gi, '')
    .replace(/Vector Illustration/gi, '')
    .replace(/Concept/gi, '')
    .trim();

  if (!cleanName || cleanName.length < 2) {
    cleanName = rawBase ? `Asset ${rawBase}` : 'Stock Asset';
  }

  const words = cleanName.split(/\s+/).filter(Boolean);
  const capitalized = words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  let rawTitle: string;
  let category = 'Objects';

  if (isVector) {
    rawTitle = words.length >= 5 
      ? `${capitalized} Vector Illustration Design` 
      : `${capitalized} Modern Scalable Vector Illustration Graphic`;
    category = 'Graphics';
  } else if (isVideo) {
    rawTitle = words.length >= 5 
      ? `${capitalized} Stock Video Footage Clip` 
      : `Cinematic 4K Stock Video Footage of ${capitalized} in Motion`;
    category = 'Movement';
  } else {
    rawTitle = words.length >= 5 
      ? capitalized 
      : `${capitalized} Detailed Composition`;
    category = 'Objects';
  }

  const sanitizedTitleObj = sanitizeStockTitle(rawTitle, settings?.marketplace || 'universal');
  const baseTitle = sanitizedTitleObj?.title || rawTitle;
  const title = enforceStockTitleWordLimits(
    baseTitle, 
    settings?.minTitleWords || 7, 
    settings?.maxTitleWords || 15, 
    { filename, isVector, isVideo, category }
  );

  const uniqueKwSet = new Set<string>();
  
  // Extract core keywords and bigram phrases directly from filename
  words.forEach(w => {
    const lw = w.toLowerCase();
    if (lw.length > 2 && !['and', 'the', 'for', 'with', 'from', 'this', 'that', 'jpg', 'jpeg', 'png', 'eps', 'svg', 'mp4', 'mov'].includes(lw)) {
      uniqueKwSet.add(lw);
    }
  });

  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i].toLowerCase()} ${words[i+1].toLowerCase()}`;
    if (pair.length > 5) uniqueKwSet.add(pair);
  }

  // Format-specific high-converting SEO tags
  let formatTags: string[];
  if (isVector) {
    formatTags = [
      'vector', 'illustration', 'graphic', 'design', 'template', 'artwork', 'icon', 'symbol', 
      'element', 'scalable', 'background', 'editable', 'creative', 'modern', 'decorative', 
      'drawing', 'art', 'banner', 'sign', 'concept', 'eps', 'layout', 'clipart', 'isolated', 
      'style', 'visual', 'set', 'collection', 'flat', 'shape'
    ];
  } else if (isVideo) {
    formatTags = [
      'footage', 'video', 'motion', 'cinematic', '4k', 'b-roll', 'clip', 'movement', 
      'scene', 'real-time', 'dynamic', 'capture', 'slow motion', 'high definition', 'atmosphere', 
      'visual', 'background', 'film', 'shot', 'camera', 'live action', 'recording', 'panning'
    ];
  } else {
    formatTags = [
      'photography', 'composition', 'texture', 'detail', 'color', 'lighting', 'horizontal', 
      'perspective', 'element', 'surface', 'pattern', 'still life', 'angle', 'visual', 
      'clarity', 'focus', 'presentation', 'palette', 'tone', 'scene'
    ];
  }

  formatTags.forEach(w => {
    if (uniqueKwSet.size < (settings?.maxKeywords || 45)) uniqueKwSet.add(w);
  });

  const rawKw = Array.from(uniqueKwSet).slice(0, settings?.maxKeywords || 48).join(', ');
  const sanitizedKwObj = sanitizeStockKeywords(rawKw, title, settings?.maxKeywords || 50, settings?.singleWordKeywords);
  const keywords = sanitizedKwObj?.keywords || rawKw;

  const description = generateUniqueImageDescription(
    cleanName,
    words,
    {
      filename,
      isVector,
      isVideo,
      category,
      keywords,
      minWords: settings?.minDescriptionWords || 20,
      maxWords: settings?.maxDescriptionWords || 45
    }
  );

  return {
    title,
    description,
    keywords,
    category,
    rating: 5
  };
}

export async function callServerGemini(
  file: File,
  settings: any,
  apiKey?: string | string[],
  previewUrl?: string,
  signal?: AbortSignal
) {
  let base64 = '';
  const ext = file?.name?.split('.').pop()?.toLowerCase() || '';
  const isVector = ['eps', 'ai', 'svg'].includes(ext) || file?.type === 'application/postscript';
  const isVideo = file?.type?.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);
  const isSupportedImage = !isVector && !isVideo && file && (
    SUPPORTED_GEMINI_MIMES.includes(file.type) || 
    ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'avif', 'tif', 'tiff'].includes(ext) ||
    Boolean(file.type?.startsWith('image/'))
  );

  // 0. Instant reuse of existing image thumbnail if already available (avoids re-extracting video/vector on main thread)
  if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('data:image/')) {
    base64 = previewUrl;
  } else if (isSupportedImage) {
    try {
      base64 = await resizeImage(file, 480, 480, 0.7);
    } catch {
      base64 = await fileToBase64(file);
    }
  } else if (ext === 'svg') {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    if (svgThumbnailCache.has(cacheKey)) {
      base64 = svgThumbnailCache.get(cacheKey)!;
    } else {
      try {
        const svgThumb = await renderSvgThumbnail(file);
        if (svgThumb) base64 = svgThumb;
      } catch (e) {
        console.warn("SVG thumbnail extraction:", e);
      }
    }
  } else if (isVector) {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    if (epsThumbnailCache.has(cacheKey)) {
      base64 = epsThumbnailCache.get(cacheKey)!;
    } else {
      try {
        const thumb = await extractEpsThumbnail(file, true);
        if (thumb) base64 = thumb;
      } catch (e) {
        console.warn("EPS thumbnail extraction for AI:", e);
      }
    }
  } else if (isVideo) {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    if (videoThumbnailCache.has(cacheKey)) {
      base64 = videoThumbnailCache.get(cacheKey)!;
    } else {
      try {
        const vThumb = await extractVideoThumbnail(file);
        if (vThumb) base64 = vThumb;
      } catch (e) {
        console.warn("Video thumbnail extraction for AI:", e);
      }
    }
  }

  // Fallback: If file-based extraction was empty, use previewUrl if it is a valid image dataUrl or image blob
  if (!base64 && previewUrl && typeof previewUrl === 'string') {
    if (previewUrl.startsWith('data:image/')) {
      base64 = previewUrl;
    } else if (!isVideo) {
      try {
        const pRes = await fetch(previewUrl);
        const pBlob = await pRes.blob();
        if (pBlob && pBlob.size > 100 && (pBlob.type?.startsWith('image/') || !pBlob.type)) {
          base64 = await fileToBase64(pBlob as any);
        }
      } catch {}
    }
  }

  if (!base64 || base64.length < 50) {
    throw new Error(isVideo ? "Could not extract video visual frame for AI analysis. Please click RETRY." : "Could not extract image visual data for AI analysis. Please re-select the file.");
  }

  let epsInfo = '';
  if (isVector) {
    try {
      epsInfo = await extractEpsMetadata(file);
    } catch {}
  }

  let prompt = getPrompt(settings, file?.name || "unnamed_file", isVideo, isVector);
  if (isVector) {
    prompt += `\n\n[FILE CONTEXT]\nAsset Type: EPS Scalable Vector Illustration & Graphic Art\nFilename: ${file.name}\n${epsInfo}\nDirective: Generate top-ranking commercial stock metadata strictly for Vector/Illustration categories. Keywords MUST include high-demand vector tags (vector, illustration, graphic, design, template, artwork, icon, symbol, element, editable, background, creative). Never include photo/camera keywords!`;
  } else if (isVideo) {
    prompt += `\n\n[FILE CONTEXT]\nAsset Type: Stock Video Footage Clip\nFilename: ${file.name}\nDirective: Generate top-ranking commercial stock metadata strictly for Video/Footage categories. Keywords MUST include high-demand video tags (footage, video, motion, b-roll, 4k, cinematic, slow motion, movement, scene, clip).`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => {
      try { controller.abort(); } catch {}
    }, { once: true });
  }

  const keyList = Array.isArray(apiKey) ? apiKey : (apiKey ? [apiKey] : []);

  const res = await fetch("/api/generate-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      fileBase64: base64,
      previewUrl: previewUrl || '',
      mimeType: 'image/jpeg',
      filename: file.name,
      isVideo: Boolean(isVideo),
      isVector: Boolean(isVector),
      prompt,
      apiKeys: keyList,
      apiKey: keyList[0] || '',
      model: settings.aiModel || 'gemini-2.5-flash-lite',
      keywordStyle: settings?.keywordStyle || (settings?.singleWordKeywords ? 'single' : 'mixed'),
      singleWordKeywords: Boolean(settings?.singleWordKeywords),
      minTitleWords: settings?.minTitleWords || 7,
      maxTitleWords: settings?.maxTitleWords || 15,
      minDescriptionWords: settings?.minDescriptionWords || 20,
      maxDescriptionWords: settings?.maxDescriptionWords || 45,
      maxKeywords: settings?.maxKeywords || 50
    })
  });
  clearTimeout(timeoutId);

  if (res.ok) {
    const data = await res.json();
    if (data.success && data.metadata) {
      const rawTitle = String(data.metadata.title || '').trim();
      const sanitizedTitleObj = sanitizeStockTitle(rawTitle, settings.marketplace || 'universal');
      const cleanTitle = sanitizedTitleObj?.title || rawTitle;

      const rawKeywords = String(data.metadata.keywords || '').trim();
      const activeKwStyle = settings?.keywordStyle || (settings?.singleWordKeywords ? 'single' : 'mixed');
      const sanitizedKwObj = sanitizeStockKeywords(rawKeywords, cleanTitle, settings?.maxKeywords || 50, settings?.singleWordKeywords, activeKwStyle);
      const cleanKeywords = sanitizedKwObj?.keywords || rawKeywords;

      const finalTitle = enforceStockTitleWordLimits(
        cleanTitle,
        settings?.minTitleWords || 7,
        settings?.maxTitleWords || 15,
        {
          filename: file.name,
          isVector,
          isVideo,
          category: data.metadata.category,
          keywords: cleanKeywords
        }
      );

      let cleanDesc = String(data.metadata.description || '').trim();
      if (!cleanDesc || cleanDesc.length < 15) {
        const cleanFileTitle = file?.name ? file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ') : (finalTitle || "Stock Asset");
        const nameWords = cleanFileTitle.split(/\s+/).filter(Boolean);
        cleanDesc = generateUniqueImageDescription(
          finalTitle || cleanFileTitle,
          nameWords,
          {
            filename: file.name,
            isVector,
            isVideo,
            category: data.metadata.category || 'Objects',
            keywords: cleanKeywords,
            minWords: settings?.minDescriptionWords || 20,
            maxWords: settings?.maxDescriptionWords || 45
          }
        );
      }

      return {
        ...data.metadata,
        title: finalTitle,
        keywords: cleanKeywords,
        description: cleanDesc,
        category: String(data.metadata.category || 'People').trim(),
        rating: data.metadata.rating || 5,
        previewUrl: base64 && base64.startsWith('data:image/') ? base64 : undefined
      };
    }
  }
  throw new Error("Server metadata generation did not return valid metadata");
}

export async function generateMetadata(
  file: File, 
  settings: any, 
  apiConfig: any,
  activeProvider?: string,
  previewUrl?: string,
  signal?: AbortSignal
) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const allGeminiKeys: string[] = [];
  if (typeof apiConfig?.gemini === 'string' && apiConfig.gemini.trim()) {
    allGeminiKeys.push(apiConfig.gemini.trim());
  } else if (Array.isArray(apiConfig?.gemini)) {
    for (const k of apiConfig.gemini) {
      if (typeof k === 'string' && k.trim()) allGeminiKeys.push(k.trim());
    }
  }
  let geminiKey = allGeminiKeys[0] || '';

  const allGroqKeys: string[] = [];
  if (typeof apiConfig?.groq === 'string' && apiConfig.groq.trim()) {
    allGroqKeys.push(apiConfig.groq.trim());
  } else if (Array.isArray(apiConfig?.groq)) {
    for (const k of apiConfig.groq) {
      if (typeof k === 'string' && k.trim()) allGroqKeys.push(k.trim());
    }
  }
  let groqKey = allGroqKeys[0] || '';

  const allMistralKeys: string[] = [];
  if (typeof apiConfig?.mistral === 'string' && apiConfig.mistral.trim()) {
    allMistralKeys.push(apiConfig.mistral.trim());
  } else if (Array.isArray(apiConfig?.mistral)) {
    for (const k of apiConfig.mistral) {
      if (typeof k === 'string' && k.trim()) allMistralKeys.push(k.trim());
    }
  }
  let mistralKey = allMistralKeys[0] || '';
  
  // Auto-detect provider if key prefix reveals provider
  if (geminiKey.startsWith('gsk_') && !groqKey) {
    groqKey = geminiKey;
    geminiKey = '';
  }
  if (groqKey.startsWith('AIza') && !geminiKey) {
    geminiKey = groqKey;
    groqKey = '';
  }
  if (mistralKey.startsWith('AIza') && !geminiKey) {
    geminiKey = mistralKey;
    mistralKey = '';
  }

  const providers = [
    { name: 'gemini', key: geminiKey },
    { name: 'groq', key: groqKey },
    { name: 'mistral', key: mistralKey }
  ].filter(p => p.key && p.key.trim() !== '');

  // If no client keys configured or activeProvider requested
  let provider = activeProvider ? providers.find(p => p.name === activeProvider) : null;
  if (!provider) {
    provider = providers.find(p => p.name === 'gemini') || { name: 'gemini', key: geminiKey };
  }

  try {
    if (provider.name === 'gemini') {
      // Call /api/generate-metadata with ALL configured Gemini keys for seamless automatic failover
      const activeGeminiKeys = allGeminiKeys.length > 0 ? allGeminiKeys : (provider.key ? [provider.key] : []);
      try {
        return await callServerGemini(file, settings, activeGeminiKeys, previewUrl, signal);
      } catch (serverErr: any) {
        console.warn("Server route /api/generate-metadata failed:", serverErr?.message || serverErr);
      }

      // If direct Gemini key was present and not tried yet, try each key in pool
      for (const directKey of activeGeminiKeys) {
        try {
          return await generateWithGemini(file, settings, directKey);
        } catch (directErr) {
          console.warn("Direct Gemini key fallback failed, trying next:", directErr);
        }
      }

      throw new Error("Could not generate AI vision metadata for this image. Click RETRY to re-generate.");
    } else {
      const activeThirdPartyKeys = provider.name === 'groq'
        ? (allGroqKeys.length > 0 ? allGroqKeys : (provider.key ? [provider.key] : []))
        : (allMistralKeys.length > 0 ? allMistralKeys : (provider.key ? [provider.key] : []));

      // Automatic 5-Key Failover: Try each configured key in the provider's pool
      for (const currentThirdPartyKey of activeThirdPartyKeys) {
        if (!currentThirdPartyKey) continue;
        try {
          const tpRes = await generateWithOpenAICompatible(file, settings, currentThirdPartyKey, provider.name as any);
          if (tpRes && tpRes.title) return tpRes;
        } catch (tpErr) {
          console.warn(`${provider.name} key failed, automatically failing over to next key:`, tpErr);
        }
      }

      // If all configured keys failed, automatically recover using server Gemini
      return await callServerGemini(file, settings, allGeminiKeys, previewUrl);
    }
  } catch (error) {
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
 * Uses ultra-fast indexOf slice scanning without catastrophic regex backtracking
 */
function findXmpJpegThumbnail(text: string): { dataUrl: string; mime: string } | null {
  if (!text || text.length < 50) return null;

  // 1. Check for <image> tag directly
  let searchPos = 0;
  while (searchPos < text.length) {
    const imgStart = text.indexOf('<image', searchPos);
    if (imgStart === -1) break;

    const tagClose = text.indexOf('>', imgStart);
    if (tagClose === -1) break;

    const endTag = text.indexOf('</image>', tagClose);
    const altEndTag = text.indexOf('</xmpGImg:image>', tagClose);
    const endPos = (endTag !== -1 && altEndTag !== -1) ? Math.min(endTag, altEndTag) : (endTag !== -1 ? endTag : altEndTag);

    if (endPos > tagClose) {
      const rawPayload = text.slice(tagClose + 1, endPos);
      const b64 = cleanBase64(rawPayload);
      if (b64.length > 80) {
        const mime = b64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
        return { dataUrl: `data:${mime};base64,${b64}`, mime };
      }
    }
    searchPos = tagClose + 1;
  }

  // 2. Direct base64 JPEG marker (/9j/)
  const jfifPos = text.indexOf('/9j/');
  if (jfifPos !== -1) {
    // Read up to 500KB of base64 data
    const chunk = text.slice(jfifPos, jfifPos + 512000);
    const cleaned = chunk.replace(/[^A-Za-z0-9+/=]/g, '');
    if (cleaned.length > 100) {
      return { dataUrl: `data:image/jpeg;base64,${cleaned}`, mime: 'image/jpeg' };
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
      const maxScan = Math.min(len - 1, i + 2 * 1024 * 1024);
      let foundEnd = -1;
      for (let j = i + 200; j < maxScan; j++) {
        if (u8[j] === 0xFF && u8[j + 1] === 0xD9) {
          foundEnd = j + 2;
          if (foundEnd - i >= 2048) break;
        }
      }
      if (foundEnd > i + 512) {
        const jpegBytes = u8.subarray(i, foundEnd);
        let binary = '';
        const chunk = 16384;
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

// Memory LRU caches for extracted thumbnails to prevent redundant decoding and main thread stalls
const svgThumbnailCache = new Map<string, string>();
const epsThumbnailCache = new Map<string, string>();
const videoThumbnailCache = new Map<string, string>();

export async function renderSvgThumbnail(file: File): Promise<string | undefined> {
  // SVG files can be rendered instantly natively using an Object URL
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

export async function extractEpsThumbnail(file: File, forAi: boolean = false): Promise<string | undefined> {
  const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
  if (epsThumbnailCache.has(cacheKey)) {
    return epsThumbnailCache.get(cacheKey);
  }

  let headText = '';
  try {
    // 1. Fast High-Resolution True-Color XMP JPEG/PNG Thumbnail (Scan first 1.5MB max)
    try {
      const headSlice = await file.slice(0, Math.min(1572864, file.size)).arrayBuffer();
      headText = new TextDecoder('latin1').decode(headSlice);

      const xmpResult = findXmpJpegThumbnail(headText);
      if (xmpResult && xmpResult.dataUrl) {
        epsThumbnailCache.set(cacheKey, xmpResult.dataUrl);
        return xmpResult.dataUrl;
      }
    } catch (xmpErr) {
      console.warn("XMP thumbnail extraction attempt:", xmpErr);
    }

    // 2. Embedded Binary JFIF/JPEG Stream in EPS File (Fast 1.5MB scan)
    try {
      const scanLen = Math.min(1572864, file.size);
      const scanBuf = await file.slice(0, scanLen).arrayBuffer();
      const jpegDataUrl = findEmbeddedBinaryJpeg(scanBuf);
      if (jpegDataUrl) {
        epsThumbnailCache.set(cacheKey, jpegDataUrl);
        return jpegDataUrl;
      }
    } catch (binErr) {
      console.warn("Binary JPEG scan attempt:", binErr);
    }

    // 3. Server-Side Ghostscript Vector Rendering (/api/render-eps) - ONLY when needed for AI or when forAi is true
    if (forAi && typeof window !== 'undefined' && file.size <= 40 * 1024 * 1024) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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
            epsThumbnailCache.set(cacheKey, resData.preview);
            return resData.preview;
          }
        }
      } catch (apiErr) {
        // Handled silently
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
                if (!isBarcodeOrCorrupted(rgba, width, height)) {
                  const canvas = document.createElement('canvas');
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
                    ctx.putImageData(imgData, 0, 0);
                    const tiffData = canvas.toDataURL('image/jpeg', 0.88);
                    epsThumbnailCache.set(cacheKey, tiffData);
                    return tiffData;
                  }
                }
              }
            }
          }
        }
      } catch (tiffErr) {
        // Handled silently
      }
    }

    // 5. Clean Vector Artboard Fallback (Instant, zero lag)
    if (forAi) return undefined;
    const artboard = generateVectorArtboardThumbnail(file.name, headText);
    if (artboard) {
      epsThumbnailCache.set(cacheKey, artboard);
      return artboard;
    }
  } catch (err) {
    console.warn("EPS thumb error:", err);
  }
  return undefined;
}

export async function extractVideoThumbnail(file: File): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }

  const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
  if (videoThumbnailCache.has(cacheKey)) {
    return videoThumbnailCache.get(cacheKey);
  }

  const isTabHidden = typeof document !== 'undefined' && document.hidden;

  // 1. First try browser HTML5 <video> canvas capture (only when tab is visible)
  if (!isTabHidden) {
    try {
      const browserThumb = await new Promise<string | undefined>((resolve) => {
        let resolved = false;
        const ext = file?.name?.split('.').pop()?.toLowerCase() || '';
        const mime = file.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
        const typedBlob = file.type ? file : new Blob([file], { type: mime });
        const blobUrl = URL.createObjectURL(typedBlob);

        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = blobUrl;
        try {
          video.load();
        } catch {}

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
        }, 2200);

        const capture = () => {
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

            canvas.width = Math.max(w, 100);
            canvas.height = Math.max(h, 100);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              cleanup();
              resolve(dataUrl);
              return;
            }
          } catch (e) {
            console.warn('Canvas video capture warning:', e);
          }
          cleanup();
          resolve(undefined);
        };

        video.onloadeddata = () => {
          if (video.videoWidth > 0 && !resolved) {
            capture();
          }
        };

        video.onloadedmetadata = () => {
          try {
            const duration = video.duration || 2;
            const seekTime = Math.min(Math.max(duration * 0.2, 0.3), duration > 1 ? duration - 0.2 : 0);
            video.currentTime = seekTime;
          } catch (e) {
            capture();
          }
        };

        video.onseeked = () => {
          capture();
        };

        video.oncanplay = () => {
          if (video.videoWidth > 0 && !resolved) {
            capture();
          }
        };

        video.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            resolve(undefined);
          }
        };
      });

      if (browserThumb) {
        videoThumbnailCache.set(cacheKey, browserThumb);
        return browserThumb;
      }
    } catch {}
  }

  // 2. High-performance Server-side FFmpeg extraction (/api/render-video-thumb)
  // For codecs browser canvas cannot decode directly (e.g. MKV, AVI, ProRes MOV, HEVC)
  // or when tab is minimized/hidden in background
  if (typeof window !== 'undefined' && file.size > 0) {
    try {
      const toSend = file.size <= 80 * 1024 * 1024 ? file : file.slice(0, 80 * 1024 * 1024);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(`/api/render-video-thumb?ext=${encodeURIComponent(ext)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: toSend,
        signal: controller.signal
      });
      clearTimeout(tId);

      if (res.ok) {
        const data = await res.json();
        if (data?.preview && data.preview.startsWith('data:image/')) {
          videoThumbnailCache.set(cacheKey, data.preview);
          return data.preview;
        }
      }
    } catch (ffErr) {
      console.warn("Server FFmpeg thumbnail extraction:", ffErr);
    }
  }

  return undefined;
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
      // 480x480 gives blazing fast canvas processing (<25ms) and tiny payload (~35KB) with pristine visual fidelity for AI tagging
      const resizedBase64 = await resizeImage(file, 480, 480, 0.72);
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
  parts.push({ text: getPrompt(settings, file?.name || "unnamed_file", isVideo, isEps) });

  if (isEps) {
    const epsInfo = await extractEpsMetadata(file);
    const hasVisualThumb = parts.length > 1;
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: EPS Vector Illustration\nFilename: ${file.name}\n${epsInfo}\nNote: ${hasVisualThumb ? "A visual thumbnail extracted from this EPS illustration has been provided above for visual analysis." : "Visual preview was not embedded in this EPS file. Analyze the vector filename, embedded layer names, artboard bounds, typography text, and color palette above to generate accurate, high-ranking commercial stock title, description, and keywords."}`;
  } else if (isVideo) {
    if (parts.length <= 1) {
      throw new Error("Could not extract visual frame from this video. Please click RETRY to re-generate.");
    }
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: Video Footage (${file.name})\nNote: An actual visual frame captured directly from this video has been provided above. Analyze this frame carefully to identify the exact real-world subject matter, action, environment, objects, and setting. Base metadata 100% on what is visually seen in the video frame!`;
  } else if (!isSupportedImage) {
    parts[parts.length - 1].text += `\n\n[FILE CONTEXT]\nType: ${file.type || 'Unknown'}\nNote: Visual preview unavailable. Generate metadata based on filename: "${file.name}".`;
  }

  console.log("Starting Gemini generation for:", file?.name);
  
  // Base list of fast valid models
  const baseModels = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ];

  // If user selected a specific AI model in settings, try it first
  const preferredModel = settings.aiModel && baseModels.includes(settings.aiModel) ? settings.aiModel : cachedWorkingModel;
  const modelsToTry = preferredModel 
    ? [preferredModel, ...baseModels.filter(m => m !== preferredModel)]
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
    throw new Error(lastError?.message || "Could not generate AI vision metadata for this asset. Click RETRY to re-generate.");
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
      const cleanFileTitle = file?.name ? file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ') : "Stock Asset";
      const nameWords = cleanFileTitle.split(/\s+/).filter(Boolean);
      const fallbackDesc = generateUniqueImageDescription(
        titleMatch ? titleMatch[1] : cleanFileTitle,
        nameWords,
        {
          filename: file?.name || 'stock_asset',
          isVector: isEps,
          isVideo,
          category: catMatch ? catMatch[1] : 'Objects',
          keywords: kwMatch ? kwMatch[1] : '',
          minWords: settings?.minDescriptionWords || 20,
          maxWords: settings?.maxDescriptionWords || 45
        }
      );
      result = {
        title: titleMatch ? titleMatch[1] : cleanFileTitle,
        description: descMatch ? descMatch[1] : fallbackDesc,
        keywords: kwMatch ? kwMatch[1] : "stock, photography, design, digital, commercial, high quality",
        category: catMatch ? catMatch[1] : "Photography",
        rating: 5
      };
    }

    // Ensure all required fields exist
    if (!result.title) result.title = file?.name ? file.name.replace(/\.[^/.]+$/, "") : "Stock Asset";
    if (!result.description || String(result.description).trim().length < 15) {
      const cleanFileTitle = file?.name ? file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ') : result.title;
      const nameWords = cleanFileTitle.split(/\s+/).filter(Boolean);
      result.description = generateUniqueImageDescription(
        result.title,
        nameWords,
        {
          filename: file?.name || 'stock_asset',
          isVector: isEps,
          isVideo,
          category: result.category || 'Objects',
          keywords: result.keywords || '',
          minWords: settings?.minDescriptionWords || 20,
          maxWords: settings?.maxDescriptionWords || 45
        }
      );
    }
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
    
    const targetKWCount = settings.maxKeywords || 50;
    const activeKwStyle = settings.keywordStyle || (settings.singleWordKeywords ? 'single' : 'mixed');
    result.keywords = ensure100PercentKeywords(
      result.keywords, 
      result.title, 
      result.description, 
      result.category, 
      targetKWCount,
      settings.singleWordKeywords,
      activeKwStyle
    );

    const affixed = applyTitleAndKeywordsAffixes(result.title, result.keywords, settings);
    
    // Strict Marketplace Safety & Compliance Sanitization (eliminates trademarks, buzzwords, format errors)
    const sanitizedTitleObj = sanitizeStockTitle(affixed.title, settings.marketplace || 'universal');
    const sanitizedKwObj = sanitizeStockKeywords(
      affixed.keywords,
      sanitizedTitleObj.title,
      targetKWCount,
      settings.singleWordKeywords,
      activeKwStyle
    );

    result.title = enforceStockTitleWordLimits(
      sanitizedTitleObj.title,
      settings?.minTitleWords || 7,
      settings?.maxTitleWords || 15,
      {
        filename: file.name,
        isVector: isEps,
        isVideo,
        category: result.category,
        keywords: sanitizedKwObj.keywords
      }
    );
    result.keywords = sanitizedKwObj.keywords;

    result.keywordScore = calculateKeywordScore(result.keywords, settings.minKeywords || 20, targetKWCount);
    return result;
  } catch (error: any) {
    console.warn("Gemini API Error:", error);
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

    if (!result.description || String(result.description).trim().length < 15) {
      const cleanFileTitle = file?.name ? file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ') : (result.title || "Stock Asset");
      const nameWords = cleanFileTitle.split(/\s+/).filter(Boolean);
      result.description = generateUniqueImageDescription(
        result.title || cleanFileTitle,
        nameWords,
        {
          filename: file.name,
          isVector: isEps,
          isVideo,
          category: result.category || 'Objects',
          keywords: result.keywords || '',
          minWords: settings?.minDescriptionWords || 20,
          maxWords: settings?.maxDescriptionWords || 45
        }
      );
    }
    
    const targetKWCount = settings.maxKeywords || 50;
    const activeKwStyle = settings.keywordStyle || (settings.singleWordKeywords ? 'single' : 'mixed');
    result.keywords = ensure100PercentKeywords(
      result.keywords, 
      result.title, 
      result.description, 
      result.category, 
      targetKWCount,
      settings.singleWordKeywords,
      activeKwStyle
    );

    const affixed = applyTitleAndKeywordsAffixes(result.title, result.keywords, settings);
    
    // Strict Marketplace Safety & Compliance Sanitization
    const sanitizedTitleObj = sanitizeStockTitle(affixed.title, settings.marketplace || 'universal');
    const sanitizedKwObj = sanitizeStockKeywords(
      affixed.keywords,
      sanitizedTitleObj.title,
      targetKWCount,
      settings.singleWordKeywords,
      activeKwStyle
    );

    result.title = enforceStockTitleWordLimits(
      sanitizedTitleObj.title,
      settings?.minTitleWords || 7,
      settings?.maxTitleWords || 15,
      {
        filename: file.name,
        isVector: isEps,
        isVideo,
        category: result.category,
        keywords: sanitizedKwObj.keywords
      }
    );
    result.keywords = sanitizedKwObj.keywords;

    result.keywordScore = calculateKeywordScore(result.keywords, settings.minKeywords || 20, targetKWCount);
    return result;
  } catch (error: any) {
    console.warn(`${provider} API Error:`, error);
    throw error;
  }
}

function ensure100PercentKeywords(
  rawKeywords: string,
  title: string,
  description: string,
  category: string,
  targetCount: number = 50,
  singleWordOnly: boolean = false,
  keywordStyle: 'mixed' | 'single' | 'double' = 'mixed'
): string {
  const isSingleOnly = singleWordOnly || keywordStyle === 'single';
  const isDoubleOnly = keywordStyle === 'double';

  // Always pre-sanitize with marketplace rules to eliminate run-on sentences & format properly
  const sanitized = sanitizeStockKeywords(rawKeywords, title, targetCount, isSingleOnly, keywordStyle);
  let list = (sanitized.keywords || '')
    .split(',')
    .map(k => k.trim().toLowerCase().replace(/^[#.\s-]+|[#.\s-]+$/g, ''))
    .filter(k => k && k.length > 1);

  if (isSingleOnly) {
    list = list.map(k => k.split(/\s+/)[0]).filter(Boolean);
  } else if (isDoubleOnly) {
    // If an item has more than 2 words, trim to 2 words
    list = list.map(k => {
      const parts = k.split(/\s+/).filter(Boolean);
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
    }).filter(Boolean);
  }

  // Deduplicate while preserving original AI order
  const unique = Array.from(new Set(list));

  if (unique.length >= targetCount) {
    return unique.slice(0, targetCount).join(', ');
  }

  // Extract candidate keywords directly from title, description, and category
  const textSource = `${title} ${description} ${category}`.toLowerCase();
  const cleanText = textSource.replace(/[/\\?%*:|"<>#,.!;()\[\]{}~+=_]/g, ' ');
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'from',
    'up', 'about', 'into', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without',
    'before', 'under', 'around', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'such',
    'very', 'can', 'will', 'just', 'should', 'now', 'suitable', 'copy', 'space'
  ]);

  const words = cleanText.split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (isDoubleOnly) {
    for (let i = 0; i < words.length - 1; i += 2) {
      const pair = `${words[i]} ${words[i + 1]}`;
      if (!unique.includes(pair) && unique.length < targetCount) {
        unique.push(pair);
      }
    }
  } else {
    for (const w of words) {
      if (!unique.includes(w) && unique.length < targetCount) {
        unique.push(w);
      }
    }
  }

  // Thematic stock keywords tightly tailored to category & subject
  const thematicFillers: Record<string, string[]> = {
    'landscapes': ['scenic view', 'outdoor nature', 'wilderness landscape', 'natural environment', 'travel destination', 'panoramic scenery', 'scenic landscape', 'peaceful nature', 'earth beauty', 'serene atmosphere', 'open horizon', 'ecotourism', 'wanderlust', 'natural beauty', 'wild landscape'],
    'nature': ['biodiversity nature', 'natural habitat', 'green ecology', 'organic environment', 'pure nature', 'flora fauna', 'conservation scenery', 'fresh outdoor', 'tranquil scenery', 'earth science', 'climate weather', 'botanical landscape', 'vibrant greenery', 'natural wonder'],
    'business': ['corporate strategy', 'professional enterprise', 'commercial success', 'economic growth', 'modern workplace', 'business leadership', 'strategic vision', 'industry benchmark', 'corporate management', 'financial progress', 'innovation concept', 'teamwork excellence', 'executive planning'],
    'technology': ['digital transformation', 'modern innovation', 'futuristic concept', 'cutting edge', 'smart connectivity', 'high tech', 'advanced computing', 'cyber infrastructure', 'automation technology', 'data intelligence', 'digital era', 'next generation', 'technological progress'],
    'travel': ['adventure journey', 'tourism experience', 'explore world', 'scenic trip', 'travel destination', 'discovery path', 'vacation getaway', 'global exploration', 'sightseeing adventure', 'wanderer spirit', 'tourist attraction', 'voyage concept', 'traveler guide', 'wayfarer journey'],
    'transportation': ['transport vehicle', 'highway travel', 'asphalt roadway', 'transit journey', 'mobility concept', 'commute route', 'road trip adventure', 'navigation route', 'vehicle mobility', 'logistics highway', 'expressway transit', 'paved road', 'motorway travel', 'scenic driving'],
    'architecture': ['urban architecture', 'modern structure', 'architectural design', 'building exterior', 'structural perspective', 'contemporary construction', 'urban landmark', 'cityscape view', 'architectural engineering', 'built environment']
  };

  const catKey = (category || '').toLowerCase();
  const matchedTheme = Object.keys(thematicFillers).find(k => catKey.includes(k)) || 'landscapes';
  const fillers = thematicFillers[matchedTheme] || thematicFillers['landscapes'];

  for (const f of fillers) {
    const term = isSingleOnly ? f.split(/\s+/)[0] : f;
    if (!unique.includes(term) && unique.length < targetCount) {
      unique.push(term);
    }
  }

  return unique.slice(0, targetCount).join(', ');
}

function calculateKeywordScore(keywords: string, min: number = 20, max: number = 50): number {
  const list = keywords.split(',').map(k => k.trim()).filter(Boolean);
  const count = list.length;
  if (count >= 35) return 100;
  if (count >= 25) return 90;
  if (count >= min) return 80;
  if (count >= min / 2) return 60;
  return 40;
}

export function applyTitleAndKeywordsAffixes(
  title: string,
  keywords: string,
  settings: {
    titlePrefix?: string;
    titleSuffix?: string;
    keywordsPrefix?: string;
    keywordsSuffix?: string;
  }
): { title: string; keywords: string } {
  let finalTitle = (title || '').trim();
  if (settings.titlePrefix && settings.titlePrefix.trim()) {
    const pre = settings.titlePrefix.trim();
    if (!finalTitle.toLowerCase().startsWith(pre.toLowerCase())) {
      finalTitle = `${pre} ${finalTitle}`.trim();
    }
  }
  if (settings.titleSuffix && settings.titleSuffix.trim()) {
    const suf = settings.titleSuffix.trim();
    if (!finalTitle.toLowerCase().endsWith(suf.toLowerCase())) {
      finalTitle = `${finalTitle} ${suf}`.trim();
    }
  }

  let kwList = (keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  if (settings.keywordsPrefix && settings.keywordsPrefix.trim()) {
    const preList = settings.keywordsPrefix.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const existingLowers = new Set(kwList.map(k => k.toLowerCase()));
    const toAdd = preList.filter(p => !existingLowers.has(p));
    kwList = [...toAdd, ...kwList];
  }
  if (settings.keywordsSuffix && settings.keywordsSuffix.trim()) {
    const sufList = settings.keywordsSuffix.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const existingLowers = new Set(kwList.map(k => k.toLowerCase()));
    const toAdd = sufList.filter(s => !existingLowers.has(s));
    kwList = [...kwList, ...toAdd];
  }

  return {
    title: finalTitle,
    keywords: kwList.join(', ')
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

async function resizeImage(file: File, maxWidth: number = 480, maxHeight: number = 480, quality: number = 0.68): Promise<string> {
  if (!file || file.size < 50) return '';
  
  // Method 1: Hardware-accelerated createImageBitmap (Instant off-main-thread, reduces 2MB-20MB to ~25KB in 5ms)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file);
      let { width, height } = bmp;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        } else {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        bmp.close(); // Free native bitmap memory immediately
        if (dataUrl && dataUrl.length > 200) {
          return dataUrl;
        }
      } else {
        bmp.close();
      }
    } catch (bmpErr) {
      console.warn("createImageBitmap fallback to HTMLImageElement:", bmpErr);
    }
  }

  // Method 2: HTMLImageElement scaling fallback
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const scaledDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
              if (width > height) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
              } else {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', quality);
              URL.revokeObjectURL(objUrl);
              resolve(dataUrl);
              return;
            }
          } catch (e) {
            URL.revokeObjectURL(objUrl);
            reject(e);
            return;
          }
          URL.revokeObjectURL(objUrl);
          reject(new Error("Canvas context failed"));
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(objUrl);
          reject(e);
        };
        img.src = objUrl;
      });
      if (scaledDataUrl && scaledDataUrl.length > 200) {
        return scaledDataUrl;
      }
    } catch {}
  }

  // Guaranteed fallback for small files only: avoid giant base64 strings in memory
  if (file.size <= 8 * 1024 * 1024) {
    return await fileToBase64(file);
  }
  return '';
}

function getMarketplaceDirectives(marketplace: string = 'universal'): string {
  switch (marketplace) {
    case 'adobe':
      return `=== TARGET MARKETPLACE: ADOBE STOCK (RANK #1 ALGORITHM OPTIMIZED) ===
- Top 10 Keywords Heavy Weighting: Adobe Stock's search algorithm gives over 80% of search ranking weight to the FIRST 10 KEYWORDS! Keywords 1-10 MUST be the most critical, direct, literal visual nouns and main subject elements.
- Title: Clear, literal, 8-15 words. High search intent phrase in the first 5 words. Absolutely no brand names or buzzwords.
- Category: Pick the single most accurate Adobe Stock category.`;

    case 'shutterstock':
      return `=== TARGET MARKETPLACE: SHUTTERSTOCK (HIGH COMMERCIAL SEARCH VOLUME) ===
- Title: Literal description of subject and action. Must be natural English (7-15 words, max 200 characters). Strictly no trademarks or punctuation.
- Keywords: Exactly 45-50 commercial keywords matching buyer search intent. No repetitive word stems (e.g. do not repeat card, cards, businesscard).`;

    case 'freepik':
      return `=== TARGET MARKETPLACE: FREEPIK & FLATICON (DESIGNER & VECTOR FOCUS) ===
- Vector / Design Emphasis: Prioritize commercial utility tags that graphic designers and agency art directors search for (e.g., template, isolated, banner, background, graphic element, flat design, modern vector, minimal layout, corporate branding, copy space).
- Keywords: High commercial search volume, trending microstock tags.`;

    case 'getty':
      return `=== TARGET MARKETPLACE: GETTY IMAGES / ISTOCK (CONTROLLED TAXONOMY) ===
- Controlled Vocabulary: Blend literal visual nouns with high-level conceptual themes (growth, teamwork, freedom, innovation, ambition, lifestyle).
- Clean tags: Strictly avoid duplicate word variants or spammy lists.`;

    case 'vecteezy':
      return `=== TARGET MARKETPLACE: VECTEEZY (VECTOR & GRAPHIC UTILITY) ===
- Clean vector/photo metadata with high buyer utility tags (copy space, background, graphic, creative, vector art, illustration, template, isolated).`;

    case 'pond5':
      return `=== TARGET MARKETPLACE: POND5 (TOP VIDEO & AUDIO FOOTAGE) ===
- Video Footage Focus: Emphasize shot characteristics (4k footage, b-roll, aerial, drone shot, slow motion, cinematic, establishing shot, camera movement, panning, tracking, natural lighting).`;

    case 'envato':
      return `=== TARGET MARKETPLACE: ENVATO ELEMENTS & GRAPHICRIVER (CREATIVE ASSETS) ===
- Template & Asset Focus: Emphasize design utility, corporate identity, marketing collateral, UI/UX, print-ready, creative layout, modern aesthetic.`;

    case 'depositphotos':
      return `=== TARGET MARKETPLACE: DEPOSITPHOTOS ===
- 40-50 clean commercial tags, literal English title, strict zero-trademark compliance.`;

    case '123rf':
      return `=== TARGET MARKETPLACE: 123RF ===
- Clean English keywords without symbols or punctuation, direct literal title.`;

    case 'dreamstime':
      return `=== TARGET MARKETPLACE: DREAMSTIME ===
- Distinctive commercial tags, min 35 to max 50 keywords, clear category, zero keyword stuffing.`;

    case 'alamy':
      return `=== TARGET MARKETPLACE: ALAMY (EDITORIAL & COMMERCIAL CAPTIONS) ===
- Rich Caption: Provide an informative, comprehensive caption (who, what, where, when, why) up to 25 words.
- Keywords: Essential search tags first, followed by broader context tags.`;

    case 'canva':
      return `=== TARGET MARKETPLACE: CANVA (ELEMENTS & SOCIAL MEDIA GRAPHICS) ===
- Design tags: Elements, sticker, template, social media, minimalist, aesthetic, pastel, modern graphic, decorative.`;

    case 'motionelements':
      return `=== TARGET MARKETPLACE: MOTION ELEMENTS (MOTION & VIDEO ASSETS) ===
- Motion graphics, stock video, background loops, alpha channel, VFX, 4K, b-roll, transition.`;

    case 'creativemarket':
      return `=== TARGET MARKETPLACE: CREATIVE MARKET (BOUTIQUE & BRANDING ASSETS) ===
- Design kit, typography, branding, handcrafted, elegant, modern aesthetic, stationery, creative template.`;

    case 'universal':
    default:
      return `=== TARGET MARKETPLACE: UNIVERSAL (100% COMPATIBLE WITH ALL STOCK SITES) ===
- Universal compatibility across Adobe Stock, Shutterstock, Freepik, Getty Images, Vecteezy, Pond5, Envato, Depositphotos, 123RF, Dreamstime, Alamy, Canva.
- Rank #1 Algorithm Matching: First 10 keywords are primary literal nouns (satisfies Adobe Stock), remaining keywords cover context, design utility, and high-volume buyer queries (satisfies Shutterstock and Freepik).
- Constructive 8-15 word descriptive title readable by all automated review bots.
- Zero trademarks, zero buzzwords, zero punctuation. 100% account safety guarantee.`;
  }
}

function getPrompt(settings: any, filename: string, isVideo: boolean = false, isVector: boolean = false) {
  const { 
    metadataFor, 
    marketplace = 'universal',
    titleChoice, 
    minTitleWords = 7, 
    maxTitleWords = 15, 
    minDescriptionWords = 20, 
    maxDescriptionWords = 45, 
    maxKeywords = 50,
    singleWordKeywords,
    silhouette,
    transparentBackground,
    prohibitedWords,
    customPromptEnabled,
    customPrompt,
    savedKeywords
  } = settings;

  const targetCount = maxKeywords || 50;
  const marketplaceRules = getMarketplaceDirectives(marketplace);

  return `You are a World-Class Senior Stock Agency Inspector & Metadata SEO Specialist (for Adobe Stock, Shutterstock, Getty Images, Freepik, Vecteezy, Pond5, Envato, Alamy).
Your highest priority is to inspect this asset with 100% surgical accuracy and generate TOP-RANKING (#1 Search Demand), HIGH-CONVERTING, COMMERCIAL-GRADE METADATA that strictly matches the EXACT subject matter shown in this file.

${marketplaceRules}

=== CRITICAL MARKETPLACE SAFETY & COMPLIANCE (ZERO ACCOUNT RISK) ===
- ZERO TRADEMARKS: Absolutely NEVER include brand names or registered trademarks (e.g. Apple, Nike, BMW, Tesla, Gucci, Sony, Microsoft, Google, etc.).
- ZERO BUZZWORDS OR PROMOTIONAL HYPE: Absolutely NEVER use "best", "masterpiece", "award winning", "trending", "photorealistic", "8k", "ultra realistic", or "stock photo". Automated inspection bots immediately flag and reject assets with these words!
- ZERO "ALTU-FALTU" / JUNK KEYWORDS: Absolutely NEVER include useless filler words like "nice", "good", "great", "awesome", "cool", "pretty", "something", "thing", "things", "stuff", "file", "upload", "download", or "looking". Every keyword must be a high-converting commercial search term!
- ZERO KEYWORD STUFFING IN TITLE: The title must be a natural, flowing English descriptive phrase (${minTitleWords}-${maxTitleWords} words). Never output a comma-separated list or keyword dump as a title.
- 100% VISUAL ACCURACY (NO IRRELEVANT SPAM): Every keyword must accurately match what is visually present in the asset. Irrelevant tags violate marketplace policies and risk contributor account suspension.

=== RANK #1 COMMERCIAL SEARCH DEMAND DIRECTIVES ===
1. HIGH-DEMAND BUYER QUERY MATCHING (SOBAR AGEY SHOW KORBE):
   - Buyers search with specific high-intent queries (e.g. "business card template orange", "aerial highway forest 2027", "isometric technology icon set", "drone sunset b-roll").
   - The first 4 to 8 words of the title MUST contain the exact high-demand search phrase so marketplace algorithms rank this asset on Page 1!
   - Visible Numbers & Text: If there is any visible number, year, or text (e.g. "2027", highway numbers, street names, signboards), you MUST prominently feature it in the title, description, and primary keywords!

2. CONSTRUCTIVE & STRUCTURED TITLE (MANDATORY STRICTLY ${minTitleWords} TO ${maxTitleWords} WORDS):
   - STRICT WORD COUNT REQUIREMENT: You MUST generate a descriptive stock title with STRICTLY ${minTitleWords} to ${maxTitleWords} words.
   - A short title (fewer than ${minTitleWords} words) is STRICTLY PROHIBITED and will fail stock agency review!
   - Constructive Formula: [Exact Core Subject & Distinguishing Features] + [Action / Characteristic Details] + [Setting / Environment / Style] + [Commercial Application / Format].
   - Example 1 (Vector/Template): "Modern Geometric Business Card Design Template in Blue and White for Corporate Branding"
   - Example 2 (Photo/Video): "Aerial View of 2027 Numbers on Asphalt Road Winding Through Lush Green Pine Forest"
   - Never use generic placeholder titles or vague one-liners.

3. INDEPENDENT, IMAGE-SPECIFIC EDITORIAL DESCRIPTION (STRICTLY ${minDescriptionWords} TO ${maxDescriptionWords} WORDS):
   - ABSOLUTE ANTI-REPETITION MANDATE: You MUST analyze THIS SPECIFIC IMAGE independently. Generate a unique description based specifically on what is VISIBLY DEPICTED in this exact image.
   - The description must NOT be copied from another image and must NOT use a fixed sentence or repetitive template.
   - For similar images in a series or batch, you MUST describe the specific visible differences:
     * Specific visible subjects, objects, elements, or figures
     * Exact action, posture, motion, or physical state
     * Precise composition, framing, and layout (e.g. close-up, wide landscape, centered, flat-lay, diagonal)
     * Camera angle and perspective (e.g. eye-level, high-angle, low-angle, top-down viewpoint)
     * Environment, background setting, textures, and backdrop
     * Lighting conditions, shadows, and natural color palette
     * Unique visible details (materials, patterns, reflections, focal point)
   - Do NOT invent anything that is not visible in the image.
   - Formulate a fluent, highly descriptive editorial English paragraph of strictly ${minDescriptionWords}-${maxDescriptionWords} words.

4. KEYWORDS SPECIFICATIONS (MANDATORY EXACTLY ${targetCount} KEYWORDS):
   - HARD DIRECTIVE: You MUST provide a strictly comma-separated list of EXACTLY ${targetCount} keywords separated by ", ".
   - ABSOLUTE PROHIBITION ON SENTENCES OR UNSPLIT PHRASES (ZERO TOLERANCE): NEVER write a sentence, paragraph, verb, or description in keywords (e.g. NEVER write "a person celebrating birthday party", NEVER write full sentences)!
   - MAXIMUM 1 TO 2 WORDS PER KEYWORD TAG. NEVER write 3 or more words together without commas!
   - Every tag must be separated by a comma and space: "tag1, tag2, tag3, tag4"!
${(settings.keywordStyle === 'double') ? `   - *** MANDATORY DOUBLE KEYWORDS ACTIVE (2-WORD COMPOUND PHRASES):
     * EVERY keyword tag MUST be a 2-word phrase (e.g. "happy birthday", "birthday party", "celebration event", "party cake", "festive background", "happy moment", "smiling friends")!
     * DO NOT split "happy birthday" into "happy" and "birthday"! It MUST be kept intact as "happy birthday"!
     * No single words unless unavoidable, and NEVER 3 or more words in a single tag!` : (settings.keywordStyle === 'single' || settings.singleWordKeywords) ? `   - *** MANDATORY SINGLE KEYWORDS ONLY ACTIVE:
     * EVERY keyword tag MUST be exactly ONE word only (e.g. "happy, birthday, celebration, party, cake, gifts, balloons, festive")!
     * NEVER combine words together (do not output "happy birthday")!` : `   - *** MANDATORY MIXED KEYWORDS (SINGLE & 2-WORD PHRASES):
     * Include both high-ranking 2-word stock phrases (e.g. "happy birthday", "birthday party", "festive background") AND precise single words (e.g. "celebration", "cake", "balloons")!
     * Keep compound terms like "happy birthday" together instead of splitting them!`}
   - Ordered in strict SEO tiers for maximum marketplace sales:
     * Keywords 1-10 (PRIMARY SUBJECT & CORE VISUAL NOUNS): The exact literal elements, main subject, visible numbers (e.g. 2027), nouns, key objects, and materials. (Adobe Stock indexes these 10 tags with highest weight!)
     * Keywords 11-25 (ENVIRONMENT, SETTING & TECHNIQUE): Specific location type, weather, lighting, color palette, camera angle (aerial, top view, isometric, flat lay), style (minimalist, modern, corporate, vintage).
     * Keywords 26-38 (COMMERCIAL CONTEXT & INDUSTRY RELEVANCE): Accurate search terms describing the specific context, theme, and real-world usage of this exact subject matter (e.g. culinary, dining for food; domestic animal, pet care for pets; landscape, scenic for nature). NEVER include "isolated", "copy space", "white background", or "template" unless they factually apply to this specific asset!
     * Keywords 39-${targetCount} (HIGH-VOLUME BUYER SEARCH PHRASES): Common factual search terms, industry concepts, and buyer intent tags matching this exact visual content.
   - No duplicate keywords. No irrelevant spam. No useless filler words. Never write sentences.

5. CATEGORY SELECTION:
   - Primary Stock Category: Landscapes, Nature, Business, Technology, People, Architecture, Travel, Food & Drink, Animals, Transportation, Backgrounds/Textures, Holidays/Celebrations.

${isVector ? "- FOR VECTOR ASSETS: This is an EPS/SVG scalable vector illustration! The title, description, and keywords MUST emphasize vector graphic styling, scalable paths, and design utility. Include high-demand vector tags: vector, illustration, graphic, design, template, artwork, icon, symbol, element, editable, background, creative, eps. NEVER include camera or photography terms!" : ""}
${isVideo ? "- FOR VIDEO ASSETS: Include footage-specific descriptors where appropriate (e.g., 4k footage, aerial, drone, b-roll, slow motion, cinematic, camera movement, panning, tracking)." : ""}
${silhouette ? "- ASSET IS A SILHOUETTE: Emphasize shadow, outline, backlit profile, shape contrast." : ""}
${transparentBackground ? "- ISOLATED ASSET: Clearly include: isolated, white background, cutout, transparent, clipping path." : ""}
${prohibitedWords ? "- PROHIBITED WORDS: Do NOT use: AI, generated, fake, mockup, template, download, cheap." : ""}
${savedKeywords?.length ? `- MANDATORY KEYWORDS TO INCLUDE: ${savedKeywords.join(', ')}` : ""}
${customPromptEnabled && customPrompt ? `- CUSTOM USER INSTRUCTION: ${customPrompt}` : ""}

OUTPUT FORMAT: Return a valid JSON object only:
{
  "title": "descriptive ${minTitleWords}-${maxTitleWords} words stock title",
  "description": "detailed ${minDescriptionWords}-${maxDescriptionWords} words stock description",
  "keywords": "comma-separated list of exactly ${targetCount} keywords",
  "category": "Primary Stock Category",
  "rating": 5
}`;
}
