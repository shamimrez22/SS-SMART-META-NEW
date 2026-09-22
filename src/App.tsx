import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeList } from 'react-window';
import { 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  History as HistoryIcon, 
  Zap,
  LayoutDashboard,
  Plus,
  CheckCircle2,
  AlertCircle,
  Upload,
  Settings,
  X,
  FileText,
  Video,
  Layers,
  FileImage,
  Clock,
  Database,
  Copy,
  Check,
  Loader2,
  Eye,
  Share2,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  Info,
  FolderPlus,
  Square,
  FileSpreadsheet,
  FileJson,
  Key,
  Star,
  Tag,
  Sparkles,
  RefreshCw,
  RefreshCcw,
  FolderCheck,
  FileCode,
  ExternalLink,
  Save,
  Edit3,
  Maximize2
} from 'lucide-react';
import Papa from 'papaparse';
import * as piexif from "piexifjs";
import JSZip from 'jszip';
import { 
  injectEpsMetadata, 
  createXmpPacket, 
  embedMetadataInImageBlob, 
  embedMetadataInPngBlob,
  prepareEmbeddedBlob,
  generatePhotoshopScript, 
  generateIllustratorScript 
} from './services/embedService';
import { StockMetadata, ApiConfig, GeneratorSettings, ApiStatus, HistoryItem } from './types';
import { generateMetadata, testApiConnection, extractEpsThumbnail, extractVideoThumbnail } from './services/aiService';
import { AssetInspector } from './components/AssetInspector';
import { cn, sanitizeFilenameForFs } from './lib/utils';

const STORAGE_KEY = 'ai-metadata-pro-config';
const HISTORY_KEY = 'ai-metadata-pro-history';

// Optimized Copyable Cell Component with readable typography and slim borders
const CopyableCell = React.memo(({ value, onChange, placeholder, colorClass, isGenerating, onCopy }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  };

  return (
    <div className="w-full h-full relative group/cell">
      <textarea 
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full h-full bg-slate-900/60 hover:bg-slate-900/90 focus:bg-slate-950 text-slate-100 border border-slate-700/80 hover:border-slate-500 focus:border-blue-500 rounded px-1.5 py-0.5 text-[11px] leading-[14px] resize-none focus:ring-1 focus:ring-blue-500/40 outline-none custom-scrollbar placeholder:text-slate-500 font-medium transition-all",
          colorClass,
          isGenerating && "opacity-50 blur-[1px]"
        )}
        placeholder={placeholder}
      />
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <RefreshCw size={12} className="animate-spin text-blue-400 opacity-90" />
        </div>
      )}
      <button 
        onClick={handleCopy}
        className={cn(
          "absolute top-0.5 right-1 p-0.5 bg-slate-800 text-slate-200 border border-slate-600 rounded opacity-0 group-hover/cell:opacity-100 transition-all hover:bg-slate-700 shadow-2xs cursor-pointer z-10",
          copied && "opacity-100 bg-emerald-600 text-white border-emerald-400"
        )}
        title="Copy Content"
      >
        {copied ? <Check size={8} /> : <Copy size={8} />}
      </button>
    </div>
  );
});

// Optimized Row Component for Virtualization
const FileRow = React.memo(({ index, style, data }: any) => {
  const { files, updateFile, regenerateSingleFile, downloadWithMetadata, deleteFile, isGenerating, openErrorModal, openPreviewModal, selectedFileId, setSelectedFileId } = data;
  const file = files[index];
  if (!file) return null;

  const isSelected = selectedFileId === file.id;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFile(file.id);
  };

  return (
    <div 
      style={style}
      onClick={() => {
        if (setSelectedFileId) setSelectedFileId(file.id);
      }}
      onDoubleClick={() => {
        if (openPreviewModal) openPreviewModal(file);
      }}
      className={cn(
        "flex flex-row w-full hover:bg-primary/5 transition-colors group items-center border-b border-border/40 bg-background cursor-pointer",
        isSelected && "bg-primary/10 border-l-4 border-l-primary ring-1 ring-inset ring-primary/20",
        file.status === 'generating' && "bg-blue-500/5"
      )}
    >
      {/* 1. Filename & Thumbnail: 18% (min 190px) */}
      <div className="w-[18%] min-w-[190px] px-1.5 py-1 border-r border-border/40 flex items-center gap-2 overflow-hidden shrink-0 h-full">
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (openPreviewModal) openPreviewModal(file);
            if (setSelectedFileId) setSelectedFileId(file.id);
          }}
          className="w-10 h-10 bg-secondary rounded border border-border/60 flex-shrink-0 overflow-hidden relative shadow-2xs cursor-pointer hover:border-primary hover:scale-105 transition-all group/thumb"
          title="Click to view full preview & metadata"
        >
          {file.previewUrl ? (
            <img src={file.previewUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/40">
              <FileText size={16} />
              <span className="text-[7px] font-bold uppercase mt-0.5 opacity-80">{file.fileType || 'FILE'}</span>
            </div>
          )}
          {(file.status === 'completed' || file.status === 'saved') && (
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-background flex items-center justify-center shadow-xs" title="Processed">
              <CheckCircle2 size={8} className="text-white" />
            </div>
          )}
          {(file.status === 'generating' || file.status === 'retrying') && (
            <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center backdrop-blur-[1px]">
              <RefreshCw size={12} className="animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <input 
            type="text"
            value={file.filename}
            onChange={(e) => updateFile(file.id, { filename: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-bold text-foreground truncate leading-tight uppercase tracking-tight bg-transparent hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded-xs px-1 py-0.5 w-full outline-none transition-all cursor-text border border-transparent hover:border-border/40"
            title={file.filename}
          />
          <div className="flex items-center gap-1 mt-0.5">
            <span 
              onClick={(e) => {
                if (file.status === 'error' && file.errorMessage) {
                  e.stopPropagation();
                  openErrorModal(file.errorMessage, file.filename);
                }
              }}
              className={cn(
                "text-[7px] font-black px-1.5 py-0.2 rounded-xs uppercase tracking-widest border group relative cursor-help",
                (file.status === 'completed' || file.status === 'saved') ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" :
                (file.status === 'generating' || file.status === 'retrying') ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 animate-pulse" :
                file.status === 'error' ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40" : "bg-secondary text-foreground border-border/40"
              )}
            >
              {file.status}
              {file.status === 'error' && file.errorMessage && (
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-background border border-red-500/50 rounded shadow-2xl text-[10px] font-bold text-red-400 z-[100] hidden group-hover:block break-words normal-case backdrop-blur-xl ring-1 ring-red-500/20">
                  <div className="flex items-center gap-2 mb-2 border-b border-red-500/20 pb-1 text-red-500">
                    <AlertCircle size={12} />
                    <span className="tracking-widest">ERROR DETAILS</span>
                  </div>
                  <div className="opacity-90 leading-relaxed">
                    {file.errorMessage}
                  </div>
                </div>
              )}
            </span>
            {file.status === 'pending' && (
              <button 
                onClick={(e) => { e.stopPropagation(); regenerateSingleFile(file.id); }}
                className="text-[7px] font-black px-1.5 py-0.2 rounded-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-0.5 shadow-xs active:scale-95 transition-transform"
                title="Generate AI metadata for this specific file"
              >
                <Sparkles size={7} />
                <span>GEN</span>
              </button>
            )}
            {(file.status === 'error' || file.status === 'completed' || file.status === 'saved') && (
              <button 
                onClick={(e) => { e.stopPropagation(); regenerateSingleFile(file.id); }}
                className={cn(
                  "text-[6px] font-black px-1 py-0.2 rounded-xs uppercase tracking-widest transition-colors flex items-center gap-0.5 shadow-xs active:scale-95 border border-border/40",
                  file.status === 'error' ? "bg-red-600 text-white hover:bg-red-500" : "bg-primary text-primary-foreground hover:opacity-90"
                )}
                title="Re-generate AI metadata for this file"
              >
                <RefreshCw size={6} />
                {file.status === 'error' ? 'RETRY' : (file.status === 'completed' || file.status === 'saved') ? 'REGEN' : 'GEN'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Title: 22% (min 230px) */}
      <div className="w-[22%] min-w-[230px] p-1 border-r border-border/40 h-full shrink-0">
        <CopyableCell 
          value={file.title}
          onChange={(val: string) => updateFile(file.id, { title: val })}
          placeholder="TITLE..."
          colorClass="text-foreground font-semibold"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      {/* 3. Keywords: 26% (min 270px) */}
      <div className="w-[26%] min-w-[270px] p-1 border-r border-border/40 h-full shrink-0">
        <CopyableCell 
          value={file.keywords}
          onChange={(val: string) => updateFile(file.id, { keywords: val })}
          placeholder="KEYWORDS..."
          colorClass="text-foreground"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      {/* 4. Description: 18% (min 190px) */}
      <div className="w-[18%] min-w-[190px] p-1 border-r border-border/40 h-full shrink-0">
        <CopyableCell 
          value={file.description}
          onChange={(val: string) => updateFile(file.id, { description: val })}
          placeholder="DESCRIPTION..."
          colorClass="text-foreground"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      {/* 5. Category: 5% (min 65px) */}
      <div className="w-[5%] min-w-[65px] p-1 border-r border-border/40 h-full shrink-0">
        <CopyableCell 
          value={file.category}
          onChange={(val: string) => updateFile(file.id, { category: val })}
          placeholder="CATEGORY..."
          colorClass="text-foreground font-medium text-center"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      {/* 6. KW Count & Score: 4% (min 50px) */}
      <div className="w-[4%] min-w-[50px] p-1 border-r border-border/40 h-full shrink-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[10px] font-black text-foreground bg-secondary px-1.5 py-0.5 rounded border border-border/60 shadow-2xs">
          {file.keywords ? file.keywords.split(',').filter(Boolean).length : 0}
        </span>
        {file.keywordScore && (
          <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
            {file.keywordScore}%
          </span>
        )}
      </div>

      {/* 7. Rating 5★ & SAVE: 7% (min 95px) */}
      <div className="w-[7%] min-w-[95px] px-1 py-1 h-full shrink-0 flex flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateFile(file.id, { rating: star });
              }}
              className="p-0.2 hover:scale-125 transition-transform cursor-pointer"
              title={`Rating: ${file.rating !== undefined && file.rating > 0 ? file.rating : 5} Stars`}
            >
              <Star 
                size={10} 
                className={cn(
                  "transition-all",
                  star <= (file.rating !== undefined && file.rating > 0 ? file.rating : 5) 
                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.6)]" 
                    : "text-muted-foreground/25 hover:text-amber-300"
                )} 
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {file.status === 'saved' ? (
            <span 
              className="px-1.5 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/60 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-xs" 
              title="সরাসরি আসল ফাইলে ৫-স্টার মেটাডাটা সেভ হয়েছে"
            >
              <CheckCircle2 size={9} />
              <span>SAVED</span>
            </span>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); downloadWithMetadata(file.id); }}
              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="কোনো ডাউনলোড ছাড়াই সরাসরি এই ফাইলে ৫-স্টার মেটাডাটা সেভ করুন"
            >
              <Save size={9} />
              <span>SAVE</span>
            </button>
          )}
          <button 
            onClick={handleDelete}
            className="p-0.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Delete file"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
});

// Helper to get initial storage
const getSavedConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error parsing saved config:", e);
  }
  return null;
};

const initialSaved = getSavedConfig();

