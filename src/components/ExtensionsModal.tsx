import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Download,
  Upload,
  Image as ImageIcon,
  SlidersHorizontal,
  RefreshCw,
  Zap,
  Film,
  Camera,
  Layers,
  Wand2,
  AlertCircle,
  Tag,
  Palette,
  Maximize2,
  Minimize2,
  Compass,
  Trash2,
  CheckCircle2,
  Clock,
  Play,
  FileText,
  ChevronRight,
  ChevronLeft,
  Plus,
  ZoomIn,
  Shield
} from 'lucide-react';
import { StockMetadata, ApiConfig } from '../types';
import {
  ImagePromptResult,
  BatchImageItem,
  generateDetailedPromptsFromImage,
  generateBatchDetailedPrompts,
  formatAllPromptsText,
  formatBatchAllPromptsText,
  formatBatchSimplePromptsText
} from '../services/imageToPromptService';
import { cn } from '../lib/utils';

interface ExtensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceFiles: StockMetadata[];
  fileObjects?: Record<string, File>;
  apiConfig: ApiConfig;
  activeKey?: { provider: 'gemini' | 'groq' | 'mistral'; index: number };
  activeModel?: string;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  initialTab?: 'hub' | 'image-to-prompt' | 'prompt-expander' | 'palette-scout' | 'upscaler-advisor';
  onOpenAdmin?: () => void;
  onAdminStatusChanged?: () => void;
}

export const ExtensionsModal: React.FC<ExtensionsModalProps> = ({
  isOpen,
  onClose,
  workspaceFiles,
  fileObjects,
  apiConfig,
  activeKey,
  activeModel = 'gemini-3.8-flash',
  showNotification,
  initialTab = 'hub',
  onOpenAdmin,
  onAdminStatusChanged
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'hub' | 'image-to-prompt' | 'prompt-expander' | 'palette-scout' | 'upscaler-advisor'>(initialTab || 'hub');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  // Active Gemini API key resolved from user's settings
  const activeGeminiKey = useMemo(() => {
    if (activeKey?.provider === 'gemini' && apiConfig?.gemini?.[activeKey.index]) {
      return apiConfig.gemini[activeKey.index].trim();
    }
    return apiConfig?.gemini?.find((k) => k && k.trim() !== '') || '';
  }, [apiConfig, activeKey]);

  // Multi-Image Batch State
  const [batchItems, setBatchItems] = useState<BatchImageItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [batchCopied, setBatchCopied] = useState(false);

  // Per-item prompt engine style selector: 'master' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector' | 'negative'
  const [itemPromptStyle, setItemPromptStyle] = useState<Record<string, 'master' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector' | 'negative'>>({});
  const [globalStyleView, setGlobalStyleView] = useState<'master' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector'>('master');
  const [showTuningDrawer, setShowTuningDrawer] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [copyMode, setCopyMode] = useState<'clean' | 'detailed'>('clean');

  // Generation Settings
  const [targetEngine, setTargetEngine] = useState<'universal' | 'midjourney' | 'flux' | 'photorealistic' | 'cinematic' | 'vector'>('universal');
  const [detailLevel, setDetailLevel] = useState<'standard' | 'hyper_detailed' | 'masterpiece'>('hyper_detailed');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(activeModel || 'gemini-3.8-flash');
  const [concurrency, setConcurrency] = useState<number>(4);

  // Text Prompt Expander Tab State
  const [expanderIdea, setExpanderIdea] = useState('');
  const [expandedResults, setExpandedResults] = useState<{ midjourney: string; photorealistic: string; cinematic: string } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);

  // Upscaler & Standards Advisor State
  const [calcWidth, setCalcWidth] = useState<number>(3840);
  const [calcHeight, setCalcHeight] = useState<number>(2160);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-listen to Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clipboard paste support for images
  useEffect(() => {
    if (!isOpen || activeTab !== 'image-to-prompt') return;

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const imageFiles: File[] = [];
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          }
        }
        if (imageFiles.length > 0) {
          addFilesToBatch(imageFiles);
          showNotification(`${imageFiles.length} image(s) pasted from clipboard!`, 'info');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, activeTab, batchItems]);

  // Derived current active item
  const activeItem = useMemo(() => {
    if (!activeItemId && batchItems.length > 0) {
      return batchItems[0];
    }
    return batchItems.find((item) => item.id === activeItemId) || batchItems[0] || null;
  }, [batchItems, activeItemId]);

  // Batch Statistics
  const batchStats = useMemo(() => {
    const total = batchItems.length;
    const completed = batchItems.filter((i) => i.status === 'completed').length;
    const processing = batchItems.filter((i) => i.status === 'processing').length;
    const queued = batchItems.filter((i) => i.status === 'queued').length;
    const error = batchItems.filter((i) => i.status === 'error').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, processing, queued, error, percent };
  }, [batchItems]);

  if (!isOpen) return null;

  // Add multiple files to batch
  const addFilesToBatch = (files: File[]) => {
    const newItems: BatchImageItem[] = [];

    files.forEach((file) => {
      const id = 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const objectUrl = URL.createObjectURL(file);

      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const item: BatchImageItem = {
        id,
        name: file.name,
        previewUrl: objectUrl,
        file,
        aspectRatio: '1:1',
        sizeStr,
        status: 'idle',
      };

      // Measure dimensions asynchronously
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const ratio = w / h;
        let aspect = '1:1';
        if (Math.abs(ratio - 16 / 9) < 0.15) aspect = '16:9';
        else if (Math.abs(ratio - 9 / 16) < 0.15) aspect = '9:16';
        else if (Math.abs(ratio - 4 / 3) < 0.15) aspect = '4:3';
        else if (Math.abs(ratio - 3 / 4) < 0.15) aspect = '3:4';
        else if (Math.abs(ratio - 3 / 2) < 0.15) aspect = '3:2';
        else if (ratio > 1.2) aspect = '16:9';
        else if (ratio < 0.8) aspect = '9:16';

        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, width: w, height: h, aspectRatio: aspect, dimensions: `${w} × ${h}` }
              : it
          )
        );
      };
      img.src = objectUrl;

      newItems.push(item);
    });

    setBatchItems((prev) => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
    }
  };

  // Add individual workspace file
  const handleAddWorkspaceAsset = (asset: StockMetadata) => {
    if (!asset.previewUrl) return;

    // Check if already in batch
    if (batchItems.some((i) => i.previewUrl === asset.previewUrl)) {
      showNotification(`"${asset.filename}" is already in the batch list!`, 'info');
      return;
    }

    const id = 'ws_' + asset.id;
    const realFile = fileObjects?.[asset.id];
    const newItem: BatchImageItem = {
      id,
      file: realFile,
      name: asset.originalFilename || asset.filename,
      previewUrl: asset.previewUrl,
      aspectRatio: '1:1',
      sizeStr: asset.fileType.toUpperCase(),
      status: 'idle',
    };

    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const ratio = w / h;
      let aspect = ratio > 1.2 ? '16:9' : ratio < 0.8 ? '9:16' : '1:1';
      setBatchItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, width: w, height: h, aspectRatio: aspect, dimensions: `${w} × ${h}` }
            : it
        )
      );
    };
    img.src = asset.previewUrl;

    setBatchItems((prev) => [...prev, newItem]);
    if (!activeItemId) {
      setActiveItemId(id);
    }
    showNotification(`Added "${asset.originalFilename || asset.filename}" to batch!`, 'info');
  };

  // Add ALL workspace files at once
  const handleAddAllWorkspaceAssets = () => {
    const validAssets = workspaceFiles.filter((a) => a.previewUrl);
    if (validAssets.length === 0) {
      showNotification('No workspace assets with image previews found.', 'error');
      return;
    }

    let addedCount = 0;
    const newItems: BatchImageItem[] = [];

    validAssets.forEach((asset) => {
      if (!batchItems.some((i) => i.previewUrl === asset.previewUrl)) {
        const id = 'ws_' + asset.id;
        const realFile = fileObjects?.[asset.id];
        newItems.push({
          id,
          file: realFile,
          name: asset.originalFilename || asset.filename,
          previewUrl: asset.previewUrl!,
          aspectRatio: '1:1',
          sizeStr: asset.fileType.toUpperCase(),
          status: 'idle',
        });
        addedCount++;
      }
    });

    if (newItems.length > 0) {
      setBatchItems((prev) => [...prev, ...newItems]);
      if (!activeItemId) {
        setActiveItemId(newItems[0].id);
      }
      showNotification(`Added ${addedCount} workspace asset(s) to batch list!`, 'success');
    } else {
      showNotification('All workspace assets are already in the list!', 'info');
    }
  };

  // Remove item from batch
  const handleRemoveItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBatchItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (activeItemId === id) {
        setActiveItemId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  // Clear all items
  const handleClearAll = () => {
    if (isBatchGenerating) {
      showNotification('Cannot clear while generating. Please wait.', 'error');
      return;
    }
    setBatchItems([]);
    setActiveItemId(null);
  };

  // Generate SINGLE item
  const handleGenerateSingle = async (item: BatchImageItem) => {
    if (isBatchGenerating) return;

    setBatchItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', error: undefined } : i))
    );

    const startTime = Date.now();
    try {
      const source = item.file || item.previewUrl;
      const res = await generateDetailedPromptsFromImage({
        image: source,
        engineStyle: targetEngine,
        detailLevel,
        customInstructions,
        apiKey: activeGeminiKey,
        apiConfig,
        modelName: selectedModel,
        turboSpeed: true,
      });

      const elapsed = Date.now() - startTime;
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'completed', result: res, timeTakenMs: elapsed }
            : i
        )
      );
      showNotification(`Prompts generated for "${item.name}" in ${(elapsed / 1000).toFixed(1)}s!`, 'success');
    } catch (err: any) {
      console.error('Generation error:', err);
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error', error: err.message || 'Generation failed' }
            : i
        )
      );
      showNotification(`Error on "${item.name}": ${err.message}`, 'error');
    }
  };

  // Generate ALL PENDING in parallel batch with Turbo speed
  const handleGenerateAllBatch = async () => {
    const pendingItems = batchItems.filter((i) => i.status !== 'completed');
    if (pendingItems.length === 0) {
      showNotification('All images in batch have already been generated!', 'info');
      return;
    }

    setIsBatchGenerating(true);
    showNotification(`Starting fast parallel generation for ${pendingItems.length} images (${concurrency}x concurrency)...`, 'info');

    try {
      await generateBatchDetailedPrompts(
        batchItems,
        {
          engineStyle: targetEngine,
          detailLevel,
          customInstructions,
          apiKey: activeGeminiKey,
          apiConfig,
          modelName: selectedModel,
          turboSpeed: true,
        },
        concurrency,
        (id, patch) => {
          setBatchItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
          );
        }
      );

      showNotification('সবগুলো ছবির প্রম্পট দ্রুত জেনারেট সম্পন্ন হয়েছে! (All prompts generated!)', 'success');
    } catch (err: any) {
      console.error('Batch generation error:', err);
      showNotification(err.message || 'Batch generation encountered errors.', 'error');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Get specific prompt text for an item depending on style
  const getPromptText = (item: BatchImageItem, styleOverride?: string): string => {
    if (!item.result) return '';
    const style = styleOverride || itemPromptStyle[item.id] || globalStyleView;
    switch (style) {
      case 'midjourney':
        return item.result.midjourneyPrompt;
      case 'flux':
        return item.result.fluxPrompt;
      case 'photorealistic':
        return item.result.photorealisticPrompt;
      case 'cinematic':
        return item.result.cinematicPrompt;
      case 'vector':
        return item.result.vectorPrompt;
      case 'negative':
        return item.result.negativePrompt;
      case 'master':
      default:
        return item.result.masterPrompt;
    }
  };

  // Copy single prompt handler for a specific serial item
  const handleCopySinglePrompt = (item: BatchImageItem, styleOverride?: string) => {
    const text = getPromptText(item, styleOverride);
    if (!text) {
      showNotification(`"${item.name}"-এর জন্য প্রম্পট এখনও তৈরি হয়নি। Generate বাটনে ক্লিক করুন।`, 'info');
      return;
    }
    navigator.clipboard.writeText(text);
    const key = styleOverride ? `${item.id}_${styleOverride}` : item.id;
    setCopiedKey(key);
    showNotification(`"${item.name}"-এর প্রম্পট ক্লিপবোর্ডে কপি করা হয়েছে!`, 'success');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Copy single prompt handler by raw text
  const handleCopySingle = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showNotification(`Copied ${keyName} to clipboard!`, 'success');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Copy ALL prompts for CURRENT active image
  const handleCopyActiveImagePrompts = () => {
    if (!activeItem || !activeItem.result) return;
    const formatted = formatAllPromptsText(activeItem.result, activeItem.name);
    navigator.clipboard.writeText(formatted);
    setAllCopied(true);
    showNotification(`"${activeItem.name}"-এর সব প্রম্পট কপি করা হয়েছে!`, 'success');
    setTimeout(() => {
      setAllCopied(false);
    }, 2500);
  };

  // Copy ALL prompts for ALL BATCH images combined (সবগুলো একসাথে কপি)
  const handleCopyAllBatchPrompts = (modeOverride?: 'clean' | 'detailed') => {
    const completed = batchItems.filter((i) => i.status === 'completed' && i.result);
    if (completed.length === 0) {
      showNotification('কপি করার মতো কোনো তৈরি হওয়া প্রম্পট নেই। আগে "Generate All" চাপুন।', 'error');
      return;
    }

    const mode = modeOverride || copyMode;
    let masterDoc = '';
    if (mode === 'clean') {
      masterDoc = formatBatchSimplePromptsText(batchItems, globalStyleView);
    } else {
      masterDoc = formatBatchAllPromptsText(batchItems);
    }

    navigator.clipboard.writeText(masterDoc);
    setBatchCopied(true);
    showNotification(`সবগুলো (${completed.length}টি) ছবির প্রম্পট একসাথে কপি করা হয়েছে!`, 'success');
    setTimeout(() => {
      setBatchCopied(false);
    }, 2500);
  };

  // Download all prompts as .TXT
  const handleDownloadAllTxt = () => {
    const completed = batchItems.filter((i) => i.status === 'completed' && i.result);
    if (completed.length === 0) {
      showNotification('No completed prompts to download.', 'error');
      return;
    }

    const masterDoc = formatBatchAllPromptsText(batchItems);
    const blob = new Blob([masterDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_prompts_batch_${completed.length}_images_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Downloaded prompts for ${completed.length} images!`, 'success');
  };

  // Download all prompts as .JSON
  const handleDownloadAllJson = () => {
    const completed = batchItems.filter((i) => i.status === 'completed' && i.result);
    if (completed.length === 0) {
      showNotification('No completed prompts to download.', 'error');
      return;
    }

    const exportData = completed.map((item) => ({
      name: item.name,
      aspectRatio: item.aspectRatio,
      dimensions: item.dimensions,
      generationTimeMs: item.timeTakenMs,
      prompts: item.result,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_prompts_batch_${completed.length}_images_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Downloaded JSON specification for ${completed.length} images!`, 'success');
  };

  // Navigate between images
  const handleNextImage = () => {
    if (batchItems.length <= 1) return;
    const currentIndex = batchItems.findIndex((i) => i.id === activeItem?.id);
    const nextIndex = (currentIndex + 1) % batchItems.length;
    setActiveItemId(batchItems[nextIndex].id);
  };

  const handlePrevImage = () => {
    if (batchItems.length <= 1) return;
    const currentIndex = batchItems.findIndex((i) => i.id === activeItem?.id);
    const prevIndex = (currentIndex - 1 + batchItems.length) % batchItems.length;
    setActiveItemId(batchItems[prevIndex].id);
  };

  // Expand text prompt handler (Tab 2)
  const handleExpandTextPrompt = async () => {
    if (!expanderIdea.trim()) {
      showNotification('Please enter a concept or idea to expand!', 'error');
      return;
    }
    setIsExpanding(true);
    try {
      const geminiKey = apiConfig?.gemini?.find((k) => k && k.trim()) || (process.env.GEMINI_API_KEY as string);
      if (!geminiKey) throw new Error('Gemini API key is required in Settings.');

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const prompt = `You are an expert generative AI prompt engineer.
Expand this brief idea into 3 masterfully crafted, hyper-detailed prompt variations:
Brief Idea: "${expanderIdea}"

Return ONLY a JSON object:
{
  "midjourney": "detailed Midjourney v6.1 prompt with style, lighting, camera and --ar 16:9 --style raw --v 6.1 --stylize 250",
  "photorealistic": "hyperrealistic stock photography prompt, Hasselblad 8k shot, studio lighting, depth of field",
  "cinematic": "cinematic film still, 35mm anamorphic lens, volumetric lighting, epic mood and grading"
}`;

      const res = await ai.models.generateContent({
        model: selectedModel || 'gemini-3.8-flash',
        contents: prompt,
      });

      const cleaned = (res.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      setExpandedResults(parsed);
      showNotification('Expanded prompts generated!', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to expand prompt', 'error');
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070e18] text-slate-100 backdrop-blur-xl animate-in fade-in duration-200 overflow-hidden">
      {/* 1. EXTENSIONS HUB HEADER */}
      <header className="px-5 py-3 border-b border-[#1b2d45] bg-[#091524] flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
            <Layers size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider">
                Extensions Studio
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs">
                DARK THEME • MODULAR
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Commercial Microstock AI Utilities & Multi-Engine Prompter
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {/* Gemini API Key indicator */}
          <div className={cn(
            "hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold",
            activeGeminiKey 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          )}>
            {activeGeminiKey ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Gemini API Connected {activeKey ? `(#${activeKey.index + 1})` : ''}</span>
              </>
            ) : (
              <>
                <AlertCircle size={13} className="text-amber-400" />
                <span>Gemini Key Needed (Settings)</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#233d60] bg-[#0d1e33] hover:bg-[#142d4d] text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Standard" : "Expand"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
            title="Close Extensions Studio (Esc)"
          >
            <X size={16} />
            <span>Close (Esc)</span>
          </button>
        </div>
      </header>

      {/* 2. EXTENSIONS TABS SELECTOR STRIP */}
      <div className="px-5 py-2.5 border-b border-[#1b2d45] bg-[#0a1727] flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-2">
          {/* Hub Tab Button */}
          <button
            type="button"
            onClick={() => setActiveTab('hub')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 border",
              activeTab === 'hub'
                ? "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.4)]"
                : "bg-[#0e1d30] hover:bg-[#152a45] border-[#1d3554] text-slate-300 hover:text-white"
            )}
          >
            <Layers size={13} className={activeTab === 'hub' ? "text-white" : "text-cyan-400"} />
            <span>Extensions Hub</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image-to-prompt')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 border",
              activeTab === 'image-to-prompt'
                ? "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.4)]"
                : "bg-[#0e1d30] hover:bg-[#152a45] border-[#1d3554] text-slate-300 hover:text-white"
            )}
          >
            <Camera size={13} />
            <span>Image to Prompt</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-black">
              {batchItems.length > 0 ? `${batchItems.length} Images` : 'Turbo Batch'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt-expander')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 border",
              activeTab === 'prompt-expander'
                ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                : "bg-[#0e1d30] hover:bg-[#152a45] border-[#1d3554] text-slate-300 hover:text-white"
            )}
          >
            <Wand2 size={13} />
            <span>AI Prompt Expander</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('palette-scout')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 border",
              activeTab === 'palette-scout'
                ? "bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                : "bg-[#0e1d30] hover:bg-[#152a45] border-[#1d3554] text-slate-300 hover:text-white"
            )}
          >
            <Palette size={13} />
            <span>Color & Palette Scout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upscaler-advisor')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 border",
              activeTab === 'upscaler-advisor'
                ? "bg-amber-600 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                : "bg-[#0e1d30] hover:bg-[#152a45] border-[#1d3554] text-slate-300 hover:text-white"
            )}
          >
            <Maximize2 size={13} />
            <span>Upscaler & Specs Advisor</span>
          </button>
        </div>

        {/* Right Status Summary */}
        {activeTab === 'image-to-prompt' && batchItems.length > 0 && (
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">
              Queue: <strong className="text-white">{batchStats.completed}</strong>/{batchStats.total} done
            </span>
            {batchStats.percent > 0 && (
              <div className="w-24 h-2 rounded-full bg-[#081321] overflow-hidden border border-[#1b2d45]">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${batchStats.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. MAIN WORKSPACE AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 bg-[#060d17]">
        
        {/* =========================================================================
            TAB 0: EXTENSIONS HUB (MODULAR CARDS VIEW)
           ========================================================================= */}
        {activeTab === 'hub' && (
          <div className="max-w-6xl mx-auto space-y-6 py-2 animate-in fade-in duration-150">
            {/* Hub Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0c2242] via-[#0f2d57] to-[#122849] border border-[#20436d] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                    EXTENSIONS HUB
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Select Tool Below</span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">
                  Microstock Creative Extensions
                </h3>
                <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium">
                  Modular tools built for stock contributors. Click any tool to open its dedicated workspace in signature dark mode.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-[#081424] border border-[#1b3457] text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">AI Model</span>
                  <span className="text-xs font-mono font-bold text-cyan-300">{selectedModel}</span>
                </div>
              </div>
            </div>

            {/* Modular Extension Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* EXTENSION 1: Image to Prompt */}
              <div 
                onClick={() => setActiveTab('image-to-prompt')}
                className="group p-5 rounded-2xl bg-[#0c1a2e] hover:bg-[#10233d] border-2 border-[#1e3b63] hover:border-cyan-400 transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)] group-hover:scale-105 transition-transform">
                      <Camera size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                      MULTI-BATCH
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors uppercase tracking-wide">
                      Image to Prompt Studio
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                      Reverse-engineer single or 100+ images into Midjourney v6.1, Flux.1, Photorealistic, Cinematic, and Vector prompts.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Multi-Batch</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Midjourney v6.1</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Flux.1 Dev</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">1-Click Copy</span>
                  </div>
                </div>

                <button 
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Image to Prompt</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* EXTENSION 2: AI Prompt Expander */}
              <div 
                onClick={() => setActiveTab('prompt-expander')}
                className="group p-5 rounded-2xl bg-[#0c1a2e] hover:bg-[#10233d] border-2 border-[#1e3b63] hover:border-purple-400 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)] group-hover:scale-105 transition-transform">
                      <Wand2 size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/40">
                      TEXT TO PROMPT
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white group-hover:text-purple-300 transition-colors uppercase tracking-wide">
                      AI Prompt Expander
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                      Type any keyword or concept. Instantly expands into 3 professional stock prompts: Midjourney, Photorealistic 8K, and Cinematic Film.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Idea Expansion</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Stock Lighting</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Cinematic</span>
                  </div>
                </div>

                <button 
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Prompt Expander</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* EXTENSION 3: Color & Palette Scout */}
              <div 
                onClick={() => setActiveTab('palette-scout')}
                className="group p-5 rounded-2xl bg-[#0c1a2e] hover:bg-[#10233d] border-2 border-[#1e3b63] hover:border-emerald-400 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-transform">
                      <Palette size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      COLOR HARMONY
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors uppercase tracking-wide">
                      Color & Palette Scout
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                      Curated commercial palettes, trending hex colors, and color-theory keyword generators optimized for stock search algorithms.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Hex Swatches</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Trending Palettes</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Vector Colors</span>
                  </div>
                </div>

                <button 
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Color Scout</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* EXTENSION 4: Upscaler & Vector Standards Advisor */}
              <div 
                onClick={() => setActiveTab('upscaler-advisor')}
                className="group p-5 rounded-2xl bg-[#0c1a2e] hover:bg-[#10233d] border-2 border-[#1e3b63] hover:border-amber-400 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] group-hover:scale-105 transition-transform">
                      <Maximize2 size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                      SPECS & DPI
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white group-hover:text-amber-300 transition-colors uppercase tracking-wide">
                      Upscaler & Vector Advisor
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                      Instant resolution calculator for Adobe Stock (4MP-100MP), Freepik, Shutterstock, 300 DPI print target sizing, and vector EPS-10 verification.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">Megapixel Calc</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">300 DPI Print</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#132845] text-slate-300 border border-[#213f6b]">EPS-10 Rules</span>
                  </div>
                </div>

                <button 
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Specs Advisor</span>
                  <ChevronRight size={14} />
                </button>
              </div>

            </div>
          </div>
        )}
        
        {/* =========================================================================
            TAB 1: MULTI-IMAGE TO PROMPT GENERATOR (SERIAL SIDE-BY-SIDE FEED)
           ========================================================================= */}
        {activeTab === 'image-to-prompt' && (
          <div className="max-w-7xl mx-auto space-y-4">
            
            {/* Top Overview & Master Batch Actions Bar */}
            <div className="p-3.5 md:p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-card to-indigo-950/30 border border-blue-500/30 flex items-center justify-between flex-wrap gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
                  <Zap size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span>Multi-Image to Prompt Generator</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.2 rounded-full font-extrabold border border-blue-400/30">
                      ⚡ Turbo Vision AI
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    বামে ছবি ও ডানে প্রম্পট সিরিয়ালি সাজানো — যেকোনো একটি প্রম্পট কপি করুন অথবা সবগুলো একসাথে কপি করুন।
                  </p>
                </div>
              </div>

              {/* Master Bulk Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Upload More Images */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-foreground font-bold text-xs transition-all cursor-pointer shadow-xs"
                  title="Add more images to batch queue"
                >
                  <Plus size={14} className="text-primary" />
                  <span>ছবি যোগ করুন</span>
                </button>

                {/* Add Workspace Assets */}
                {workspaceFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllWorkspaceAssets}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground font-bold text-xs transition-all cursor-pointer shadow-xs"
                    title="Add all files from current workspace"
                  >
                    <Layers size={14} />
                    <span>Workspace Assets ({workspaceFiles.length})</span>
                  </button>
                )}

                {/* Tuning Drawer Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTuningDrawer((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer shadow-xs",
                    showTuningDrawer
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary hover:bg-accent border-border text-muted-foreground hover:text-foreground"
                  )}
                  title="Settings: Tuning Engine, Detail Level & AI Model"
                >
                  <SlidersHorizontal size={14} />
                  <span>Settings</span>
                </button>

                {batchItems.length > 0 && (
                  <>
                    {/* Run All Button */}
                    <button
                      type="button"
                      onClick={handleGenerateAllBatch}
                      disabled={isBatchGenerating}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 border",
                        isBatchGenerating
                          ? "bg-blue-600/50 border-blue-400/30 cursor-wait"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400/50 shadow-blue-600/30"
                      )}
                      title="Generate prompts for all queued images in parallel"
                    >
                      {isBatchGenerating ? (
                        <>
                          <RefreshCw size={14} className="animate-spin text-white" />
                          <span>Generating ({batchStats.completed}/{batchStats.total})...</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} className="text-amber-300 fill-amber-300" />
                          <span>Generate All ({batchStats.total - batchStats.completed} Pending)</span>
                        </>
                      )}
                    </button>

                    {/* COPY ALL PROMPTS TOGETHER (সব একসাথে কপি) */}
                    {batchStats.completed > 0 && (
                      <div className="flex items-center bg-emerald-950/40 border border-emerald-500/50 rounded-xl overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => handleCopyAllBatchPrompts()}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                          title="Copy all prompts serially together"
                        >
                          {batchCopied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{batchCopied ? "Copied All!" : `Copy All (${batchStats.completed} প্রম্পট)`}</span>
                        </button>

                        {/* Mode Switcher Pill: Clean vs Full Specs */}
                        <div className="hidden md:flex items-center px-1.5 py-1 text-[10px] font-mono bg-emerald-900/60 text-emerald-200 gap-1 border-l border-emerald-600/40">
                          <button
                            type="button"
                            onClick={() => {
                              setCopyMode('clean');
                              handleCopyAllBatchPrompts('clean');
                            }}
                            className={cn(
                              "px-1.5 py-0.5 rounded cursor-pointer transition-all",
                              copyMode === 'clean' ? "bg-emerald-500 text-white font-bold" : "hover:text-white"
                            )}
                            title="Copy clean serial prompt texts only"
                          >
                            Clean
                          </button>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCopyMode('detailed');
                              handleCopyAllBatchPrompts('detailed');
                            }}
                            className={cn(
                              "px-1.5 py-0.5 rounded cursor-pointer transition-all",
                              copyMode === 'detailed' ? "bg-emerald-500 text-white font-bold" : "hover:text-white"
                            )}
                            title="Copy full detailed report with Midjourney & parameters"
                          >
                            Full Specs
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Download All .TXT */}
                    {batchStats.completed > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadAllTxt}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-foreground font-bold text-xs transition-all cursor-pointer"
                        title="Download all prompts as .txt file"
                      >
                        <Download size={14} />
                        <span>.TXT</span>
                      </button>
                    )}

                    {/* Clear All */}
                    <button
                      type="button"
                      onClick={handleClearAll}
                      disabled={isBatchGenerating}
                      className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground border border-destructive/20 text-xs transition-all cursor-pointer"
                      title="Clear All Images in Batch"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* TUNING & SETTINGS DRAWER (Collapsible) */}
            {showTuningDrawer && (
              <div className="p-4 rounded-2xl bg-card border border-border shadow-md space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-primary" />
                    <span>Prompt Generator Tuning & Global Options</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTuningDrawer(false)}
                    className="text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer"
                  >
                    Close ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Default Target Engine */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Default Engine Format
                    </label>
                    <select
                      value={targetEngine}
                      onChange={(e) => setTargetEngine(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg text-xs h-8 px-2 text-foreground font-bold cursor-pointer"
                    >
                      <option value="universal">Universal (All AI)</option>
                      <option value="midjourney">Midjourney v6.1</option>
                      <option value="flux">Flux.1 / SDXL</option>
                      <option value="photorealistic">Stock Photo Pro</option>
                      <option value="cinematic">Cinematic Film Still</option>
                      <option value="vector">Clean Vector Art</option>
                    </select>
                  </div>

                  {/* Detail Level */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Detail Level
                    </label>
                    <select
                      value={detailLevel}
                      onChange={(e) => setDetailLevel(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg text-xs h-8 px-2 text-foreground font-bold cursor-pointer"
                    >
                      <option value="standard">Balanced Description</option>
                      <option value="hyper_detailed">Hyper-Detailed (Recommended)</option>
                      <option value="masterpiece">Masterpiece 8K Maximum</option>
                    </select>
                  </div>

                  {/* Gemini Vision Model */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Vision Model
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-lg text-xs h-8 px-2 text-foreground font-bold cursor-pointer"
                    >
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Accuracy)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Max Speed)</option>
                      <option value="gemini-flash-latest">Gemini Flash Latest (Auto)</option>
                    </select>
                  </div>

                  {/* Parallel Concurrency */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Parallel Concurrency
                    </label>
                    <select
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      className="w-full bg-secondary border border-border rounded-lg text-xs h-8 px-2 text-foreground font-bold cursor-pointer"
                    >
                      <option value={3}>3x Parallel Images</option>
                      <option value={4}>4x Parallel (Fast)</option>
                      <option value={6}>6x Turbo Parallel</option>
                    </select>
                  </div>
                </div>

                {/* Custom Directions */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                    Custom Prompt Focus / Mood Bias (Optional)
                  </label>
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Focus heavily on cinematic volumetric lighting, emphasize photorealistic textures..."
                    className="w-full bg-secondary border border-border rounded-lg text-xs h-8 px-2.5 text-foreground placeholder:text-muted-foreground/40 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Hidden Multi-file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const filesArr = Array.from(e.target.files);
                  addFilesToBatch(filesArr);
                  showNotification(`Added ${filesArr.length} image(s) to queue!`, 'info');
                }
              }}
            />

            {/* EMPTY STATE (When no images are added yet) */}
            {batchItems.length === 0 ? (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const filesArr = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                      if (filesArr.length > 0) {
                        addFilesToBatch(filesArr);
                        showNotification(`Added ${filesArr.length} image(s) to batch!`, 'info');
                      }
                    }
                  }}
                  className="min-h-[380px] p-8 rounded-3xl border-2 border-dashed border-border hover:border-primary/70 bg-card/60 hover:bg-card flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all group"
                >
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={36} className="text-primary" />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <h3 className="text-base md:text-lg font-black text-foreground uppercase tracking-wider">
                      Click or Drag & Drop Multiple Images Here
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      একসাথে ৫, ১০, ২০+ ছবি সিলেক্ট করুন। বামে ছবি এবং ডানে তার রিভার্স প্রম্পট সিরিয়ালি তৈরি হবে।
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      + Browse Multiple Images
                    </button>

                    {workspaceFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddAllWorkspaceAssets();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-accent border border-border text-foreground font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        + Add All Workspace Images ({workspaceFiles.length})
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Supports JPG, PNG, WEBP, AVIF, HEIC • Press Ctrl+V anytime to paste clipboard screenshots
                  </span>
                </div>
              </div>
            ) : (
              /* =========================================================================
                 SERIAL SIDE-BY-SIDE FEED (বামে ছবি, ডানে প্রম্পট — সিরিয়ালি সাজানো)
                 ========================================================================= */
              <div className="space-y-4">
                
                {/* Global Quick-Drop & View Switcher Bar */}
                <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between flex-wrap gap-2.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-primary" />
                      <span>Queue ({batchItems.length} Images)</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                      {batchStats.completed} Completed
                    </span>
                    {batchStats.total - batchStats.completed > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        {batchStats.total - batchStats.completed} Pending
                      </span>
                    )}
                  </div>

                  {/* Switch All Prompts View To: */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-muted-foreground mr-1 hidden sm:inline">
                      View Style:
                    </span>
                    {[
                      { id: 'master', label: 'Master Prompt' },
                      { id: 'midjourney', label: 'Midjourney v6' },
                      { id: 'flux', label: 'Flux.1' },
                      { id: 'photorealistic', label: 'Stock Photo' },
                      { id: 'cinematic', label: 'Cinematic' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setGlobalStyleView(tab.id as any);
                          // Sync all items to this style
                          const updated: Record<string, any> = {};
                          batchItems.forEach(i => { updated[i.id] = tab.id; });
                          setItemPromptStyle(updated);
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer border",
                          globalStyleView === tab.id
                            ? "bg-primary text-primary-foreground border-primary font-black"
                            : "bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border-border"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* THE SERIAL LIST (সিরিয়ালি আসবে: ছবি বামে, প্রম্পট ডানে) */}
                <div className="space-y-4">
                  {batchItems.map((item, idx) => {
                    const activePromptStyle = itemPromptStyle[item.id] || globalStyleView;
                    const promptText = getPromptText(item, activePromptStyle);

                    return (
                      <div
                        key={item.id}
                        id={`batch-item-${item.id}`}
                        className="p-4 md:p-5 rounded-2xl bg-card border border-border shadow-sm hover:border-primary/40 transition-all space-y-3.5"
                      >
                        {/* 1. Item Header Strip */}
                        <div className="flex items-center justify-between border-b border-border/80 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center font-black text-xs text-primary font-mono shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-xs md:text-sm font-extrabold text-foreground truncate max-w-xs md:max-w-md" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                              {item.aspectRatio || '1:1'} • {item.dimensions || item.sizeStr}
                            </span>

                            {/* Status badge */}
                            {item.status === 'completed' && (
                              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                <Check size={11} /> READY {item.timeTakenMs ? `(${(item.timeTakenMs / 1000).toFixed(1)}s)` : ''}
                              </span>
                            )}
                            {item.status === 'processing' && (
                              <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                <RefreshCw size={11} className="animate-spin" /> GENERATING FAST...
                              </span>
                            )}
                            {item.status === 'idle' && (
                              <span className="text-[10px] font-mono font-bold bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded">
                                PENDING
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded">
                                ERROR: {item.error || 'Failed'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Re-generate Button */}
                            {item.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleGenerateSingle(item)}
                                disabled={isBatchGenerating}
                                className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent border border-border rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                title="Re-generate prompt for this image"
                              >
                                <RefreshCw size={12} />
                                <span>Re-generate</span>
                              </button>
                            )}

                            {/* Remove Item */}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveItem(item.id, e)}
                              disabled={isBatchGenerating && item.status === 'processing'}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
                              title="Remove from queue"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* 2. Side-by-side Layout: [ ছবি বামে (LEFT) ] | [ প্রম্পট ডানে (RIGHT) ] */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4.5 items-stretch">
                          
                          {/* LEFT: Image Box (পাশে ছবি থাকবে) */}
                          <div className="md:col-span-4 lg:col-span-3 flex flex-col justify-between space-y-2.5">
                            <div 
                              className="relative group rounded-xl overflow-hidden border-2 border-border bg-black/40 w-full h-48 md:h-56 flex items-center justify-center cursor-zoom-in shadow-xs"
                              onClick={() => setLightboxImage({ url: item.previewUrl, title: item.name })}
                              title="Click to zoom in / view full size"
                            >
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                                <ZoomIn size={15} /> Full View
                              </div>
                              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
                                {item.aspectRatio}
                              </div>
                            </div>

                            {/* Status Actions below image */}
                            {item.status === 'idle' && (
                              <button
                                type="button"
                                onClick={() => handleGenerateSingle(item)}
                                disabled={isBatchGenerating}
                                className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                              >
                                <Sparkles size={13} />
                                <span>Generate Prompt</span>
                              </button>
                            )}

                            {item.status === 'processing' && (
                              <div className="w-full py-2 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 font-bold text-xs flex items-center justify-center gap-1.5 animate-pulse">
                                <RefreshCw size={13} className="animate-spin" />
                                <span>AI Vision Analyzing...</span>
                              </div>
                            )}

                            {item.status === 'completed' && (
                              <div className="text-[10px] font-mono text-muted-foreground text-center">
                                Generated via {selectedModel.replace('gemini-', '')}
                              </div>
                            )}
                          </div>

                          {/* RIGHT: Prompt Box (ওইটার পাশেই প্রম্পট আসবে) */}
                          <div className="md:col-span-8 lg:col-span-9 flex flex-col justify-between space-y-2.5">
                            
                            {/* Prompt Style Selector Tabs Strip */}
                            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/70 pb-2">
                              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                                {[
                                  { id: 'master', label: '🌟 Master Detailed' },
                                  { id: 'midjourney', label: '🚀 Midjourney v6.1' },
                                  { id: 'flux', label: '⚡ Flux.1 / SDXL' },
                                  { id: 'photorealistic', label: '📸 Stock Photo' },
                                  { id: 'cinematic', label: '🎬 Cinematic' },
                                  { id: 'vector', label: '🎨 Vector Art' },
                                  { id: 'negative', label: '🚫 Negative' }
                                ].map((tab) => {
                                  const isSel = activePromptStyle === tab.id;
                                  return (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => setItemPromptStyle((prev) => ({ ...prev, [item.id]: tab.id as any }))}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border",
                                        isSel
                                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                                          : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                                      )}
                                    >
                                      {tab.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* PROMPT COPY BUTTON (একটা প্রম্পট কপি করার অপশন) */}
                              {item.result && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySinglePrompt(item, activePromptStyle)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs border shrink-0 active:scale-95",
                                    copiedKey === item.id || copiedKey === `${item.id}_${activePromptStyle}`
                                      ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
                                      : "bg-primary text-primary-foreground hover:opacity-90 border-primary"
                                  )}
                                  title="Copy this specific prompt to clipboard"
                                >
                                  {copiedKey === item.id || copiedKey === `${item.id}_${activePromptStyle}` ? (
                                    <>
                                      <Check size={13} />
                                      <span>Copied! (কপি হয়েছে)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} />
                                      <span>Copy Prompt (কপি করুন)</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* The Prompt Text Box Container */}
                            <div className="flex-1">
                              {item.result ? (
                                <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/80 text-foreground font-medium text-xs md:text-sm leading-relaxed max-h-48 overflow-y-auto custom-scrollbar select-all">
                                  {promptText}
                                </div>
                              ) : item.status === 'processing' ? (
                                <div className="p-6 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
                                  <RefreshCw size={24} className="text-blue-500 animate-spin" />
                                  <p className="text-xs font-bold text-foreground">
                                    Gemini AI Vision composition & prompt analysis in progress...
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Extracting lighting, subjects, textures, camera lenses and multi-engine parameters.
                                  </p>
                                </div>
                              ) : (
                                <div className="p-6 rounded-xl border border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
                                  <Sparkles size={22} className="text-muted-foreground/50" />
                                  <p className="text-xs font-bold text-muted-foreground">
                                    প্রম্পট এখনও তৈরি করা হয়নি (Prompt not generated yet)
                                  </p>
                                  <p className="text-[11px] text-muted-foreground/80">
                                    বামপাশের "Generate Prompt" বাটনে ক্লিক করুন অথবা উপরে "Generate All" চাপুন।
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Bottom Prompt Metadata & Quick Actions */}
                            {item.result && (
                              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/60 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                                    {promptText.split(/\s+/).filter(Boolean).length} Words • {promptText.length} Chars
                                  </span>

                                  {/* Quick Token Tags */}
                                  {item.result.breakdown?.keyTokens?.slice(0, 4).map((tok, tidx) => (
                                    <button
                                      key={tidx}
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(tok);
                                        showNotification(`Copied token: "${tok}"`, 'info');
                                      }}
                                      className="text-[10px] font-mono text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent px-1.5 py-0.5 rounded border border-border cursor-pointer transition-all"
                                      title="Click to copy token"
                                    >
                                      +{tok}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Copy All Engine Styles for this single image */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allTxt = formatAllPromptsText(item.result!, item.name);
                                      navigator.clipboard.writeText(allTxt);
                                      setCopiedKey(`${item.id}_all`);
                                      showNotification(`"${item.name}"-এর সব স্টাইল কপি হয়েছে!`, 'success');
                                      setTimeout(() => setCopiedKey(null), 2000);
                                    }}
                                    className="text-[11px] font-bold text-muted-foreground hover:text-primary transition-all cursor-pointer flex items-center gap-1"
                                    title="Copy all engine styles (Master, Midjourney, Flux, Stock) for this image"
                                  >
                                    <Copy size={12} />
                                    <span>{copiedKey === `${item.id}_all` ? "All Styles Copied!" : "Copy All Styles"}</span>
                                  </button>

                                  {/* Copy Current Prompt */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopySinglePrompt(item, activePromptStyle)}
                                    className={cn(
                                      "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95",
                                      copiedKey === item.id || copiedKey === `${item.id}_${activePromptStyle}`
                                        ? "bg-emerald-600 text-white border-emerald-500"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                                    )}
                                  >
                                    {copiedKey === item.id || copiedKey === `${item.id}_${activePromptStyle}` ? (
                                      <Check size={13} />
                                    ) : (
                                      <Copy size={13} />
                                    )}
                                    <span>
                                      {copiedKey === item.id || copiedKey === `${item.id}_${activePromptStyle}`
                                        ? "Copied!"
                                        : "Copy This Prompt"}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Add More Button */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary hover:bg-accent border border-dashed border-border hover:border-primary text-foreground font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                  >
                    <Plus size={15} className="text-primary" />
                    <span>আরও ছবি যোগ করুন (Add More Images)</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* =========================================================================
            TAB 2: AI PROMPT EXPANDER
           ========================================================================= */}
        {activeTab === 'prompt-expander' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-md space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Wand2 size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-foreground uppercase tracking-wider">
                    Creative AI Prompt Expander
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    যেকোনো বেসিক আইডিয়া লিখুন — এআই এটিকে স্বয়ংক্রিয়ভাবে ৩টি ভিন্ন প্রফেশনাল প্রম্পটে বিস্তারিত রূপ দেবে।
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={expanderIdea}
                  onChange={(e) => setExpanderIdea(e.target.value)}
                  placeholder="Type your core idea here... (e.g., A peaceful Japanese tea garden at sunrise with mist and cherry blossoms)"
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-xs md:text-sm text-foreground focus:outline-none focus:border-primary font-medium"
                />

                <button
                  type="button"
                  onClick={handleExpandTextPrompt}
                  disabled={isExpanding || !expanderIdea.trim()}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all",
                    isExpanding || !expanderIdea.trim()
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-95"
                  )}
                >
                  {isExpanding ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Expand into 3 Studio Prompts</span>
                </button>
              </div>
            </div>

            {expandedResults && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 rounded-xl bg-card border border-purple-500/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-black text-purple-400 uppercase">Expanded Midjourney Prompt</span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(expandedResults.midjourney, 'Midjourney Exp')}
                      className="text-xs text-foreground font-bold flex items-center gap-1 cursor-pointer hover:text-primary"
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-foreground/90 font-mono bg-secondary/50 p-2.5 rounded-lg select-all">
                    {expandedResults.midjourney}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-black text-emerald-400 uppercase">Expanded Photorealistic Stock</span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(expandedResults.photorealistic, 'Photorealistic Exp')}
                      className="text-xs text-foreground font-bold flex items-center gap-1 cursor-pointer hover:text-primary"
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-foreground/90 bg-secondary/50 p-2.5 rounded-lg select-all">
                    {expandedResults.photorealistic}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-black text-amber-400 uppercase">Expanded Cinematic Concept</span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(expandedResults.cinematic, 'Cinematic Exp')}
                      className="text-xs text-foreground font-bold flex items-center gap-1 cursor-pointer hover:text-primary"
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-foreground/90 bg-secondary/50 p-2.5 rounded-lg select-all">
                    {expandedResults.cinematic}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: UPSCALER & VECTOR STANDARDS ADVISOR
           ========================================================================= */}
        {activeTab === 'upscaler-advisor' && (
          <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
            {/* Top Card: Live Megapixel & Agency Resolution Calculator */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#0c1a2e] border-2 border-[#1e3b63] shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#1b3457] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                    <Maximize2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      Stock Resolution & Megapixel Calculator
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Check your image dimensions against Adobe Stock, Shutterstock, and Freepik submission thresholds.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Megapixels</span>
                  <span className={cn(
                    "text-xl font-mono font-black",
                    ((calcWidth * calcHeight) / 1000000) >= 4.0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {((calcWidth * calcHeight) / 1000000).toFixed(2)} MP
                  </span>
                </div>
              </div>

              {/* Input Dimensions & Quick Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider">Width (Pixels)</label>
                  <input
                    type="number"
                    value={calcWidth}
                    onChange={(e) => setCalcWidth(Math.max(100, parseInt(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#081321] border border-[#1d3554] text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider">Height (Pixels)</label>
                  <input
                    type="number"
                    value={calcHeight}
                    onChange={(e) => setCalcHeight(Math.max(100, parseInt(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#081321] border border-[#1d3554] text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Standard Stock Presets</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '4K UHD (3840×2160)', w: 3840, h: 2160 },
                    { label: '8K Ultra (7680×4320)', w: 7680, h: 4320 },
                    { label: 'Square 4K (4096×4096)', w: 4096, h: 4096 },
                    { label: 'Vertical 9:16 (2160×3840)', w: 2160, h: 3840 },
                    { label: 'Full HD 1080p (1920×1080)', w: 1920, h: 1080 },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCalcWidth(p.w);
                        setCalcHeight(p.h);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition-all cursor-pointer",
                        calcWidth === p.w && calcHeight === p.h
                          ? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-xs"
                          : "bg-[#0f2138] hover:bg-[#162f4e] text-slate-300 border-[#1f3757]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agency Compliance Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Adobe Stock */}
                <div className={cn(
                  "p-3.5 rounded-xl border flex flex-col justify-between space-y-1.5",
                  ((calcWidth * calcHeight) / 1000000) >= 4.0 && ((calcWidth * calcHeight) / 1000000) <= 100
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Adobe Stock</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-black/40">Min 4.0 MP</span>
                  </div>
                  <div className="text-[11px] font-bold">
                    {((calcWidth * calcHeight) / 1000000) >= 4.0 ? '✅ APPROVED (Meets ≥ 4.0 MP)' : '❌ REJECTED (< 4.0 MP - Needs Upscale)'}
                  </div>
                </div>

                {/* Shutterstock */}
                <div className={cn(
                  "p-3.5 rounded-xl border flex flex-col justify-between space-y-1.5",
                  ((calcWidth * calcHeight) / 1000000) >= 4.0
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Shutterstock</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-black/40">Min 4.0 MP</span>
                  </div>
                  <div className="text-[11px] font-bold">
                    {((calcWidth * calcHeight) / 1000000) >= 4.0 ? '✅ APPROVED (Meets ≥ 4.0 MP)' : '❌ REJECTED (< 4.0 MP)'}
                  </div>
                </div>

                {/* Freepik */}
                <div className={cn(
                  "p-3.5 rounded-xl border flex flex-col justify-between space-y-1.5",
                  Math.max(calcWidth, calcHeight) >= 2000
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase">Freepik</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-black/40">Min 2000px</span>
                  </div>
                  <div className="text-[11px] font-bold">
                    {Math.max(calcWidth, calcHeight) >= 2000 ? '✅ APPROVED (Long edge ≥ 2000px)' : '❌ REJECTED (< 2000px edge)'}
                  </div>
                </div>
              </div>

              {/* 300 DPI Print Info */}
              <div className="p-3.5 rounded-xl bg-[#081321] border border-[#1b3457] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-300 font-medium">
                  🖨️ <strong>300 DPI Print Size:</strong> {(calcWidth / 300).toFixed(1)}" × {(calcHeight / 300).toFixed(1)}" inches ({((calcWidth / 300) * 2.54).toFixed(1)} × {((calcHeight / 300) * 2.54).toFixed(1)} cm)
                </span>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Optimal for High-End Fine Art Prints
                </span>
              </div>
            </div>

            {/* Vector EPS-10 Standards Guide */}
            <div className="p-5 rounded-2xl bg-[#0c1a2e] border-2 border-[#1e3b63] shadow-xl space-y-3">
              <h4 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <span>⚡ Vector EPS Submission Rules (Zero-Rejection Checklist)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-[#081424] border border-[#193252] space-y-1">
                  <span className="font-bold text-white block">1. File Format:</span>
                  Save strictly as <strong>Illustrator 10 EPS (.eps)</strong> with Transparency Flattener set to High Resolution.
                </div>
                <div className="p-3 rounded-xl bg-[#081424] border border-[#193252] space-y-1">
                  <span className="font-bold text-white block">2. Text & Fonts:</span>
                  Expand all text to vector shapes (<code>Type &gt; Create Outlines</code>). No live editable fonts allowed.
                </div>
                <div className="p-3 rounded-xl bg-[#081424] border border-[#193252] space-y-1">
                  <span className="font-bold text-white block">3. Color Space:</span>
                  Use <strong>RGB color mode</strong> for stock digital vectors. Avoid CMYK unless specifically submitting print templates.
                </div>
                <div className="p-3 rounded-xl bg-[#081424] border border-[#193252] space-y-1">
                  <span className="font-bold text-white block">4. Isolated Vector Rules:</span>
                  Group all artwork, remove locked layers, unlock hidden paths, and ensure no stray anchor points exist on the artboard.
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'palette-scout' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-md space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                  <Palette size={20} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                    Commercial Palette & Vector Preset Hub
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Curated color palettes and vector styling prompts optimized for Adobe Stock and Freepik contributors.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'Cyberpunk Neon Nocturne', colors: ['#0f172a', '#3b82f6', '#ec4899', '#06b6d4', '#e2e8f0'], tag: 'High Commercial Demand' },
                  { name: 'Warm Terracotta Organic', colors: ['#451a03', '#9a3412', '#d97706', '#fef3c7', '#ffffff'], tag: 'Interior & Lifestyle' },
                  { name: 'Nordic Minimalist Slate', colors: ['#0f172a', '#334155', '#64748b', '#cbd5e1', '#f8fafc'], tag: 'Clean Tech & UI' },
                  { name: 'Emerald Forest Volumetric', colors: ['#022c22', '#065f46', '#10b981', '#6ee7b7', '#f0fdf4'], tag: 'Nature & Wellness' },
                  { name: 'Sunset Retro Gradient', colors: ['#4c0519', '#be123c', '#f43f5e', '#fb923c', '#fef08a'], tag: '80s Synthwave' },
                  { name: 'Luxury Champagne Gold', colors: ['#1c1917', '#78350f', '#b45309', '#fde68a', '#ffffff'], tag: 'Real Estate & Luxury' },
                ].map((palette, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-secondary/60 border border-border space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-foreground">{palette.name}</span>
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded">{palette.tag}</span>
                    </div>
                    <div className="flex h-7 rounded-lg overflow-hidden border border-border">
                      {palette.colors.map((c, i) => (
                        <div key={i} style={{ backgroundColor: c }} className="flex-1" title={c} />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(palette.colors.join(', '));
                        showNotification(`Copied palette: ${palette.colors.join(', ')}`, 'success');
                      }}
                      className="w-full py-1 text-[11px] font-bold rounded bg-background hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer text-center"
                    >
                      Copy Hex Codes ({palette.colors.join(', ')})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Lightbox Fullscreen Image Viewer Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-card rounded-2xl overflow-hidden border border-border shadow-2xl flex flex-col w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
              <span className="text-xs font-bold text-foreground truncate">{lightboxImage.title}</span>
              <button 
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Close Viewer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-black/50 min-h-[300px]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