export default function App() {
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    return initialSaved?.apiConfig || {
      gemini: ['', '', '', '', ''],
      groq: ['', '', '', '', ''],
      mistral: ['', '', '', '', '']
    };
  });

  const [activeKey, setActiveKey] = useState<{provider: keyof ApiConfig, index: number}>(() => {
    return initialSaved?.activeKey || {
      provider: 'gemini',
      index: 0
    };
  });

  const [settings, setSettings] = useState<GeneratorSettings>(() => {
    const defaultSettings: GeneratorSettings = {
      titleLength: [30, 70],
      descriptionLength: [100, 200],
      keywordsCount: 30,
      autoDownload: false,
      promptMode: 'default',
      customPrompt: '',
      optimizeKeywords: true,
      minTitleWords: 5,
      maxTitleWords: 15,
      minDescriptionWords: 15,
      maxDescriptionWords: 30,
      minKeywords: 10,
      maxKeywords: 50,
      titleChoice: 1,
      metadataFor: 'all',
      singleWordKeywords: false,
      silhouette: false,
      transparentBackground: false,
      prohibitedWords: false,
      customPromptEnabled: false,
      autoGenerateOnAdd: false,
      savedKeywords: [],
      concurrency: 2
    };
    return initialSaved?.settings ? { ...defaultSettings, ...initialSaved.settings } : defaultSettings;
  });

  const [files, setFiles] = useState<StockMetadata[]>([]);
  const [fileObjects, setFileObjects] = useState<Record<string, File>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const stopRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      setCooldownTimer(30);
      const interval = setInterval(() => {
        setCooldownTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPaused]);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'image' | 'vector' | 'video' | 'prompt'>('vector');
  const [theme, setTheme] = useState<'classic' | 'dark' | 'light' | 'blue'>(() => {
    return (localStorage.getItem('app-theme') as any) || 'classic';
  });
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const [genOptions, setGenOptions] = useState({
    description: true,
    filenameHint: true,
    autoEmbed: false,
    autoRetry: true,
    pngIsolated: true,
    refinePngBg: false,
    autoSave: false,
    autoExport: false,
    aiEnhance: false
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const formatFilename = useCallback((text: string) => {
    if (!text || !text.trim()) return '';
    let clean = text.trim();
    // Remove characters illegal in file systems on Windows/Mac/Linux: \ / : * ? " < > | #
    clean = clean.replace(/[/\\?%*:|"<>#]/g, '');
    // Replace punctuation, brackets, quotes with space
    clean = clean.replace(/[,;()[\]{}"'`~+=]/g, ' ');
    // Collapse whitespace and underscores to single hyphen
    clean = clean.replace(/[\s_]+/g, '-').replace(/-+/g, '-');
    clean = clean.replace(/^[.-]+|[.-]+$/g, '');
    return clean.toLowerCase();
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<StockMetadata>) => {
    setFiles(prev => {
      const exists = prev.find(f => f.id === id);
      if (!exists) return prev;
      
      return prev.map(f => {
        if (f.id === id) {
          const newMetadata = { ...f, ...updates };
          // Ensure originalFilename is never lost
          if (!newMetadata.originalFilename) {
            newMetadata.originalFilename = f.originalFilename || f.filename;
          }
          if (updates.title !== undefined && updates.filename === undefined && updates.title.trim()) {
            const extension = f.filename.split('.').pop() || f.fileType || 'jpg';
            const formatted = formatFilename(updates.title);
            if (formatted) {
              newMetadata.filename = `${formatted}.${extension}`;
            }
          }
          return newMetadata;
        }
        return f;
      });
    });
  }, [formatFilename]);

  const deleteFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setFileObjects(prev => {
      const newObjs = { ...prev };
      delete newObjs[id];
      return newObjs;
    });
  }, []);

  const showNotification = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setNotification({ message, type });
  };
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string; filename: string }>({ isOpen: false, message: '', filename: '' });

  const openErrorModal = useCallback((message: string, filename: string) => {
    setErrorModal({ isOpen: true, message, filename });
  }, []);

  const [previewModalFileId, setPreviewModalFileId] = useState<string | null>(null);
  const previewModalFile = useMemo(() => {
    if (!previewModalFileId) return null;
    return files.find(f => f.id === previewModalFileId) || null;
  }, [previewModalFileId, files]);
  const openPreviewModal = useCallback((file: StockMetadata) => {
    setPreviewModalFileId(file.id);
  }, []);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [selectedExportSite, setSelectedExportSite] = useState('adobe');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({});
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [showIframeModal, setShowIframeModal] = useState(false);

  const isInIframe = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  const ensureDirectoryHandle = async (): Promise<any> => {
    if (isInIframe) {
      setShowIframeModal(true);
      return null;
    }

    if (directoryHandle) {
      try {
        if (typeof directoryHandle.queryPermission === 'function') {
          let perm = await directoryHandle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted' && typeof directoryHandle.requestPermission === 'function') {
            perm = await directoryHandle.requestPermission({ mode: 'readwrite' });
          }
          if (perm === 'granted') {
            return directoryHandle;
          }
        } else {
          return directoryHandle;
        }
      } catch (e) {
        console.warn("Existing directoryHandle permission check:", e);
      }
    }
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (handle) {
          if (typeof handle.requestPermission === 'function') {
            try {
              const p = await handle.requestPermission({ mode: 'readwrite' });
              if (p !== 'granted') {
                showNotification("ফোল্ডারে লেখার পারমিশন দেওয়া হয়নি।", 'error');
                return null;
              }
            } catch (pErr) {}
          }
          setDirectoryHandle(handle);
          setFolderName(handle.name);
          return handle;
        }
        return null;
      } catch (err: any) {
        if (err.name === 'SecurityError' || err.message?.includes('sub frame') || err.message?.includes('Cross-origin')) {
          setShowIframeModal(true);
        } else if (err.name !== 'AbortError') {
          showNotification("ফোল্ডার নির্বাচন বাতিল বা পারমিশন দেওয়া হয়নি। কোনো ফাইল ডাউনলোড করা হয়নি।", 'error');
        }
        return null;
      }
    } else {
      showNotification("আপনার ব্রাউজারে File System Access API নেই। ফাইলে সরাসরি সেভ করতে Google Chrome বা Microsoft Edge ব্রাউজার ব্যবহার করুন।", 'error');
      return null;
    }
  };
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedConfig = localStorage.getItem(STORAGE_KEY);
        if (savedConfig) {
          const { apiConfig: savedApi, settings: savedSettings, activeKey: savedActiveKey } = JSON.parse(savedConfig);
          
          if (savedApi) {
            setApiConfig(prev => ({
              ...prev,
              ...savedApi
            }));
          }
          
          if (savedSettings) {
            setSettings(prev => ({
              ...prev,
              ...savedSettings
            }));
          }
          
          if (savedActiveKey) {
            setActiveKey(savedActiveKey);
          }
        }

        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        // Ensure the loader stays for at least 800ms for visual consistency
        setTimeout(() => setIsAppLoading(false), 800);
      }
    };

    loadData();
  }, []);

  // Save config to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig, settings, activeKey }));
    } catch (err) {
      console.error("Failed to save config to local storage:", err);
    }
  }, [apiConfig, settings, activeKey]);

  // Save history to local storage with optimization
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Strip non-serializable and heavy data from history
        const optimizedHistory = history.map(item => ({
          ...item,
          files: item.files.map(f => ({
            ...f,
            previewUrl: undefined,
            handle: undefined
          }))
        }));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(optimizedHistory));
      } catch (err) {
        console.error("Failed to save history to local storage:", err);
        if (history.length > 5) {
          setHistory(prev => prev.slice(0, 5));
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [history]);

  // Handle Theme Switching
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'blue', 'light', 'classic');
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (theme === 'blue') {
      root.classList.add('blue');
      root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('classic');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('app-theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDirectorySelect = async () => {
    if (isInIframe) {
      setShowIframeModal(true);
      return;
    }
    if (!('showDirectoryPicker' in window)) {
      document.getElementById('folder-upload')?.click();
      showNotification("সরাসরি ফোল্ডারে ফাইল সেভ ও রিনেম করতে Google Chrome বা Microsoft Edge ব্যবহার করুন।", 'info');
      return;
    }
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (typeof handle.requestPermission === 'function') {
        try {
          const perm = await handle.requestPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            showNotification("ফোল্ডারে লেখার পারমিশন দেওয়া হয়নি।", 'error');
            return;
          }
        } catch (pErr) {}
      }
      setIsLoadingFiles(true);
      setDirectoryHandle(handle);
      setFolderName(handle.name);
      const newItems: StockMetadata[] = [];
      const newFileObjects: Record<string, File> = {};
      
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const allowedMedia = [
            'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif',
            'eps', 'ai', 'svg',
            'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'
          ];
          if (allowedMedia.includes(ext)) {
            const id = Math.random().toString(36).substr(2, 9);
            newFileObjects[id] = file;
            const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'gif', 'avif', 'tif', 'tiff', 'heic'];
            const isImage = imageExtensions.includes(ext) || (Boolean(file.type) && file.type.startsWith('image/'));
            newItems.push({
              id,
              filename: file.name,
              originalFilename: file.name,
              title: '',
              description: '',
              keywords: '',
              rating: 5,
              status: 'pending',
              fileType: ext,
              previewUrl: isImage ? URL.createObjectURL(file) : undefined,
              handle: entry
            });
          }
        }
      }

      if (newItems.length === 0) {
        showNotification(`"${handle.name}" ফোল্ডারে কোনো সাপোর্ট করা ফাইল পাওয়া যায়নি।`, 'info');
        return;
      }

      setFileObjects(prev => ({ ...prev, ...newFileObjects }));
      setFiles(prev => [...newItems, ...prev]);
      if (newItems.length > 0) {
        setSelectedFileId(prev => prev || newItems[0].id);
      }

      // Async extract EPS & Video thumbnails
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const file = newFileObjects[item.id];
        if (!file) continue;
        const ext = item.fileType.toLowerCase();
        if (ext === 'eps' || ext === 'ai') {
          extractEpsThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        } else if (['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext)) {
          extractVideoThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        }
      }

      showNotification(`"${handle.name}" ফোল্ডার কানেক্ট হয়েছে (${newItems.length} ফাইল)। এখন 'Embed' বাটনে ক্লিক করার সাথে সাথে মূল ফোল্ডারের আসল ফাইলগুলোতে সরাসরি পরিবর্তন হবে!`, 'success');
    } catch (err: any) {
      if (err.name === 'SecurityError' || err.message?.includes('sub frames') || err.message?.includes('Cross origin')) {
        setShowIframeModal(true);
      } else if (err.name !== 'AbortError') {
        console.error("Directory access denied or failed:", err);
        showNotification(`Folder error: ${err.message}`, 'error');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFileSelectDirect = async () => {
    if (isInIframe) {
      setShowIframeModal(true);
      return;
    }
    if (!('showOpenFilePicker' in window)) {
      document.getElementById('file-upload')?.click();
      return;
    }
    try {
      // @ts-ignore
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'All Media & Stock Assets (Images, Vectors & Videos)',
            accept: {
              'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.gif', '.heic', '.svg'],
              'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'],
              'application/postscript': ['.eps', '.ai'],
              'image/svg+xml': ['.svg']
            }
          }
        ]
      });

      setIsLoadingFiles(true);
      const newItems: StockMetadata[] = [];
      const newFileObjects: Record<string, File> = {};

      for (const handle of fileHandles) {
        const file = await handle.getFile();
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const id = Math.random().toString(36).substr(2, 9);
        
        newFileObjects[id] = file;
        const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'gif', 'avif', 'tif', 'tiff', 'heic'];
        const isImage = imageExtensions.includes(ext) || (Boolean(file.type) && file.type.startsWith('image/'));
        newItems.push({
          id,
          filename: file.name,
          originalFilename: file.name,
          title: '',
          description: '',
          keywords: '',
          rating: 5,
          status: 'pending',
          fileType: ext,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          handle: handle
        });
      }
      setFileObjects(prev => ({ ...prev, ...newFileObjects }));
      setFiles(prev => [...newItems, ...prev]);
      if (newItems.length > 0) {
        setSelectedFileId(prev => prev || newItems[0].id);
      }

      // Async extract EPS & Video thumbnails
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        const file = newFileObjects[item.id];
        if (!file) continue;
        const ext = item.fileType.toLowerCase();
        if (ext === 'eps' || ext === 'ai') {
          extractEpsThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        } else if (['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext)) {
          extractVideoThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        }
      }

      showNotification(`${newItems.length}টি ফাইল সিলেক্ট করা হয়েছে। মেটাডাটা সরাসরি মূল ফাইলে সেভ হবে।`, 'success');
    } catch (err: any) {
      if (err.name === 'SecurityError' || err.message?.includes('sub frames') || err.message?.includes('Cross origin')) {
        setShowIframeModal(true);
      } else if (err.name !== 'AbortError') {
        console.error("File selection failed:", err);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleBulkEmbed = async () => {
    if (!('showDirectoryPicker' in window)) {
      showNotification("Your browser doesn't support folder access. Please use Chrome or Edge.", 'error');
      return;
    }

    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      setDirectoryHandle(dirHandle);
      
      const newItems: StockMetadata[] = [];
      const newFileObjects: Record<string, File> = {};

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['png', 'eps', 'mp4', 'mov'].includes(ext)) {
            const id = Math.random().toString(36).substr(2, 9);
            newFileObjects[id] = file;
            newItems.push({
              id,
              filename: file.name,
              originalFilename: file.name,
              title: '',
              description: '',
              keywords: '',
              rating: 5,
              status: 'pending',
              fileType: ext,
              previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
              handle: entry
            });
          }
        }
      }

      if (newItems.length === 0) {
        showNotification("No supported images or EPS files found in this folder.", 'info');
        return;
      }

      setFileObjects(prev => ({ ...prev, ...newFileObjects }));
      setFiles(prev => [...newItems, ...prev]);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Bulk embed failed:", err);
      }
    }
  };

  const saveMetadataToLocalFile = async (id: string, metadata: Partial<StockMetadata>, dirHandle?: any): Promise<boolean> => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata) return false;

    let actualFile = fileObjects[id];
    let activeDir = dirHandle || directoryHandle;

    // If file is missing in memory, try to reload it from folder handle if available
    if (!actualFile && activeDir && typeof activeDir.getFileHandle === 'function') {
      try {
        const lookupName = fileMetadata.originalFilename || fileMetadata.filename;
        const h = await activeDir.getFileHandle(lookupName);
        if (h) {
          actualFile = await h.getFile();
          setFileObjects(prev => ({ ...prev, [id]: actualFile! }));
        }
      } catch (e) {
        console.warn("Could not reload file from folder:", e);
      }
    }

    const fallbackExt = fileMetadata.fileType || (actualFile ? actualFile.name.split('.').pop() : 'jpg') || 'jpg';
    const rawTarget = (metadata.filename || fileMetadata.filename || (actualFile ? actualFile.name : `stock_${id}`)).trim();
    const originalFilename = fileMetadata.originalFilename || (actualFile ? actualFile.name : rawTarget);

    // Determine the desired target filename:
    // 1. Explicit filename passed in metadata that differs from original
    // 2. Or fileMetadata.filename if it differs from original
    // 3. Or if title is set and filename is still original: auto-derive SEO filename from title!
    let desiredName = (metadata.filename || '').trim();
    if (!desiredName || desiredName === originalFilename) {
      if (fileMetadata.filename && fileMetadata.filename.trim() !== originalFilename) {
        desiredName = fileMetadata.filename.trim();
      } else {
        const titleForName = (metadata.title || fileMetadata.title || '').trim();
        if (titleForName) {
          const formattedTitle = formatFilename(titleForName);
          if (formattedTitle) {
            desiredName = `${formattedTitle}.${fallbackExt}`;
          }
        }
      }
    }
    if (!desiredName) {
      desiredName = originalFilename;
    }

    const targetFilename = sanitizeFilenameForFs(desiredName, fallbackExt);
    const isRenamed = targetFilename !== originalFilename;

    // Single FileSystemFileHandle cannot rename/move itself on user local disk outside of OPFS.
    // If the file needs to be renamed and activeDir is not connected yet, prompt user for folder!
    if (isRenamed && !activeDir && typeof (window as any).showDirectoryPicker === 'function' && !isInIframe) {
      try {
        activeDir = await ensureDirectoryHandle();
      } catch (dirErr) {
        console.warn("Prompting for directory to rename failed:", dirErr);
      }
    }

    try {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'saving', errorMessage: undefined } : f));

      let outputBlob: Blob;
      if (actualFile) {
        try {
          const ratingVal = (metadata.rating !== undefined && metadata.rating > 0)
            ? metadata.rating
            : (fileMetadata.rating !== undefined && fileMetadata.rating > 0) ? fileMetadata.rating : 5;
          const titleVal = (metadata.title || fileMetadata.title || originalFilename.replace(/\.[^/.]+$/, '')).trim();
          const descVal = (metadata.description || fileMetadata.description || titleVal).trim();
          const kwVal = (metadata.keywords || fileMetadata.keywords || '').trim();

          outputBlob = await prepareEmbeddedBlob(actualFile, { 
            ...fileMetadata, 
            ...metadata, 
            filename: targetFilename,
            rating: ratingVal,
            title: titleVal,
            description: descVal,
            keywords: kwVal
          });
        } catch (embErr) {
          console.warn("Embed failed, falling back to original file:", embErr);
          outputBlob = actualFile;
        }
      } else {
        console.warn(`File ${id} has no binary object in memory.`);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: 'ফাইল অবজেক্ট পাওয়া যায়নি' } : f));
        return false;
      }

      // Update in-memory file object
      const updatedFile = new File([outputBlob], targetFilename, { type: actualFile.type || 'image/jpeg' });
      setFileObjects(prev => ({ ...prev, [id]: updatedFile }));

      // 1. Direct Folder In-Place Save & Rename (Overwrites/creates targetFilename on disk and deletes originalFilename)
      if (activeDir && typeof activeDir.getFileHandle === 'function') {
        try {
          if (typeof activeDir.queryPermission === 'function') {
            let perm = await activeDir.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted' && typeof activeDir.requestPermission === 'function') {
              perm = await activeDir.requestPermission({ mode: 'readwrite' });
            }
          }
        } catch (permErr) {
          console.warn("Folder permission check:", permErr);
        }

        let newFileHandle: any = null;
        try {
          newFileHandle = await activeDir.getFileHandle(targetFilename, { create: true });
        } catch (nameErr) {
          console.warn("Failed to get handle for targetFilename:", targetFilename, nameErr);
          const safeName = sanitizeFilenameForFs(`asset_${id}_${Date.now()}`, fallbackExt);
          newFileHandle = await activeDir.getFileHandle(safeName, { create: true });
        }

        if (newFileHandle && typeof newFileHandle.createWritable === 'function') {
          try {
            const writable = await newFileHandle.createWritable({ keepExistingData: false });
            await writable.write(outputBlob);
            await writable.close();

            // Clean up redundant .xmp sidecars if present
            try {
              await activeDir.removeEntry(`${targetFilename}.xmp`);
            } catch (e) {}

            // If renamed, delete old unrenamed file from folder!
            if (isRenamed) {
              // Case-insensitive check: if only letter case changed on Windows (e.g. DSC.JPG -> dsc.jpg),
              // deleting originalFilename might delete the newly written file on Windows NTFS!
              if (originalFilename.toLowerCase() !== targetFilename.toLowerCase()) {
                try {
                  await activeDir.removeEntry(originalFilename);
                } catch (delErr) {
                  // Fallback: search folder entries case-insensitively to remove old file
                  try {
                    for await (const entry of activeDir.values()) {
                      if (entry.kind === 'file' && 
                          entry.name.toLowerCase() === originalFilename.toLowerCase() && 
                          entry.name.toLowerCase() !== targetFilename.toLowerCase()) {
                        await activeDir.removeEntry(entry.name);
                        break;
                      }
                    }
                  } catch (scanErr) {
                    console.warn("Folder scan removal failed:", scanErr);
                  }
                }

                try {
                  await activeDir.removeEntry(`${originalFilename}.xmp`);
                } catch (delXmpErr) {}
              }
            }

            setFiles(prev => prev.map(f => f.id === id ? { 
              ...f, 
              status: 'saved', 
              handle: newFileHandle, 
              filename: targetFilename,
              originalFilename: targetFilename,
              errorMessage: undefined
            } : f));

            return true;
          } catch (writeErr) {
            console.warn("Write to file handle failed, falling back:", writeErr);
          }
        }
      } 
      
      // 2. Direct Single File Handle Save (when folder handle is not available)
      if (fileMetadata.handle && typeof fileMetadata.handle.createWritable === 'function') {
        let handleWriteOk = false;
        try {
          if (typeof fileMetadata.handle.queryPermission === 'function') {
            let perm = await fileMetadata.handle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted' && typeof fileMetadata.handle.requestPermission === 'function') {
              perm = await fileMetadata.handle.requestPermission({ mode: 'readwrite' });
            }
          }

          // In standard web browsers, handle.move() is not supported on user disk files outside OPFS
          if (isRenamed && typeof (fileMetadata.handle as any).move === 'function') {
            try {
              await (fileMetadata.handle as any).move(targetFilename);
            } catch (mErr) {
              console.warn("Handle move not supported:", mErr);
            }
          }

          const writable = await fileMetadata.handle.createWritable({ keepExistingData: false });
          await writable.write(outputBlob);
          await writable.close();
          handleWriteOk = true;
        } catch (hErr) {
          console.warn("Direct handle save failed:", hErr);
          handleWriteOk = false;
        }

        if (handleWriteOk) {
          if (isRenamed) {
            showNotification(`"${originalFilename}" ফাইলে মেটাডাটা সেভ হয়েছে। কিন্তু ফাইলের নাম "${targetFilename}"-এ পরিবর্তন করতে 'Add Folder' দিয়ে ফোল্ডার কানেক্ট করুন।`, 'info');
          }
          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            status: 'saved', 
            filename: isRenamed ? targetFilename : f.filename,
            originalFilename: isRenamed ? originalFilename : targetFilename,
            errorMessage: undefined
          } : f));
          return true;
        }
      }

      // 3. If neither folder handle nor file handle is connected or writable:
      if (!activeDir && typeof (window as any).showDirectoryPicker === 'function') {
        try {
          const pickedDir = await ensureDirectoryHandle();
          if (pickedDir) {
            return await saveMetadataToLocalFile(id, metadata, pickedDir);
          }
        } catch (dirErr) {
          console.warn("Directory pick error:", dirErr);
        }
      }

      // If user cancelled or folder couldn't be connected, DO NOT DOWNLOAD!
      showNotification(`"${targetFilename}" ফাইলটি সরাসরি রিনেম ও সেভ করতে 'Add Folder' দিয়ে ফোল্ডার কানেক্ট করুন। কোনো ফাইল ডাউনলোড করা হয়নি।`, 'error');
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        errorMessage: 'ফোল্ডার কানেক্ট করা নেই। কোনো ফাইল ডাউনলোড হয়নি।' 
      } : f));
      return false;
    } catch (err: any) {
      console.warn("saveMetadataToLocalFile safe catch:", err);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        errorMessage: err.message || 'সেভ করা সম্ভব হয়নি' 
      } : f));
      return false;
    }
  };

  const handleEmbedAll = async () => {
    await handleEmbed('all');
  };

  const downloadPhotoshopScript = () => {
    const completedFiles = files.filter(f => f.status === 'completed' || f.status === 'saved');
    if (completedFiles.length === 0) {
      showNotification("No completed files found to generate Photoshop script.", 'info');
      return;
    }
    const scriptContent = generatePhotoshopScript(completedFiles);
    const blob = new Blob([scriptContent], { type: 'application/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Photoshop_AutoEmbed_Rename.jsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Downloaded Photoshop_AutoEmbed_Rename.jsx! Run in Photoshop (File > Scripts > Browse)", 'success');
  };

  const downloadIllustratorScript = () => {
    const epsFiles = files.filter(f => (f.status === 'completed' || f.status === 'saved') && ['eps', 'ai', 'svg'].includes(f.fileType.toLowerCase()));
    if (epsFiles.length === 0) {
      showNotification("No completed EPS/vector files found to generate Illustrator script.", 'info');
      return;
    }
    const scriptContent = generateIllustratorScript(epsFiles);
    const blob = new Blob([scriptContent], { type: 'application/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Illustrator_AutoEmbed_Rename.jsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Downloaded Illustrator_AutoEmbed_Rename.jsx! Run in Illustrator (File > Scripts > Other Script)", 'success');
  };

  const handleDownloadZip = async () => {
    const candidateFiles = files.filter(f => f.status === 'completed' || f.status === 'saved' || (f.title && f.title.trim().length > 0) || (f.keywords && f.keywords.trim().length > 0));
    if (candidateFiles.length === 0) {
      showNotification("No files to bundle into ZIP. Please generate or enter metadata first.", 'info');
      return;
    }

    showNotification(`Packaging ${candidateFiles.length} renamed & embedded files into ZIP...`, 'info');
    const zip = new JSZip();

    for (const item of candidateFiles) {
      const file = fileObjects[item.id];
      if (!file) continue;

      const ext = item.fileType.toLowerCase();
      const targetFilename = item.filename;

      try {
        const embeddedBlob = await prepareEmbeddedBlob(file, item);
        zip.file(targetFilename, embeddedBlob);
      } catch (e) {
        console.warn(`Error bundling ${targetFilename}:`, e);
        zip.file(targetFilename, file);
      }
    }

    // Also include both Photoshop & Illustrator JSX scripts inside the ZIP bundle!
    const psScript = generatePhotoshopScript(candidateFiles);
    zip.file("Run_in_Adobe_Photoshop.jsx", psScript);

    const epsFiles = candidateFiles.filter(f => ['eps', 'ai', 'svg'].includes(f.fileType.toLowerCase()));
    if (epsFiles.length > 0) {
      const aiScript = generateIllustratorScript(epsFiles);
      zip.file("Run_in_Adobe_Illustrator.jsx", aiScript);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SS_SMART_META_Renamed_5Star_Assets_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("ZIP Bundle Downloaded with Renamed Files, 5 Stars, IPTC/EXIF/XMP & Adobe Scripts!", 'success');
  };

  const renameAllByTitle = () => {
    let count = 0;
    setFiles(prev => prev.map(f => {
      if (f.title && f.title.trim()) {
        const ext = f.filename.split('.').pop() || f.fileType || 'jpg';
        const formatted = formatFilename(f.title);
        if (formatted) {
          count++;
          return {
            ...f,
            filename: `${formatted}.${ext}`
          };
        }
      }
      return f;
    }));
    showNotification(`Renamed ${count} files based on their Titles!`, 'success');
  };

  const regenerateSingleFile = async (id: string) => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata || fileMetadata.status === 'generating') return;

    const currentKey = apiConfig[activeKey.provider][activeKey.index];
    if (!currentKey && activeKey.provider !== 'gemini') {
      showNotification("Selected API Key is empty. Please configure it in settings.", 'error');
      return;
    }

    const actualFile = fileObjects[id];
    if (!actualFile) {
      showNotification("Original file data not found. Please re-upload.", 'error');
      return;
    }

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'generating', errorMessage: undefined } : f));

    try {
      const result = await generateMetadata(actualFile, settings, { [activeKey.provider]: currentKey }, activeKey.provider);
      const extension = fileMetadata.filename.split('.').pop() || fileMetadata.fileType;
      const newFilename = `${formatFilename(result.title)}.${extension}`;

      const updatedMetadata: StockMetadata = { 
        ...fileMetadata, 
        ...result, 
        originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
        filename: newFilename,
        status: 'completed',
        errorMessage: undefined
      };

      // 1. Immediately apply all fields (title, keywords, description, category, rating, renamed filename)
      setFiles(prev => prev.map(f => f.id === id ? updatedMetadata : f));

      // 2. Prepare embedded blob and update in-memory file object
      try {
        const embeddedBlob = await prepareEmbeddedBlob(actualFile, updatedMetadata);
        const updatedFile = new File([embeddedBlob], newFilename, { type: actualFile.type });
        setFileObjects(prev => ({ ...prev, [id]: updatedFile }));
      } catch (embErr) {
        console.warn("In-memory embed warning:", embErr);
      }

      // 3. Auto-save in-place if folder or file handle is connected
      if (directoryHandle) {
        try {
          await saveMetadataToLocalFile(id, updatedMetadata, directoryHandle);
          showNotification(`✓ "${newFilename}": Metadata applied & saved directly in folder!`, 'success');
          return;
        } catch (dirErr: any) {
          console.warn("Direct folder auto-save failed:", dirErr);
        }
      } else if (fileMetadata.handle && 'createWritable' in fileMetadata.handle) {
        try {
          const embeddedBlob = await prepareEmbeddedBlob(actualFile, updatedMetadata);
          const writable = await fileMetadata.handle.createWritable();
          await writable.write(embeddedBlob);
          await writable.close();
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'saved' } : f));
          showNotification(`✓ "${newFilename}": Metadata applied & saved directly to file!`, 'success');
          return;
        } catch (handleErr) {
          console.warn("Direct handle save error:", handleErr);
        }
      } else if (genOptions.autoSave) {
        downloadWithMetadata(id);
        return;
      }

      showNotification(`✓ "${newFilename}": Title, keywords & description auto-applied!`, 'success');
    } catch (error: any) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: error.message } : f));
      showNotification(`Failed to generate ${fileMetadata.filename}: ${error.message}`, 'error');
    }
  };

  const startGeneration = async () => {
    if (isGenerating) return;
    
    let pendingFiles = filesRef.current.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0 && filesRef.current.length > 0) {
      setFiles(prev => prev.map(f => ({ ...f, status: 'pending' })));
      setTimeout(startGeneration, 100);
      return;
    }

    if (pendingFiles.length === 0) return;

    const currentKey = apiConfig[activeKey.provider][activeKey.index];
    if (!currentKey && activeKey.provider !== 'gemini') {
      showNotification("Selected API Key is empty. Please configure it in settings.", 'error');
      return;
    }

    setIsGenerating(true);
    stopRef.current = false;
    setProgress({ current: 0, total: pendingFiles.length });

    const concurrency = settings.concurrency || 3;
    const pending = [...pendingFiles];
    
    const processNext = async (index: number) => {
      // Stagger slightly only for concurrent workers (250ms)
      await new Promise(resolve => setTimeout(resolve, index * 250));
      
      while (!stopRef.current && pending.length > 0) {
        // If system is paused due to rate limit, wait
        while (isPausedRef.current && !stopRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (stopRef.current) break;

        const fileMetadata = pending.shift()!;
        
        // Check if file still exists in the list (wasn't deleted)
        if (!filesRef.current.some(f => f.id === fileMetadata.id)) {
          continue;
        }

        const actualFile = fileObjects[fileMetadata.id];
        
        if (!actualFile) {
          console.error("File object not found for:", fileMetadata.id);
          setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: 'error', errorMessage: "File data lost. Please re-upload." } : f));
          continue;
        }

        let retryCount = 0;
        const maxRetries = genOptions.autoRetry ? 3 : 0;

        while (retryCount <= maxRetries && !stopRef.current) {
          try {
            setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: retryCount > 0 ? 'retrying' : 'generating', errorMessage: undefined } : f));

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Generation timed out (45s)")), 45000)
            );
            
            const result = await Promise.race([
              generateMetadata(actualFile, settings, { [activeKey.provider]: currentKey }, activeKey.provider),
              timeoutPromise
            ]) as any;
            
            const extension = fileMetadata.filename.split('.').pop() || fileMetadata.fileType;
            const newFilename = `${formatFilename(result.title)}.${extension}`;
            
            const updatedMetadata = { 
              ...fileMetadata, 
              ...result, 
              originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
              filename: newFilename,
              status: 'completed' as const,
              errorMessage: undefined
            };

            setFiles(prev => prev.map(f => {
              if (f.id === fileMetadata.id) {
                return updatedMetadata;
              }
              return f;
            }));

            // Prepare embedded blob in memory
            prepareEmbeddedBlob(actualFile, updatedMetadata)
              .then(embeddedBlob => {
                const updatedFile = new File([embeddedBlob], newFilename, { type: actualFile.type });
                setFileObjects(prev => ({ ...prev, [fileMetadata.id]: updatedFile }));
              })
              .catch(e => console.warn("Memory embed warning:", e));

            // Direct in-place auto-save to local folder or file handle if enabled
            if (genOptions.autoSave) {
              if (directoryHandle) {
                saveMetadataToLocalFile(
                  fileMetadata.id,
                  updatedMetadata,
                  directoryHandle
                ).catch(saveErr => console.warn("Auto-save in place error:", saveErr));
              } else if (fileMetadata.handle && 'createWritable' in fileMetadata.handle) {
                saveMetadataToLocalFile(
                  fileMetadata.id,
                  updatedMetadata
                ).catch(saveErr => console.warn("Auto-save file handle error:", saveErr));
              }
            }

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            
            // Minimal delay between requests (300ms) for high speed
            if (pending.length > 0) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            break; // Success, exit retry loop
          } catch (error: any) {
            const errorMsg = error.message || "Unknown Error";
            
            // Handle Rate Limit (429) specifically
            if (errorMsg.includes("429") || errorMsg.includes("Rate limit") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
              console.warn("Rate limit hit! Backing off briefly (5s)...");
              setIsPaused(true);
              showNotification("Rate limit reached. Auto-resuming in 5s...", 'info');
              
              // Wait briefly (5 seconds) before automatically resuming
              await new Promise(resolve => setTimeout(resolve, 5000));
              setIsPaused(false);
              
              // Don't increment retry count for rate limits, just try again
              continue;
            }

            retryCount++;
            if (retryCount > maxRetries || stopRef.current) {
              console.error(`Error generating metadata for ${fileMetadata.filename}:`, error);
              setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: 'error', errorMessage: errorMsg } : f));
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            } else {
              console.log(`Retrying ${fileMetadata.filename} (${retryCount}/${maxRetries}) due to: ${errorMsg}`);
              setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, errorMessage: `Retry ${retryCount}: ${errorMsg}` } : f));
              await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // Exponential backoff
            }
          }
        }
      }
    };

    try {
      const initialBatch = Array.from({ length: Math.min(concurrency, pending.length) }, (_, i) => processNext(i));
      await Promise.all(initialBatch);
    } catch (err) {
      console.error("Batch processing error:", err);
    } finally {
      setIsGenerating(false);
      setIsPaused(false);
    }

    const finalFiles = filesRef.current;
    const newHistoryItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      files: [...finalFiles]
    };
    setHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
  };

  const handleTestConnection = async (provider: keyof ApiConfig, index: number) => {
    const key = apiConfig[provider][index];
    if (!key && provider !== 'gemini') {
      showNotification("Please enter an API key to test.", 'info');
      return;
    }
    
    setApiStatus(prev => ({ ...prev, [`${provider}-${index}`]: 'testing' }));
    const result = await testApiConnection(provider, key);
    
    if (result.success) {
      setApiStatus(prev => ({ ...prev, [`${provider}-${index}`]: 'connected' }));
      showNotification(`${provider.toUpperCase()} Connection Successful!`, 'success');
    } else {
      setApiStatus(prev => ({ ...prev, [`${provider}-${index}`]: 'failed' }));
      showNotification(result.message || `${provider.toUpperCase()} Connection Failed`, 'error');
    }
  };

  const handleExport = (format: string, exportAll: boolean = false) => {
    let targetFiles: StockMetadata[] = [];
    if (exportAll || format === 'all_files' || format === 'master_all') {
      targetFiles = files;
    } else {
      targetFiles = files.filter(f => f.status === 'completed' || f.status === 'saved' || f.title || f.keywords);
      if (targetFiles.length === 0) {
        targetFiles = files; // fallback to all files if none marked completed yet
      }
    }

    if (targetFiles.length === 0) {
      showNotification("No files to export! Please add assets to the workspace first.", 'info');
      return;
    }

    let content = '';
    let mimeType = 'text/csv;charset=utf-8;';
    let extension = 'csv';
    let filenamePrefix = format;

    if (format === 'json') {
      content = JSON.stringify(targetFiles, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      extension = 'json';
    } else if (format === 'txt') {
      content = targetFiles.map(f => 
        `FILE: ${f.filename}\nTITLE: ${f.title}\nDESC: ${f.description}\nKEYWORDS: ${f.keywords}\n\n`
      ).join('---\n');
      mimeType = 'text/plain;charset=utf-8;';
      extension = 'txt';
    } else {
      // Standard Stock Agency CSV Specifications
      let data: any[] = [];
      filenamePrefix = `${format}_metadata`;

      switch (format) {
        case 'all_files':
        case 'master_all':
          // Comprehensive All Files Master CSV with all fields
          filenamePrefix = 'all_files_metadata';
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Original Filename': f.originalFilename || f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Technology',
            'Rating': f.rating || 5,
            'File Type': (f.fileType || '').toUpperCase(),
            'Status': f.status || 'pending'
          }));
          break;

        case 'adobe':
          // Adobe Stock official contributor template
          // Headers: Filename, Title, Keywords, Category
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || f.filename.replace(/\.[^/.]+$/, ""),
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Technology'
          }));
          break;

        case 'shutterstock':
          // Shutterstock official contributor template
          // Headers: Filename, Description, Keywords, Categories
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Description': f.description || f.title || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Categories': f.category || 'Technology',
            'Editorial': 'no',
            'Mature content': 'no'
          }));
          break;

        case 'getty':
          // Getty Images / iStock ESP contributor template
          // Headers: file_name, title, description, keywords
          data = targetFiles.map(f => ({
            'file_name': f.filename,
            'title': f.title || '',
            'description': f.description || f.title || '',
            'keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(',')
          }));
          break;

        case 'freepik':
          // Freepik Contributor CSV template
          // Headers: File name, Title, Tags
          data = targetFiles.map(f => ({
            'File name': f.filename,
            'Title': f.title || '',
            'Tags': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(',')
          }));
          break;

        case 'vecteezy':
          // Vecteezy Contributor CSV template
          // Headers: Filename, Title, Description, Keywords
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || f.title || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(',')
          }));
          break;

        case 'alamy':
          // Alamy Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Caption': f.description || f.title || '',
            'Tags': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(',')
          }));
          break;

        case 'pond5':
          // Pond5 Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Technology'
          }));
          break;

        case 'dreamstime':
          // Dreamstime Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Technology'
          }));
          break;

        case 'csv':
        default:
          // Complete Standard Multi-Platform CSV
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Technology',
            'Rating': f.rating || 5
          }));
          break;
      }

      // Papa.unparse with strict quoting rules for clean Excel & platform imports
      content = Papa.unparse(data, {
        quotes: true, // Quotes ensure commas inside descriptions or titles never break columns
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ",",
        header: true,
        newline: "\r\n" // Standard CRLF for Microsoft Excel & CSV parsers
      });
    }

    // Add UTF-8 BOM (\uFEFF) so Excel opens UTF-8 characters and columns accurately without garbled text
    const blob = new Blob([format === 'json' || format === 'txt' ? content : `\uFEFF${content}`], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenamePrefix}_${Date.now()}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`Exported ${targetFiles.length} records in standard ${format.toUpperCase()} format!`, 'success');
  };

  const handleEmbed = async (type: 'image' | 'video' | 'eps' | 'all', targetSingleId?: string) => {
    if (isInIframe) {
      setShowIframeModal(true);
      return;
    }

    let activeDir = directoryHandle;

    // 1. If a specific single file is targeted
    if (targetSingleId) {
      const targetFile = files.find(f => f.id === targetSingleId);
      if (targetFile) {
        if (!activeDir && (!targetFile.handle || typeof targetFile.handle.createWritable !== 'function')) {
          showNotification(`"${targetFile.filename}" ফাইলে কোনো ডাউনলোড ছাড়া সরাসরি সেভ করতে ফোল্ডারটি নির্বাচন করুন...`, 'info');
          activeDir = await ensureDirectoryHandle();
          if (!activeDir) {
            showNotification(`ফোল্ডার নির্বাচন বাতিল হয়েছে। কোনো ফাইল ডাউনলোড করা হয়নি।`, 'error');
            return;
          }
        }
        setIsGenerating(true);
        showNotification(`"${targetFile.filename}" ফাইলে সরাসরি আসল স্থানে ৫-স্টার মেটাডাটা সেভ করা হচ্ছে...`, 'info');
        const ok = await saveMetadataToLocalFile(targetFile.id, targetFile, activeDir);
        setIsGenerating(false);
        if (ok) {
          showNotification(`✓ কোনো ডাউনলোড ছাড়াই সরাসরি আসল ফাইলে ৫-স্টার মেটাডাটা সেভ হয়েছে: "${targetFile.filename}"!`, 'success');
        }
        return;
      }
    }

    const candidateFiles = files.filter(f => {
      const ext = f.fileType.toLowerCase();
      if (type === 'image') return ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext);
      if (type === 'video') return ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext);
      if (type === 'eps') return ['eps', 'ai', 'svg'].includes(ext);
      return true;
    });

    if (candidateFiles.length === 0) {
      showNotification(`সেভ করার মতো কোনো ফাইল পাওয়া যায়নি। অনুগ্রহ করে ফাইল বা ফোল্ডার যোগ করুন।`, 'info');
      return;
    }

    // Ensure we have activeDir or file handles so we NEVER trigger browser downloads,
    // and if any file has been renamed, a folder handle is required to rename the file on disk.
    if (!activeDir) {
      const needsFolder = candidateFiles.some(f => {
        const orig = f.originalFilename || f.filename;
        const target = sanitizeFilenameForFs(f.filename, f.fileType || 'jpg');
        return target !== orig || !f.handle || typeof f.handle.createWritable !== 'function';
      });

      if (needsFolder) {
        showNotification("ফাইলগুলো রিনেম ও মেটাডাটা সরাসরি আসল ফোল্ডারে সেভ করতে ফোল্ডারটি নির্বাচন করুন...", 'info');
        activeDir = await ensureDirectoryHandle();
        if (!activeDir) {
          showNotification("ফোল্ডার নির্বাচন বাতিল করা হয়েছে। সরাসরি সেভ করতে 'Add Folder' ব্যবহার করুন।", 'error');
          return;
        }
      }
    }

    setIsGenerating(true);
    const targetLabel = activeDir?.name ? `"${activeDir.name}" ফোল্ডারে` : 'আসল ফাইলগুলোতে';
    showNotification(`${targetLabel} সরাসরি ৫-স্টার মেটাডাটা সেভ করা হচ্ছে (কোনো ডাউনলোড ছাড়া)...`, 'info');

    let directSavedCount = 0;

    for (const file of candidateFiles) {
      try {
        const saved = await saveMetadataToLocalFile(file.id, file, activeDir);
        if (saved) directSavedCount++;
      } catch (err) {
        console.warn(`Folder embed error for ${file.filename}:`, err);
      }
    }

    setIsGenerating(false);
    if (directSavedCount > 0) {
      showNotification(`✓ সফল! ${directSavedCount}টি ফাইল কোনো ডাউনলোড ছাড়াই সরাসরি আসল ফোল্ডারে মেটাডাটা সহ সেভ হয়েছে!`, 'success');
    } else {
      showNotification(`ফাইল সেভ সম্পন্ন হয়নি। কোনো ফাইল ডাউনলোড করা হয়নি।`, 'error');
    }
  };

  const filteredFiles = useMemo(() => {
    if (settings.metadataFor === 'all') return files;
    return files.filter(f => {
      const ext = f.fileType.toLowerCase();
      if (settings.metadataFor === 'image') return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      if (settings.metadataFor === 'video') return ['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(ext);
      if (settings.metadataFor === 'eps') return ['eps', 'ai', 'svg'].includes(ext);
      return true;
    });
  }, [files, settings.metadataFor]);

  const activeSelectedFile = useMemo(() => {
    if (selectedFileId) {
      const found = files.find(f => f.id === selectedFileId);
      if (found) return found;
    }
    return filteredFiles[0] || null;
  }, [selectedFileId, files, filteredFiles]);

  const handleModalNavigate = useCallback((direction: 'next' | 'prev') => {
    if (!previewModalFileId || filteredFiles.length <= 1) return;
    const currentIndex = filteredFiles.findIndex(f => f.id === previewModalFileId);
    if (currentIndex === -1) return;
    if (direction === 'next') {
      const nextIndex = (currentIndex + 1) % filteredFiles.length;
      setPreviewModalFileId(filteredFiles[nextIndex].id);
    } else {
      const prevIndex = (currentIndex - 1 + filteredFiles.length) % filteredFiles.length;
      setPreviewModalFileId(filteredFiles[prevIndex].id);
    }
  }, [previewModalFileId, filteredFiles]);

  const clearAll = () => {
    if (isGenerating) {
      stopRef.current = true;
      setIsGenerating(false);
    }
    const idsToRemove = filteredFiles.map(f => f.id);
    setFiles(prev => prev.filter(f => !idsToRemove.includes(f.id)));
    setFileObjects(prev => {
      const newObjs = { ...prev };
      idsToRemove.forEach(id => delete newObjs[id]);
      return newObjs;
    });
  };

  const exportCsv = () => {
    handleExport(selectedExportSite || 'csv');
  };

  const downloadWithMetadata = async (id: string) => {
    const fileMetadata = files.find(f => f.id === id);
    const actualFile = fileObjects[id];
    if (!fileMetadata || !actualFile) return;

    let activeDir = directoryHandle;

    const fallbackExt = fileMetadata.fileType || (actualFile ? actualFile.name.split('.').pop() : 'jpg') || 'jpg';
    const rawTarget = (fileMetadata.filename || (actualFile ? actualFile.name : `stock_${id}`)).trim();
    const originalFilename = fileMetadata.originalFilename || (actualFile ? actualFile.name : rawTarget);
    const targetFilename = sanitizeFilenameForFs(rawTarget, fallbackExt);
    const isRenamed = targetFilename !== originalFilename;

    if (!activeDir && (isRenamed || !fileMetadata.handle || typeof fileMetadata.handle.createWritable !== 'function')) {
      showNotification(`"${targetFilename}" ফাইলে কোনো ডাউনলোড ছাড়া সরাসরি রিনেম ও সেভ করতে মূল ফোল্ডারটি নির্বাচন করুন...`, 'info');
      activeDir = await ensureDirectoryHandle();
      if (!activeDir) {
        showNotification(`ফোল্ডার নির্বাচন বাতিল হয়েছে। কোনো ফাইল ডাউনলোড করা হয়নি।`, 'error');
        return;
      }
    }

    const ok = await saveMetadataToLocalFile(id, fileMetadata, activeDir);
    if (ok) {
      showNotification(`✓ সরাসরি ফাইলে ৫-স্টার মেটাডাটা ও রিনেম সেভ হয়েছে: "${targetFilename}"!`, 'success');
    }
  };

  const handleFilesAdded = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif',
      'eps', 'ai', 'svg',
      'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'
    ];
    
    // Pre-filter files to avoid unnecessary processing
    const validFiles = filesArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0 && filesArray.length > 0) {
      showNotification(`No valid files found.`, 'error');
      return;
    }

    const newItems: StockMetadata[] = [];
    const newFileObjects: Record<string, File> = {};

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const id = Math.random().toString(36).substr(2, 9);
      newFileObjects[id] = file;
      
      const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'gif', 'avif', 'tif', 'tiff', 'heic'];
      const isImage = imageExtensions.includes(ext) || (Boolean(file.type) && file.type.startsWith('image/'));
      
      newItems.push({
        id,
        filename: file.name,
        originalFilename: file.name,
        title: '',
        description: '',
        keywords: '',
        rating: 5,
        status: 'pending',
        fileType: ext,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined
      });
    }

    setFileObjects(prev => ({ ...prev, ...newFileObjects }));
    setFiles(prev => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setSelectedFileId(prev => prev || newItems[0].id);
    }

    // Async extraction of EPS & Video thumbnails
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const file = newFileObjects[item.id];
      if (!file) continue;
      const ext = item.fileType.toLowerCase();
      if (ext === 'eps' || ext === 'ai') {
        extractEpsThumbnail(file).then(thumb => {
          if (thumb) {
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
          }
        });
      } else if (['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext)) {
        extractVideoThumbnail(file).then(thumb => {
          if (thumb) {
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
          }
        });
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  if (isAppLoading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-6 z-[200]">
        <div className="relative">
          <div className="w-24 h-24 border-8 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={32} className="text-blue-500 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-foreground uppercase tracking-[0.3em]">Initializing Engine</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Loading your professional workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300 relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[200] bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="bg-background/90 p-8 rounded-2xl shadow-2xl border border-blue-500/50 flex flex-col items-center gap-4 scale-110 transition-transform">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Upload size={40} className="text-white animate-bounce" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black uppercase tracking-tighter">Drop Files to Upload</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Images, Videos, and EPS Vectors</p>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300",
          notification.type === 'error' ? "bg-rose-900/90 border-rose-500 text-rose-100" :
          notification.type === 'success' ? "bg-emerald-900/90 border-emerald-500 text-emerald-100" :
          "bg-secondary/90 border-border text-foreground"
        )}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : 
           notification.type === 'success' ? <CheckCircle2 size={18} /> : 
           <Info size={18} />}
          <span className="text-xs font-bold uppercase tracking-wider">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}


      {/* Main Header */}
      <header className="bg-secondary/80 backdrop-blur-md border-b border-border z-40 shadow-md relative text-foreground">
        {/* Row 1: Primary Studio Controls & Main Actions */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 gap-3 flex-wrap">
          {/* Left: Brand & File Adding Section (Two distinct options: Add Files & Add Folder) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-md shadow-blue-500/25">
                <Sparkles size={16} className="text-white" />
              </div>
              <h1 className="text-xs font-black uppercase tracking-wider text-foreground select-none">
                SS <span className="text-blue-500">Smart Meta</span>
              </h1>
            </div>

            <div className="h-4 w-px bg-border/80 mx-0.5" />

            {/* File Adding Options (Add Files & Add Folder both permanently visible) */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleFileSelectDirect}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/60 rounded text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 whitespace-nowrap"
                title="Add individual files (Images, EPS Vectors, Videos, etc.)"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Add Files</span>
              </button>

              <button 
                onClick={handleDirectorySelect}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300 rounded text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
                title="Select a folder to import and directly embed metadata in-place"
              >
                <FolderPlus size={13} strokeWidth={2.5} />
                <span>Add Folder</span>
              </button>

              {directoryHandle && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950/70 border border-emerald-500/70 rounded text-xs font-bold text-emerald-300 shadow-xs">
                  <FolderCheck size={12} className="text-emerald-400 shrink-0" />
                  <span className="max-w-[120px] truncate" title={`Active Folder: ${folderName}`}>{folderName || 'Folder'}</span>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setDirectoryHandle(null); 
                      setFolderName(''); 
                      showNotification("ফোল্ডার ডিসকানেক্ট করা হয়েছে", 'info'); 
                    }}
                    className="p-0.5 hover:bg-emerald-800/60 rounded text-emerald-400 hover:text-white cursor-pointer ml-0.5"
                    title="Disconnect folder"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center: Action Buttons Group (All labels fully visible, high-contrast distinct badges) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Main AI Generation */}
            <button 
              onClick={startGeneration}
              disabled={isGenerating || files.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60 rounded text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-45 disabled:pointer-events-none active:scale-95 whitespace-nowrap"
              title="Generate 5-Star SEO metadata with chosen AI provider"
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
              <span>{isGenerating ? 'Generating...' : 'Generate AI'}</span>
            </button>

            {/* Regen All */}
            <button 
              onClick={() => {
                setFiles(prev => prev.map(f => ({ ...f, status: 'pending' })));
                setTimeout(startGeneration, 100);
              }}
              disabled={isGenerating || files.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white border border-sky-400/60 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs whitespace-nowrap"
              title="Regenerate metadata for all files"
            >
              <RefreshCcw size={12} strokeWidth={2.5} />
              <span>Regen All</span>
            </button>

            {files.some(f => f.status === 'error') && (
              <button 
                onClick={() => {
                  setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending' } : f));
                  setTimeout(startGeneration, 100);
                }}
                disabled={isGenerating}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/70 rounded text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                title="Retry failed files"
              >
                <RefreshCw size={12} strokeWidth={2.5} />
                <span>Retry Errors</span>
              </button>
            )}

            {isGenerating && (
              <button 
                onClick={() => {
                  stopRef.current = true;
                  setIsGenerating(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/60 rounded text-xs font-bold transition-all shadow-sm cursor-pointer animate-pulse whitespace-nowrap"
                title="Stop generation"
              >
                <Square size={11} className="fill-current" />
                <span>Stop</span>
              </button>
            )}

            {files.length > 0 && (
              <button 
                onClick={clearAll}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/60 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs active:scale-95"
                title="Clear all assets from workspace"
              >
                <Trash2 size={12} strokeWidth={2.5} />
                <span>Clear All</span>
              </button>
            )}

            <div className="h-4 w-px bg-border/80 mx-0.5" />

            {/* Embed & Save Action */}
            {activeSelectedFile && (
              <button 
                onClick={() => handleEmbed('all', activeSelectedFile.id)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60 rounded text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-45 active:scale-95 whitespace-nowrap"
                title={`কোনো ডাউনলোড ছাড়া "${activeSelectedFile.filename}" ফাইলে সরাসরি ইন-প্লেস ৫-স্টার মেটাডাটা সেভ করুন`}
              >
                <FolderCheck size={12} strokeWidth={2.5} />
                <span>Embed Selected</span>
              </button>
            )}

            <button 
              onClick={() => handleEmbed('all')}
              disabled={files.length === 0 || isGenerating}
              className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white border border-teal-400/60 rounded text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-45 disabled:pointer-events-none active:scale-95 whitespace-nowrap"
              title="কোনো ডাউনলোড ছাড়া আসল ফোল্ডারের ফাইলগুলোতে সরাসরি ৫-স্টার EXIF/IPTC/XMP মেটাডাটা সেভ করুন"
            >
              <FolderCheck size={12} strokeWidth={2.5} />
              <span>{activeSelectedFile ? 'Embed All' : 'Embed (Save)'}</span>
            </button>

            {/* Rename All */}
            <button 
              onClick={renameAllByTitle}
              disabled={files.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/60 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs whitespace-nowrap"
              title="Automatically rename all filenames using generated titles"
            >
              <Edit3 size={12} strokeWidth={2.5} />
              <span>Rename All</span>
            </button>

            {/* Zip Bundle */}
            <button 
              onClick={handleDownloadZip}
              disabled={files.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/60 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs whitespace-nowrap"
              title="Download renamed files with metadata packaged in a ZIP bundle"
            >
              <Download size={12} strokeWidth={2.5} />
              <span>Zip Bundle</span>
            </button>

            {/* Adobe JSX */}
            <button 
              onClick={() => setIsEmbedModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white border border-purple-400/60 rounded text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              title="Adobe Photoshop & Illustrator Automation Scripts (.jsx)"
            >
              <FileCode size={12} strokeWidth={2.5} />
              <span>Adobe JSX</span>
            </button>
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* AI Provider Select */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-indigo-400/60 px-2 py-0.5 rounded shadow-xs">
              <span className="text-[10px] font-black text-indigo-300 uppercase">AI:</span>
              <select 
                value={activeKey.provider}
                onChange={(e) => {
                  const provider = e.target.value as keyof ApiConfig;
                  const firstReadyIndex = apiConfig[provider].findIndex(key => key.trim() !== '');
                  setActiveKey({ provider, index: firstReadyIndex !== -1 ? firstReadyIndex : 0 });
                }}
                className="bg-transparent text-slate-100 text-xs font-black focus:outline-none cursor-pointer uppercase"
              >
                <option value="gemini">Gemini {apiConfig.gemini.some(k => k) ? '✓' : ''}</option>
                <option value="groq">Groq {apiConfig.groq.some(k => k) ? '✓' : ''}</option>
                <option value="mistral">Mistral {apiConfig.mistral.some(k => k) ? '✓' : ''}</option>
              </select>
            </div>

            {/* Theme Select */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-500/70 px-2 py-0.5 rounded shadow-xs">
              <span className="text-[10px] font-black text-slate-300 uppercase">THEME:</span>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="bg-transparent text-slate-100 text-xs font-black focus:outline-none cursor-pointer uppercase"
              >
                <option value="dark">Dark</option>
                <option value="classic">Classic</option>
                <option value="light">Light</option>
                <option value="blue">Blue</option>
              </select>
            </div>

            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="flex items-center gap-1 px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/70 text-sky-300 font-bold rounded text-xs transition-colors cursor-pointer shadow-2xs whitespace-nowrap active:scale-95"
              title="ব্রাউজারের নতুন ট্যাবে খুলুন যাতে সরাসরি কম্পিউটারের ফোল্ডারে ফাইল সেভ করা যায় (কোনো ডাউনলোড ছাড়া)"
            >
              <ExternalLink size={12} strokeWidth={2.5} />
              <span>New Window</span>
            </button>

            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
              title="History"
            >
              <HistoryIcon size={14} />
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Bar (Asset Filtering, Options & Single CSV Export Hub) */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-xs gap-3 flex-wrap">
          {/* Left: Asset Filter & Gen Options */}
          <div className="flex items-center gap-3">
            {/* Asset Type Segmented Control */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider">Filter:</span>
              <div className="flex bg-slate-800/90 rounded border border-slate-700 p-0.5 shadow-2xs">
                {[
                  { id: 'all', label: 'All', icon: Database, activeBg: 'bg-white text-slate-950 shadow-xs' },
                  { id: 'image', label: 'Images', icon: FileImage, activeBg: 'bg-blue-600 text-white shadow-xs border border-blue-400/60' },
                  { id: 'video', label: 'Videos', icon: Video, activeBg: 'bg-rose-600 text-white shadow-xs border border-rose-400/60' },
                  { id: 'eps', label: 'EPS', icon: Layers, activeBg: 'bg-amber-600 text-white shadow-xs border border-amber-400/60' }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setSettings(prev => ({ ...prev, metadataFor: item.id as any }))}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold uppercase rounded transition-all cursor-pointer",
                      settings.metadataFor === item.id 
                        ? item.activeBg 
                        : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                    )}
                  >
                    <item.icon size={12} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-slate-700" />

            {/* Gen Options Checkboxes - Distinct Color Badges (Permanently Visible) */}
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              <label className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-2xs cursor-pointer select-none transition-all whitespace-nowrap font-bold",
                genOptions.autoSave ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
              )}>
                <input 
                  type="checkbox" 
                  checked={genOptions.autoSave}
                  onChange={(e) => setGenOptions(prev => ({ ...prev, autoSave: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                />
                <span>Auto-Save</span>
              </label>

              <label className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-2xs cursor-pointer select-none transition-all whitespace-nowrap font-bold",
                genOptions.autoExport ? "bg-cyan-600 text-white border-cyan-400" : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
              )}>
                <input 
                  type="checkbox" 
                  checked={genOptions.autoExport}
                  onChange={(e) => setGenOptions(prev => ({ ...prev, autoExport: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
                />
                <span>Auto-Export</span>
              </label>

              <label className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-2xs cursor-pointer select-none transition-all whitespace-nowrap font-bold",
                genOptions.aiEnhance ? "bg-purple-600 text-white border-purple-400" : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
              )}>
                <input 
                  type="checkbox" 
                  checked={genOptions.aiEnhance}
                  onChange={(e) => setGenOptions(prev => ({ ...prev, aiEnhance: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer"
                />
                <span>AI Enhance</span>
              </label>
            </div>
          </div>

          {/* Right: Export CSV Hub & Inspector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/90 border-2 border-cyan-500/70 px-2 py-0.5 rounded shadow-xs">
              <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider">Preset:</span>
              <select 
                value={selectedExportSite}
                onChange={(e) => setSelectedExportSite(e.target.value)}
                className="bg-transparent text-slate-100 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all_files">Master CSV (All Columns)</option>
                <option value="adobe">Adobe Stock</option>
                <option value="shutterstock">Shutterstock</option>
                <option value="getty">Getty / iStock</option>
                <option value="alamy">Alamy</option>
                <option value="pond5">Pond5</option>
                <option value="freepik">Freepik</option>
                <option value="vecteezy">Vecteezy</option>
                <option value="dreamstime">Dreamstime</option>
                <option value="csv">General CSV</option>
              </select>
            </div>

            {/* Single Unified Export CSV Buttons */}
            <button 
              onClick={() => handleExport(selectedExportSite, false)}
              disabled={files.length === 0}
              className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/60 rounded text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              title="Download CSV for processed files matching preset"
            >
              <FileSpreadsheet size={13} strokeWidth={2.5} />
              <span>Export CSV</span>
            </button>

            <button 
              onClick={() => handleExport('all_files', true)}
              disabled={files.length === 0}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60 rounded text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              title="Export complete master CSV for ALL files in current batch"
            >
              <Download size={13} strokeWidth={2.5} />
              <span>All Files CSV</span>
            </button>

            {/* Cooldown or Status Light */}
            {isPaused && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-black animate-pulse">
                <AlertCircle size={10} />
                <span>Cooldown ({cooldownTimer}s)</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 border border-slate-600 rounded text-xs shadow-xs">
              <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.7)]", isGenerating ? (isPaused ? "bg-red-500" : "bg-amber-400 animate-ping") : "bg-emerald-400")} />
              <span className="text-slate-300 font-bold">Assets:</span>
              <span className="font-black text-cyan-400 tabular-nums">{files.length}</span>
            </div>
          </div>
        </div>

        {isGenerating && (
          <div className="flex flex-col gap-0.5 px-4 py-1 bg-muted border-b border-border">
            <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Loader2 size={9} className="animate-spin text-blue-500" />
                <span>Processing Assets...</span>
              </div>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full h-0.5 bg-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Table + Inspector Split Layout */}
      <div className="flex-1 overflow-hidden flex flex-row bg-background relative">
        {/* Loading Overlay for File Selection */}
        {isLoadingFiles && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Upload size={24} className="text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Reading Files...</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Please wait while we process your assets</p>
            </div>
          </div>
        )}

        {/* Left/Center Area: Virtualized Windows Table */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col min-w-0 custom-scrollbar">
            <div className="min-w-[1100px] h-full flex flex-col">
              {/* Windows Style Table Header with High-Contrast Distinct Colors */}
              <div className="flex flex-row w-full border-b border-slate-700 bg-slate-900 text-[11px] font-bold uppercase tracking-wider shrink-0 shadow-xs">
                <div className="w-[18%] min-w-[190px] px-2.5 py-1.5 border-r border-slate-800 shrink-0 flex items-center justify-between text-cyan-400">
                  <span>Filename</span>
                </div>
                <div className="w-[22%] min-w-[230px] px-2.5 py-1.5 border-r border-slate-800 shrink-0 flex items-center justify-between text-amber-400">
                  <span>Title</span>
                </div>
                <div className="w-[26%] min-w-[270px] px-2.5 py-1.5 border-r border-slate-800 shrink-0 flex items-center justify-between text-emerald-400">
                  <span>Keywords</span>
                </div>
                <div className="w-[18%] min-w-[190px] px-2.5 py-1.5 border-r border-slate-800 shrink-0 flex items-center justify-between text-purple-300">
                  <span>Description</span>
                </div>
                <div className="w-[5%] min-w-[65px] px-1 py-1.5 border-r border-slate-800 shrink-0 text-center text-rose-400">
                  <span>Category</span>
                </div>
                <div className="w-[4%] min-w-[50px] px-1 py-1.5 border-r border-slate-800 shrink-0 text-center text-sky-400">
                  <span>Count</span>
                </div>
                <div className="w-[7%] min-w-[95px] px-1 py-1.5 text-center shrink-0 text-yellow-400">
                  <span>5★ & Save</span>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                {filteredFiles.length === 0 ? (
                  <div 
                    className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-6 transition-all"
                  >
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border border-border">
                      <Upload size={48} strokeWidth={1} className="opacity-10" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-muted-foreground uppercase">NO {settings.metadataFor.toUpperCase()} FILES LOADED</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full border-t border-border/40">
                    <FixedSizeList
                      height={window.innerHeight - 200}
                      itemCount={filteredFiles.length}
                      itemSize={62}
                      width="100%"
                      itemData={{
                        files: filteredFiles,
                        updateFile,
                        regenerateSingleFile,
                        downloadWithMetadata,
                        deleteFile,
                        isGenerating,
                        openErrorModal,
                        openPreviewModal,
                        selectedFileId: activeSelectedFile?.id,
                        setSelectedFileId
                      }}
                      className="custom-scrollbar"
                    >
                      {FileRow}
                    </FixedSizeList>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Windows Style Footer */}
      <footer className="bg-secondary border-t border-border px-4 py-1 flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <span>System Ready</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <Database size={10} />
            <span>API: Connected</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <span>Total Assets: {files.length}</span>
            <span className="text-border">|</span>
            <span>Showing: {filteredFiles.length}</span>
            <span className="text-border">|</span>
            <span>Completed: {filteredFiles.filter(f => f.status === 'completed').length}</span>
            <span className="text-border">|</span>
            <span>Errors: {filteredFiles.filter(f => f.status === 'error').length}</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={10} />
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal (Full Page View) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <Settings size={22} className="text-primary" />
                <div>
                  <h3 className="font-extrabold text-base uppercase tracking-wider text-foreground">Application Settings</h3>
                  <p className="text-xs text-muted-foreground font-medium">Configure API keys, AI imager preferences, metadata rules, and concurrency</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-md text-muted-foreground transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                title="Close settings"
              >
                <X size={20} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
            
            {/* Content Body */}
            <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar bg-background">
              <div className="max-w-6xl mx-auto space-y-8">
                {/* API Keys Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h4 className="text-sm md:text-base font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2.5">
                      <Database size={18} className="text-primary" />
                      Service Configuration (5 Slots Per Provider)
                    </h4>
                    <span className="text-xs text-muted-foreground">Keys are stored securely in local browser storage</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(['gemini', 'groq', 'mistral'] as const).map(provider => (
                      <div key={provider} className="space-y-3 p-4 bg-muted/40 rounded-md border border-border flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <label className="text-xs md:text-sm font-black text-primary uppercase tracking-wider">{provider} API KEYS</label>
                          {provider === 'gemini' && (
                            <span className="text-[11px] text-muted-foreground font-mono">AIza... & AQ...</span>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {apiConfig[provider]?.map((key, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                              <input 
                                type="password"
                                value={key || ''}
                                onChange={(e) => {
                                  const newKeys = [...apiConfig[provider]];
                                  newKeys[idx] = e.target.value.trim();
                                  const newConfig = { ...apiConfig, [provider]: newKeys };
                                  setApiConfig(newConfig);
                                  try {
                                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig: newConfig, settings, activeKey }));
                                  } catch (err) {
                                    console.error("Auto-save failed:", err);
                                  }
                                }}
                                placeholder={`Enter ${provider.toUpperCase()} Key ${idx + 1}...`}
                                className="flex-1 bg-secondary border border-border text-xs md:text-sm h-9 rounded-md px-3 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground/40 font-mono"
                              />
                              <button 
                                onClick={() => handleTestConnection(provider, idx)}
                                disabled={!key || apiStatus[`${provider}-${idx}`] === 'testing'}
                                className={cn(
                                  "px-3 h-9 rounded-md text-xs font-black uppercase tracking-wider transition-all shadow-sm shrink-0",
                                  apiStatus[`${provider}-${idx}`] === 'connected' ? "bg-emerald-600 text-white shadow-emerald-500/20" :
                                  apiStatus[`${provider}-${idx}`] === 'failed' ? "bg-destructive text-destructive-foreground shadow-red-500/20" :
                                  "bg-secondary hover:bg-accent text-foreground border border-border"
                                )}
                              >
                                {apiStatus[`${provider}-${idx}`] === 'testing' ? '...' : 
                                 apiStatus[`${provider}-${idx}`] === 'connected' ? 'READY' : 
                                 apiStatus[`${provider}-${idx}`] === 'failed' ? 'FAILED' : 'TEST'}
                              </button>
                              <button 
                                onClick={() => {
                                  const newKeys = [...apiConfig[provider]];
                                  newKeys[idx] = '';
                                  const newConfig = { ...apiConfig, [provider]: newKeys };
                                  setApiConfig(newConfig);
                                  try {
                                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig: newConfig, settings, activeKey }));
                                  } catch (err) {
                                    console.error("Save failed:", err);
                                  }
                                  setApiStatus(prev => {
                                    const newStatus = { ...prev };
                                    delete newStatus[`${provider}-${idx}`];
                                    return newStatus;
                                  });
                                }}
                                className="p-2 h-9 bg-destructive/10 hover:bg-destructive/25 text-destructive rounded-md border border-destructive/20 transition-all shrink-0 flex items-center justify-center"
                                title="Clear Key"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Imager Options & Saved Keywords in a responsive 2-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* AI Imager Options */}
                  <div className="space-y-3 border border-border p-4 rounded-md bg-muted/20 shadow-sm">
                    <h4 className="text-xs md:text-sm font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                      <FileImage size={16} className="text-primary" />
                      AI Imager Configuration
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'singleWordKeywords', label: 'Single Word Keywords', desc: 'Output single-token tags' },
                        { id: 'autoGenerateOnAdd', label: 'Auto-Generate on Add', desc: 'Process immediately when uploaded' },
                        { id: 'silhouette', label: 'Silhouette Mode', desc: 'Optimized for vector shapes' },
                        { id: 'customPromptEnabled', label: 'Custom Prompt', desc: 'Use additional prompt instructions' },
                        { id: 'transparentBackground', label: 'Transparent BG', desc: 'Isolate subject metadata' },
                        { id: 'prohibitedWords', label: 'Filter Prohibited', desc: 'Strip trademarked terms' }
                      ].map(option => (
                        <div key={option.id} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-md border border-border hover:bg-muted/60 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{option.label}</span>
                            <span className="text-[10px] text-muted-foreground">{option.desc}</span>
                          </div>
                          <button 
                            onClick={() => setSettings(prev => ({ ...prev, [option.id]: !prev[option.id as keyof GeneratorSettings] }))}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative border border-border shrink-0 ml-2",
                              settings[option.id as keyof GeneratorSettings] ? "bg-primary" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
                              settings[option.id as keyof GeneratorSettings] ? "left-5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Saved Keywords Section */}
                  <div className="space-y-3 border border-border p-4 rounded-md bg-muted/20 shadow-sm flex flex-col">
                    <h4 className="text-xs md:text-sm font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                      <Tag size={16} className="text-primary" />
                      Saved Keywords (Persistent Tag Pool)
                    </h4>
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newKeyword.trim()) {
                              setSettings(prev => ({ ...prev, savedKeywords: [...prev.savedKeywords, newKeyword.trim()] }));
                              setNewKeyword('');
                            }
                          }}
                          placeholder="Type keyword and press Enter or click Add..."
                          className="flex-1 bg-secondary border border-border text-xs md:text-sm h-9 rounded-md px-3 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground/40 font-medium"
                        />
                        <button 
                          onClick={() => {
                            if (newKeyword.trim()) {
                              setSettings(prev => ({ ...prev, savedKeywords: [...prev.savedKeywords, newKeyword.trim()] }));
                              setNewKeyword('');
                            }
                          }}
                          className="px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider rounded-md transition-all shadow-sm"
                        >
                          ADD KEYWORD
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 min-h-[70px] p-3 bg-muted/40 rounded-md border border-border flex-1 items-start content-start">
                        {(!settings.savedKeywords || settings.savedKeywords.length === 0) ? (
                          <span className="text-xs text-muted-foreground italic">No saved keywords added yet. Add preset tags above to automatically append them.</span>
                        ) : (
                          settings.savedKeywords.map((kw, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 px-2 py-1 rounded-md group">
                              <span className="text-xs font-bold text-foreground">{kw}</span>
                              <button 
                                onClick={() => {
                                  setSettings(prev => ({
                                    ...prev,
                                    savedKeywords: (prev.savedKeywords || []).filter((_, i) => i !== idx)
                                  }));
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                                title="Remove keyword"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generation Parameters */}
                <div className="space-y-4 border border-border p-5 rounded-md bg-muted/20 shadow-sm">
                  <h4 className="text-xs md:text-sm font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                    <Zap size={16} className="text-primary" />
                    Metadata & Generation Range Parameters
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Preset */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Platform Preset</label>
                      <div className="flex bg-secondary rounded-md overflow-hidden border border-border p-1 gap-1">
                        {[
                          { id: 'default', label: 'Standard' },
                          { id: 'adobe', label: 'Adobe Stock' },
                          { id: 'shutterstock', label: 'Shutterstock' }
                        ].map(mode => (
                          <button 
                            key={mode.id}
                            onClick={() => setSettings(prev => ({ ...prev, promptMode: mode.id as any }))}
                            className={cn(
                              "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all", 
                              settings.promptMode === mode.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Title Word Range */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Title Word Range</label>
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{settings.minTitleWords} - {settings.maxTitleWords} words</span>
                      </div>
                      <div className="space-y-2.5 p-3 bg-secondary rounded-md border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MIN</span>
                          <input 
                            type="range" 
                            min="1" 
                            max="50" 
                            value={settings.minTitleWords}
                            onChange={(e) => setSettings(prev => ({ ...prev, minTitleWords: Math.min(parseInt(e.target.value), prev.maxTitleWords) }))}
                            className="modern-slider slider-blue h-1.5 flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MAX</span>
                          <input 
                            type="range" 
                            min="1" 
                            max="50" 
                            value={settings.maxTitleWords}
                            onChange={(e) => setSettings(prev => ({ ...prev, maxTitleWords: Math.max(parseInt(e.target.value), prev.minTitleWords) }))}
                            className="modern-slider slider-blue h-1.5 flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Description Word Range */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Description Word Range</label>
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{settings.minDescriptionWords} - {settings.maxDescriptionWords} words</span>
                      </div>
                      <div className="space-y-2.5 p-3 bg-secondary rounded-md border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MIN</span>
                          <input 
                            type="range" 
                            min="5" 
                            max="100" 
                            value={settings.minDescriptionWords}
                            onChange={(e) => setSettings(prev => ({ ...prev, minDescriptionWords: Math.min(parseInt(e.target.value), prev.maxDescriptionWords) }))}
                            className="modern-slider slider-cyan h-1.5 flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MAX</span>
                          <input 
                            type="range" 
                            min="5" 
                            max="100" 
                            value={settings.maxDescriptionWords}
                            onChange={(e) => setSettings(prev => ({ ...prev, maxDescriptionWords: Math.max(parseInt(e.target.value), prev.minDescriptionWords) }))}
                            className="modern-slider slider-cyan h-1.5 flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Keyword Range */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Keyword Count Range</label>
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{settings.minKeywords} - {settings.maxKeywords} tags</span>
                      </div>
                      <div className="space-y-2.5 p-3 bg-secondary rounded-md border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MIN</span>
                          <input 
                            type="range" 
                            min="5" 
                            max="50" 
                            value={settings.minKeywords}
                            onChange={(e) => setSettings(prev => ({ ...prev, minKeywords: Math.min(parseInt(e.target.value), prev.maxKeywords) }))}
                            className="modern-slider slider-emerald h-1.5 flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground w-8">MAX</span>
                          <input 
                            type="range" 
                            min="5" 
                            max="50" 
                            value={settings.maxKeywords}
                            onChange={(e) => setSettings(prev => ({ ...prev, maxKeywords: Math.max(parseInt(e.target.value), prev.minKeywords) }))}
                            className="modern-slider slider-emerald h-1.5 flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Concurrency Slider */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Batch Processing Concurrency (Parallel Requests)</label>
                      <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded border border-primary/20">{settings.concurrency} Simultaneous Files</span>
                    </div>
                    <div className="p-3 bg-secondary rounded-md border border-border">
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        step="1" 
                        value={settings.concurrency}
                        onChange={(e) => setSettings(prev => ({ ...prev, concurrency: parseInt(e.target.value) }))}
                        className="modern-slider slider-blue h-2 w-full"
                      />
                      <div className="flex justify-between text-xs font-bold text-muted-foreground mt-2 px-1">
                        <span>1 File (Safe)</span>
                        <span>3 Files (Recommended)</span>
                        <span>6 Files (Fast)</span>
                        <span>10 Files (Maximum)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Global Instructions */}
                <div className={cn("space-y-3 transition-all duration-300", !settings.customPromptEnabled && "opacity-40 pointer-events-none")}>
                  <label className="text-xs md:text-sm font-extrabold text-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Custom Global AI Prompt Instructions</span>
                    <span className="text-xs text-muted-foreground normal-case font-medium">Enabled via "Custom Prompt" switch above</span>
                  </label>
                  <textarea 
                    value={settings.customPrompt}
                    onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                    placeholder="Provide additional rules for the AI (e.g., 'Always emphasize lighting and mood', 'Keep titles concise and editorial', 'Avoid brand names')..."
                    className="w-full bg-secondary border border-border text-xs md:text-sm p-4 rounded-md h-28 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground/40 resize-none font-medium leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:px-8 bg-muted border-t border-border flex items-center justify-between shrink-0 shadow-inner">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">All settings and API keys persist across browser sessions</span>
              <div className="flex items-center gap-3 ml-auto">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2.5 rounded-md text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all border border-border"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => {
                    try {
                      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig, settings, activeKey }));
                      showNotification("Settings & API Keys saved permanently!", "success");
                    } catch (e) {
                      console.error("Save error:", e);
                    }
                    setIsSettingsOpen(false);
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs md:text-sm font-extrabold px-8 py-2.5 rounded-md transition-all shadow-lg uppercase tracking-wider active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  SAVE & CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal (Windows Style) */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-background border border-border rounded-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted">
              <div className="flex items-center gap-2">
                <HistoryIcon size={16} className="text-muted-foreground" />
                <h3 className="font-bold text-[11px] uppercase tracking-widest text-foreground">Batch History</h3>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-red-500 hover:text-white rounded text-muted-foreground transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3 bg-background">
              {history.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground/30 space-y-4">
                  <Clock size={48} strokeWidth={1} className="opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">NO HISTORY FOUND</p>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="p-4 bg-muted border border-border rounded-sm flex items-center justify-between hover:bg-blue-500/5 hover:border-blue-500/20 transition-all group">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(item.timestamp).toLocaleString()}</div>
                      <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{item.files.length} ASSETS PROCESSED</div>
                    </div>
                    <button 
                      onClick={() => { setFiles(item.files); setIsHistoryOpen(false); }}
                      className="text-[10px] font-black bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-md transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest active:scale-95"
                    >
                      RESTORE BATCH
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-muted border-t border-border flex justify-end">
              <button 
                onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}
                className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest"
              >
                CLEAR ALL HISTORY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adobe Automation & Metadata Embed Modal */}
      {isEmbedModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-background border border-border rounded-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 text-primary rounded-sm border border-primary/20">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-widest text-foreground">
                    Adobe Automation & Metadata Embedding
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Auto-Rename on disk and embed Title, Description & Keywords into Photoshop & Illustrator
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEmbedModalOpen(false)} 
                className="p-1.5 hover:bg-secondary rounded-sm text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto bg-background">
              {/* Folder Connection Banner */}
              <div className={cn(
                "p-4 rounded-md border flex items-center justify-between gap-4",
                directoryHandle 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-sm",
                    directoryHandle ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  )}>
                    <FolderPlus size={20} />
                  </div>
                  <div>
                    <div className="font-black text-xs uppercase tracking-wider">
                      {directoryHandle ? "Local Folder Connected" : "No Local Folder Selected"}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {directoryHandle 
                        ? `Direct in-place file replacement & auto-renaming active for connected folder.` 
                        : `Connect your folder so newly titled files are written and old files are cleanly replaced in the same folder.`}
                    </div>
                  </div>
                </div>

                {!directoryHandle && (
                  <button 
                    onClick={async () => {
                      await handleDirectorySelect();
                    }}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-sm transition-all whitespace-nowrap shadow-sm"
                  >
                    Connect Folder
                  </button>
                )}
              </div>

              {/* Action Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Photoshop Automation Card */}
                <div className="p-4 rounded-md border border-border bg-secondary/40 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-sm border border-blue-500/30">
                        Photoshop (.JSX)
                      </span>
                      <FileImage size={18} className="text-blue-500" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Adobe Photoshop Automation</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Generates a JavaScript script that automatically opens your image files, writes Title, Caption, and Keywords into <strong className="text-foreground">File Info (IPTC/XMP)</strong>, renames the file with your clean title, and saves in the same folder.
                    </p>
                    <div className="bg-background/80 p-2.5 rounded-sm border border-border text-[11px] text-muted-foreground space-y-1">
                      <div className="font-bold text-foreground text-[10px] uppercase tracking-wider">How to run in Photoshop:</div>
                      <div>1. Open Photoshop &rarr; <code>File &gt; Scripts &gt; Browse...</code></div>
                      <div>2. Select the downloaded <code>.jsx</code> file and select your image folder!</div>
                    </div>
                  </div>
                  <button 
                    onClick={downloadPhotoshopScript}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download Photoshop Script
                  </button>
                </div>

                {/* Illustrator Automation Card */}
                <div className="p-4 rounded-md border border-border bg-secondary/40 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-sm border border-orange-500/30">
                        Illustrator (.JSX)
                      </span>
                      <Layers size={18} className="text-orange-500" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Adobe Illustrator Automation</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Batch opens EPS vectors in Adobe Illustrator, injects XMP Title, Caption, and Keywords into document metadata, renames the vector with your clean title, and saves as stock-standard EPS10.
                    </p>
                    <div className="bg-background/80 p-2.5 rounded-sm border border-border text-[11px] text-muted-foreground space-y-1">
                      <div className="font-bold text-foreground text-[10px] uppercase tracking-wider">How to run in Illustrator:</div>
                      <div>1. Open Illustrator &rarr; <code>File &gt; Scripts &gt; Other Script...</code></div>
                      <div>2. Select the downloaded <code>.jsx</code> file and choose your vector folder!</div>
                    </div>
                  </div>
                  <button 
                    onClick={downloadIllustratorScript}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download Illustrator Script
                  </button>
                </div>
              </div>

              {/* Direct In-Place Folder Renaming & Embed */}
              <div className="p-4 rounded-md border border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                    <FolderCheck size={16} className="text-emerald-500" /> Direct In-Place Disk Renaming & Embed
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Directly saves embedded EXIF/IPTC/XMP directly inside your local image files with the new title name (no extra files).
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={handleEmbedAll}
                    disabled={isGenerating || files.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    <Sparkles size={14} /> Run Direct In-Place Embed
                  </button>
                </div>
              </div>

              {/* Download All as ZIP */}
              <div className="p-4 rounded-md border border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Download size={16} className="text-primary" /> Download Complete Bundle (.ZIP)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Packages all files renamed with your Titles, embedded 5-star metadata directly inside, and Adobe .jsx scripts in one clean zip file.
                  </div>
                </div>
                <button 
                  onClick={handleDownloadZip}
                  className="px-5 py-2.5 bg-foreground text-background hover:bg-foreground/90 font-black text-xs uppercase tracking-widest rounded-sm transition-all shadow-sm flex items-center gap-2 shrink-0"
                >
                  <Download size={14} /> Download Everything (.ZIP)
                </button>
              </div>
            </div>

            <div className="p-4 bg-muted border-t border-border flex justify-end">
              <button 
                onClick={() => setIsEmbedModalOpen(false)}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold uppercase tracking-wider rounded-sm transition-all border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-background border border-red-500/30 rounded-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-red-500/20 flex items-center justify-between bg-red-500/5">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={16} />
                <h3 className="font-bold text-[11px] uppercase tracking-widest">ERROR DETAILS</h3>
              </div>
              <button 
                onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))} 
                className="p-1 hover:bg-red-500 hover:text-white rounded text-muted-foreground transition-all"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-background">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">FILE NAME</label>
                <div className="text-[11px] font-bold text-foreground bg-muted p-2 rounded-sm border border-border truncate">
                  {errorModal.filename}
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">ERROR MESSAGE</label>
                <div className="text-[12px] font-bold text-red-400 bg-red-500/5 p-4 rounded-sm border border-red-500/20 leading-relaxed break-words">
                  {errorModal.message}
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-2 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase tracking-widest rounded-sm transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
                >
                  CLOSE WINDOW
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution EPS Vector & Asset Preview Modal */}
      {previewModalFile && (
        <div 
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewModalFileId(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[92vh] bg-background border border-border rounded-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 min-w-0">
                <Eye size={16} className="text-primary shrink-0" />
                <h3 className="font-bold text-xs uppercase tracking-widest text-foreground truncate max-w-md">
                  {previewModalFile.filename}
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {previewModalFile.fileType.toUpperCase()}
                </span>
                {previewModalFile.rating && (
                  <span className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5 shrink-0">
                    ★ {previewModalFile.rating}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleModalNavigate('prev')}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border/50"
                  title="Previous Asset (পূর্ববর্তী ফাইল)"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => handleModalNavigate('next')}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border/50"
                  title="Next Asset (পরবর্তী ফাইল)"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button 
                  onClick={() => setPreviewModalFileId(null)} 
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {/* Media Preview Stage */}
              <div className="w-full bg-slate-950/90 rounded-md border border-border/80 flex items-center justify-center p-4 min-h-[280px] max-h-[460px] overflow-hidden relative">
                {previewModalFile.previewUrl ? (
                  ['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(previewModalFile.fileType.toLowerCase()) ? (
                    <video 
                      src={fileObjects[previewModalFile.id] ? URL.createObjectURL(fileObjects[previewModalFile.id]) : previewModalFile.previewUrl} 
                      controls 
                      className="max-h-[400px] max-w-full rounded shadow-md object-contain"
                    />
                  ) : (
                    <img 
                      src={previewModalFile.previewUrl} 
                      alt={previewModalFile.filename} 
                      className="max-h-[400px] max-w-full rounded shadow-md object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
                    <FileText size={56} className="stroke-1 text-muted-foreground/60" />
                    <span className="text-xs uppercase tracking-widest font-bold">No visual preview available</span>
                    <span className="text-[10px] text-muted-foreground">EPS preview can be extracted if Ghostscript is enabled on server or an embedded thumbnail exists</span>
                  </div>
                )}
              </div>

              {/* Metadata Details Grid - Editable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <FileText size={12} className="text-primary" />
                      TITLE :*
                    </label>
                    {previewModalFile.title && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(previewModalFile.title);
                          showNotification("Title copied to clipboard!", "success");
                        }}
                        className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={10} /> Copy Title
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={previewModalFile.title || ''}
                    onChange={(e) => updateFile(previewModalFile.id, { title: e.target.value })}
                    placeholder="Enter stock title..."
                    className="w-full text-xs font-semibold text-foreground bg-muted/60 px-3 py-2 rounded border border-border focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      DESCRIPTION :*
                    </label>
                    {previewModalFile.description && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(previewModalFile.description);
                          showNotification("Description copied to clipboard!", "success");
                        }}
                        className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={10} /> Copy
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={previewModalFile.description || ''}
                    onChange={(e) => updateFile(previewModalFile.id, { description: e.target.value })}
                    placeholder="Enter description..."
                    className="w-full text-xs text-foreground bg-muted/60 p-2.5 rounded border border-border focus:border-primary focus:outline-hidden leading-relaxed resize-none"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Tag size={12} className="text-primary" />
                        KEYWORDS :*
                      </label>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        ({(previewModalFile.keywords || '').split(',').filter(Boolean).length} tags)
                      </span>
                    </div>
                    {previewModalFile.keywords && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(previewModalFile.keywords);
                          showNotification("Keywords copied to clipboard!", "success");
                        }}
                        className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={10} /> Copy Keywords
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={previewModalFile.keywords || ''}
                    onChange={(e) => updateFile(previewModalFile.id, { keywords: e.target.value })}
                    placeholder="tag1, tag2, tag3..."
                    className="w-full text-xs text-foreground bg-muted/60 p-2.5 rounded border border-border focus:border-primary focus:outline-hidden leading-relaxed font-mono resize-none"
                  />
                  {previewModalFile.keywords && (
                    <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                      {(previewModalFile.keywords || '').split(',').map((k, i) => k.trim()).filter(Boolean).map((kw, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-background border border-border rounded text-foreground font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[10px] font-medium text-muted-foreground">
                Live metadata editing active. Changes are instantly saved.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => regenerateSingleFile(previewModalFile.id)}
                  disabled={isGenerating || previewModalFile.status === 'generating'}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles size={13} />
                  <span>{previewModalFile.title ? 'Regenerate AI' : 'Generate AI'}</span>
                </button>
                <button
                  onClick={() => {
                    downloadWithMetadata(previewModalFile.id);
                  }}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded transition-all hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download size={13} />
                  Download File
                </button>
                <button 
                  onClick={() => setPreviewModalFileId(null)} 
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold uppercase tracking-wider rounded transition-all border border-border cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Iframe Restriction Modal for Direct Local Disk In-Place Saving */}
      {showIframeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/60 rounded-lg max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                  <FolderCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">সরাসরি মূল ফাইলে সেভ করার নির্দেশনা</h3>
                  <p className="text-xs text-amber-400 font-medium mt-0.5">কোনো কিছু ডাউনলোড হবে না — ইন-প্লেস ওভাররাইট</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIframeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed bg-slate-950/70 p-3.5 rounded border border-slate-800">
              <p className="font-semibold text-white">
                আপনি চেয়েছেন: <span className="text-amber-300 font-bold">"ফাইল যে জায়গায় আছে ওই জায়গায় চেঞ্জ হবে, কোনো কিছু ডাউনলোড হবে না।"</span>
              </p>
              <p>
                আপনার কম্পিউটারের মূল ফোল্ডারের ফাইলে সরাসরি ৫-স্টার মেটাডাটা পরিবর্তন (In-place Overwrite) করতে ব্রাউজার সিকিউরিটির কারণে অ্যাপটি <strong>নতুন উইন্ডো/ট্যাবে (New Window)</strong> ওপেন করতে হবে।
              </p>
              <p className="text-emerald-400 font-semibold">
                ✓ নিচে <strong>"নতুন ট্যাবে খুলুন"</strong> বাটনে ক্লিক করে ফোল্ডার সিলেক্ট করলেই আপনার কম্পিউটারের আসল ফাইলে সরাসরি ৫-স্টার রেটিং, টাইটেল, কিওয়ার্ডস ও রিনেম সেভ হবে — কোনো ডাউনলোড ছাড়াই!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowIframeModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded border border-slate-700 cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                onClick={() => {
                  setShowIframeModal(false);
                  window.open(window.location.href, '_blank');
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <ExternalLink size={14} />
                <span>নতুন ট্যাবে খুলুন (Open in New Tab)</span>
              </button>
            </div>
          </div>
        </div>
      )}



      <input 
        type="file" 
        id="file-upload" 
        multiple 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files) {
            handleFilesAdded(e.target.files);
            e.target.value = ''; // Reset to allow re-uploading same file
          }
        }}
        accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,.gif,.heic,.avif,.eps,.ai,.svg,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv"
      />
      <input 
        type="file" 
        id="folder-upload" 
        {...{ webkitdirectory: "", directory: "" }}
        multiple 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files) {
            handleFilesAdded(e.target.files);
            e.target.value = ''; // Reset to allow re-uploading same file
          }
        }}
      />
    </div>
  );

}
