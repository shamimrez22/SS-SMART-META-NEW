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
  Edit3
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
import { generateMetadata, testApiConnection, extractEpsThumbnail } from './services/aiService';
import { cn } from './lib/utils';

const STORAGE_KEY = 'ai-metadata-pro-config';
const HISTORY_KEY = 'ai-metadata-pro-history';

// Optimized Copyable Cell Component
const CopyableCell = React.memo(({ value, onChange, placeholder, colorClass, isGenerating, onCopy }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  };

  return (
    <div className="w-full h-full relative group/cell p-0.5">
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-full bg-secondary text-foreground border border-border rounded-sm p-1 text-[9px] resize-none focus:ring-1 focus:ring-primary focus:border-foreground/50 outline-none custom-scrollbar leading-none placeholder:text-muted-foreground/40 uppercase font-bold transition-all",
          colorClass,
          isGenerating && "opacity-50 blur-[1px]"
        )}
        placeholder={placeholder}
      />
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <RefreshCw size={12} className="animate-spin text-primary opacity-80" />
        </div>
      )}
      <button 
        onClick={handleCopy}
        className={cn(
          "absolute top-1 right-2 p-0.5 bg-muted text-foreground border border-border rounded-sm opacity-0 group-hover/cell:opacity-100 transition-all hover:bg-accent shadow-sm",
          copied && "opacity-100 bg-emerald-500/20 text-emerald-500 border-emerald-500/50"
        )}
        title="COPY"
      >
        {copied ? <Check size={8} className="text-emerald-500" /> : <Copy size={8} className="text-foreground" />}
      </button>
    </div>
  );
});

// Optimized Row Component for Virtualization
const FileRow = React.memo(({ index, style, data }: any) => {
  const { files, updateFile, regenerateSingleFile, downloadWithMetadata, deleteFile, isGenerating, openErrorModal } = data;
  const file = files[index];
  if (!file) return null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFile(file.id);
  };

  return (
    <div 
      style={style}
      className={cn(
        "flex flex-row w-full hover:bg-blue-500/5 transition-colors group items-center border-b border-border bg-background",
        file.status === 'generating' && "bg-blue-500/5"
      )}
    >
      <div className="w-[12%] px-1 py-0.5 border-r border-border flex items-center gap-1.5 overflow-hidden shrink-0 h-full">
        <div className="w-6 h-6 bg-secondary rounded-sm border border-border flex-shrink-0 overflow-hidden relative shadow-sm">
          {file.previewUrl ? (
            <img src={file.previewUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground">
              <FileText size={12} />
            </div>
          )}
          {(file.status === 'completed' || file.status === 'saved') && (
            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          )}
          {(file.status === 'generating' || file.status === 'retrying') && (
            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
              <RefreshCw size={12} className="animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input 
            type="text"
            value={file.filename}
            onChange={(e) => updateFile(file.id, { filename: e.target.value })}
            className="text-[9px] font-black text-foreground truncate leading-none uppercase tracking-tighter bg-transparent hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded px-0.5 py-0.5 w-full outline-none transition-all cursor-text border border-transparent hover:border-border"
            title={`File: ${file.filename} (Click to edit filename)`}
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
                "text-[7px] font-black px-1 py-0 rounded-sm uppercase tracking-widest border group relative cursor-help",
                (file.status === 'completed' || file.status === 'saved') ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" :
                (file.status === 'generating' || file.status === 'retrying') ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 animate-pulse" :
                file.status === 'error' ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40" : "bg-secondary text-foreground border-border"
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
              {file.status === 'error' && (
                <AlertCircle size={8} className="inline-block ml-1 text-red-500 animate-pulse" />
              )}
            </span>
            {file.status === 'pending' && (
              <button 
                onClick={(e) => { e.stopPropagation(); regenerateSingleFile(file.id); }}
                className="text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-0.5 shadow-sm active:scale-95 transition-transform"
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
                  "text-[6px] font-black px-1 py-0 rounded-sm uppercase tracking-widest transition-colors flex items-center gap-0.5 shadow-sm active:scale-95 border border-border",
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

      <div className="w-[15%] px-1 py-0.5 border-r border-border h-full shrink-0">
        <CopyableCell 
          value={file.title}
          onChange={(val: string) => updateFile(file.id, { title: val })}
          placeholder="TITLE..."
          colorClass="text-foreground font-bold"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      <div className="w-[25%] px-1 py-0.5 border-r border-border h-full shrink-0 relative">
        <CopyableCell 
          value={file.keywords}
          onChange={(val: string) => updateFile(file.id, { keywords: val })}
          placeholder="KEYWORDS..."
          colorClass="text-foreground font-bold"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
        {file.keywordScore && (
          <div className="absolute bottom-1 right-2 text-[6px] font-black text-foreground bg-secondary px-0.5 py-0 rounded-sm border border-border z-10">
            {file.keywordScore}%
          </div>
        )}
      </div>

      <div className="w-[20%] px-1 py-0.5 border-r border-border h-full shrink-0">
        <CopyableCell 
          value={file.description}
          onChange={(val: string) => updateFile(file.id, { description: val })}
          placeholder="DESCRIPTION..."
          colorClass="text-foreground font-bold"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      <div className="w-[10%] px-1 py-0.5 border-r border-border h-full shrink-0">
        <CopyableCell 
          value={file.category}
          onChange={(val: string) => updateFile(file.id, { category: val })}
          placeholder="CATEGORY..."
          colorClass="text-foreground font-bold"
          isGenerating={file.status === 'generating' || file.status === 'retrying'}
        />
      </div>

      <div className="w-[8%] px-1 py-0.5 border-r border-border h-full shrink-0 flex items-center justify-center">
        <div className="text-[9px] font-black text-foreground bg-secondary px-1.5 py-0.5 rounded-sm border border-border">
          {file.keywords ? file.keywords.split(',').length : 0}
        </div>
      </div>

      <div className="w-[10%] px-1 py-0.5 h-full shrink-0 flex items-center justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateFile(file.id, { rating: star });
            }}
            className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
            title={`Rating: ${file.rating !== undefined && file.rating > 0 ? file.rating : 5} Stars (Click to set ${star} Stars)`}
          >
            <Star 
              size={9} 
              className={cn(
                "transition-all",
                star <= (file.rating !== undefined && file.rating > 0 ? file.rating : 5) 
                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.5)]" 
                  : "text-muted-foreground/20 hover:text-amber-300"
              )} 
            />
          </button>
        ))}
        {(file.status === 'completed' || file.status === 'saved' || file.title || file.keywords) && (
          <button 
            onClick={(e) => { e.stopPropagation(); downloadWithMetadata(file.id); }}
            className="ml-1 p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 rounded-sm transition-all border border-emerald-500/30"
            title="Save / Embed 5-Star Metadata & Rename this file"
          >
            <Save size={10} />
          </button>
        )}
        <button 
          onClick={handleDelete}
          className="ml-1 p-1 text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 rounded-[1px] transition-all opacity-0 group-hover:opacity-100"
          title="DELETE FILE"
        >
          <Trash2 size={10} />
        </button>
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
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Trim hyphens
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<StockMetadata>) => {
    setFiles(prev => {
      const exists = prev.find(f => f.id === id);
      if (!exists) return prev;
      
      return prev.map(f => {
        if (f.id === id) {
          const newMetadata = { ...f, ...updates };
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
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedExportSite, setSelectedExportSite] = useState('adobe');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({});
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isIframeNoticeOpen, setIsIframeNoticeOpen] = useState(false);

  const ensureDirectoryHandle = async (): Promise<any> => {
    if (directoryHandle) return directoryHandle;
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setIsIframeNoticeOpen(true);
      return null;
    }
    if ('showDirectoryPicker' in window) {
      try {
        showNotification("আপনার কম্পিউটারের ফোল্ডারটি সিলেক্ট করুন যাতে কোনো ডাউনলোড ছাড়াই সরাসরি সেই ফোল্ডারের ফাইলগুলো রিনেম ও সেভ হয়!", 'info');
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        setDirectoryHandle(handle);
        setFolderName(handle.name);
        return handle;
      } catch (err: any) {
        if (err.name === 'SecurityError' || err.message?.includes('Cross origin') || err.message?.includes('sub frame')) {
          setIsIframeNoticeOpen(true);
        } else if (err.name !== 'AbortError') {
          showNotification("ফোল্ডার অ্যাক্সেস পারমিশন দেওয়া হয়নি। আবার চেষ্টা করুন।", 'error');
        }
        return null;
      }
    } else {
      showNotification("সরাসরি ফোল্ডারে ফাইল রিনেম করার জন্য Google Chrome বা Microsoft Edge ব্রাউজার ব্যবহার করুন।", 'error');
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
    } else if (theme === 'blue') {
      root.classList.add('blue');
    } else if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.add('classic');
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
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      setIsIframeNoticeOpen(true);
      document.getElementById('folder-upload')?.click();
      return;
    }
    if (!('showDirectoryPicker' in window)) {
      document.getElementById('folder-upload')?.click();
      showNotification("সরাসরি ডিস্কে ফাইল রিনেম করার জন্য Google Chrome বা Microsoft Edge ব্যবহার করুন।", 'info');
      return;
    }
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setIsLoadingFiles(true);
      setDirectoryHandle(handle);
      setFolderName(handle.name);
      const newItems: StockMetadata[] = [];
      const newFileObjects: Record<string, File> = {};
      
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['png', 'eps', 'mp4', 'mov', 'jpg', 'jpeg', 'ai', 'svg', 'webp', 'avi'].includes(ext)) {
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
        showNotification(`No supported media files found in "${handle.name}".`, 'info');
        return;
      }

      setFileObjects(prev => ({ ...prev, ...newFileObjects }));
      setFiles(prev => [...newItems, ...prev]);

      // Async extract EPS thumbnails
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (item.fileType === 'eps') {
          const file = newFileObjects[item.id];
          extractEpsThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        }
      }

      showNotification(`Connected "${handle.name}": Loaded ${newItems.length} assets! Changes will occur directly in this folder.`, 'success');
    } catch (err: any) {
      if (err.name === 'SecurityError' || err.message?.includes('sub frames') || err.message?.includes('Cross origin')) {
        document.getElementById('folder-upload')?.click();
        showNotification("Notice: Inside preview frame, folder loaded! Click 'Open in New Tab' ↗ above for direct disk overwriting.", 'info');
      } else if (err.name !== 'AbortError') {
        console.error("Directory access denied or failed:", err);
        showNotification(`Folder error: ${err.message}`, 'error');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFileSelectDirect = async () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe || !('showOpenFilePicker' in window)) {
      document.getElementById('file-upload')?.click();
      return;
    }
    try {
      // @ts-ignore
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Stock Assets (Images, Vectors & Videos)',
            accept: {
              'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
              'video/*': ['.mp4', '.mov', '.avi'],
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
          handle: handle
        });
      }
      setFileObjects(prev => ({ ...prev, ...newFileObjects }));
      setFiles(prev => [...newItems, ...prev]);

      // Async extract EPS thumbnails
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (item.fileType === 'eps') {
          const file = newFileObjects[item.id];
          extractEpsThumbnail(file).then(thumb => {
            if (thumb) {
              setFiles(prev => prev.map(f => f.id === item.id ? { ...f, previewUrl: thumb } : f));
            }
          });
        }
      }

      showNotification(`Selected ${newItems.length} files with direct disk read/write access!`, 'success');
    } catch (err: any) {
      if (err.name === 'SecurityError' || err.message?.includes('sub frames') || err.message?.includes('Cross origin')) {
        document.getElementById('file-upload')?.click();
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

  const saveMetadataToLocalFile = async (id: string, metadata: Partial<StockMetadata>, dirHandle?: any) => {
    const fileMetadata = files.find(f => f.id === id);
    const actualFile = fileObjects[id];
    if (!fileMetadata) return;

    let activeDir = dirHandle || directoryHandle;
    if (!activeDir && window.self === window.top) {
      activeDir = await ensureDirectoryHandle();
    }

    try {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'saving' } : f));
      const targetFilename = (metadata.filename || fileMetadata.filename).trim();
      const originalFilename = fileMetadata.originalFilename || (actualFile ? actualFile.name : targetFilename);

      let outputBlob: Blob;
      if (actualFile) {
        outputBlob = await prepareEmbeddedBlob(actualFile, { ...fileMetadata, ...metadata });
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: 'Original file missing' } : f));
        return;
      }

      // Update in-memory file object
      const updatedFile = new File([outputBlob], targetFilename, { type: actualFile.type });
      setFileObjects(prev => ({ ...prev, [id]: updatedFile }));

      if (activeDir) {
        // 1. Direct Folder In-Place Save & Rename
        const newFileHandle = await activeDir.getFileHandle(targetFilename, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(outputBlob);
        await writable.close();

        // 2. Write companion Adobe-standard .xmp sidecar in the same folder
        try {
          const xmpPacket = createXmpPacket({ ...fileMetadata, ...metadata });
          const xmpHandle = await activeDir.getFileHandle(`${targetFilename}.xmp`, { create: true });
          const xmpWritable = await xmpHandle.createWritable();
          await xmpWritable.write(xmpPacket);
          await xmpWritable.close();
        } catch (xmpErr) {
          console.warn("Could not write XMP sidecar:", xmpErr);
        }

        // 3. Delete old unrenamed file from folder if filename changed
        if (originalFilename && originalFilename !== targetFilename) {
          try {
            await activeDir.removeEntry(originalFilename);
          } catch (delErr) {
            console.warn("Could not remove old file:", delErr);
          }
          try {
            await activeDir.removeEntry(`${originalFilename}.xmp`);
          } catch (delXmpErr) {}
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
      } else if (fileMetadata.handle && 'createWritable' in fileMetadata.handle) {
        // Direct individual file handle write
        const writable = await fileMetadata.handle.createWritable();
        await writable.write(outputBlob);
        await writable.close();

        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: 'saved', 
          filename: targetFilename,
          originalFilename: targetFilename,
          errorMessage: undefined
        } : f));
        return true;
      } else {
        // When there is no activeDir: prompt for folder or open iframe guidance
        if (window.self !== window.top) {
          setIsIframeNoticeOpen(true);
          return false;
        } else {
          const dir = await ensureDirectoryHandle();
          if (dir) {
            return await saveMetadataToLocalFile(id, metadata, dir);
          }
          return false;
        }
      }
    } catch (err: any) {
      console.error("Failed to save to local file:", err);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: err.message } : f));
      throw err;
    }
  };

  const handleEmbedAll = async () => {
    let activeDir = directoryHandle;
    if (!activeDir) {
      activeDir = await ensureDirectoryHandle();
    }

    const completedFiles = files.filter(f => f.status === 'completed' || f.status === 'saved' || f.title || f.keywords);
    if (completedFiles.length === 0) {
      showNotification("সেভ করার মতো কোনো ফাইল পাওয়া যায়নি। অনুগ্রহ করে প্রথমে মেটাডাটা তৈরি করুন।", 'info');
      return;
    }

    if (activeDir) {
      setIsGenerating(true);
      let successCount = 0;
      let failCount = 0;

      for (const file of completedFiles) {
        try {
          await saveMetadataToLocalFile(file.id, file, activeDir);
          successCount++;
        } catch (err) {
          console.error(`Failed to save ${file.filename}:`, err);
          failCount++;
        }
      }

      setIsGenerating(false);
      showNotification(`✓ সম্পূর্ণ সফল! "${activeDir.name}" ফোল্ডারের ${successCount}টি ফাইল সরাসরি রিনেম হয়েছে এবং ভেতরে ৫-স্টার ও মেটাডাটা সেভ হয়েছে (কোনো ডাউনলোড ছাড়াই)!`, 'success');
    } else {
      if (window.self !== window.top) {
        setIsIframeNoticeOpen(true);
      } else {
        showNotification("সরাসরি ফোল্ডারে রিনেম ও মেটাডাটা সেভ করতে অনুগ্রহ করে আপনার ফোল্ডারটি সিলেক্ট করুন।", 'info');
      }
    }
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

        // Companion Adobe-standard XMP sidecar for 100% stock & Lightroom/Bridge support
        const mimeType = ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'application/postscript';
        const xmpString = createXmpPacket(item, mimeType);
        zip.file(`${targetFilename}.xmp`, xmpString);
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

  const handleExport = (format: string) => {
    const completedFiles = files.filter(f => f.status === 'completed');
    if (completedFiles.length === 0) {
      showNotification("No completed files to export! Please process assets first.", 'info');
      return;
    }

    let content = '';
    let mimeType = 'text/csv;charset=utf-8;';
    let extension = 'csv';
    let filenamePrefix = format;

    if (format === 'json') {
      content = JSON.stringify(completedFiles, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      extension = 'json';
    } else if (format === 'txt') {
      content = completedFiles.map(f => 
        `FILE: ${f.filename}\nTITLE: ${f.title}\nDESC: ${f.description}\nKEYWORDS: ${f.keywords}\n\n`
      ).join('---\n');
      mimeType = 'text/plain;charset=utf-8;';
      extension = 'txt';
    } else {
      // Standard Stock Agency CSV Specifications
      let data: any[] = [];
      filenamePrefix = `${format}_metadata`;

      switch (format) {
        case 'adobe':
          // Adobe Stock official contributor template
          // Headers: Filename, Title, Keywords, Category
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
          data = completedFiles.map(f => ({
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
    showNotification(`Exported ${completedFiles.length} records in standard ${format.toUpperCase()} format!`, 'success');
  };

  const handleEmbed = async (type: 'image' | 'video' | 'eps' | 'all') => {
    let activeDir = directoryHandle;
    if (!activeDir && window.self === window.top) {
      activeDir = await ensureDirectoryHandle();
    }

    const candidateFiles = files.filter(f => {
      const ext = f.fileType.toLowerCase();
      if (type === 'image') return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      if (type === 'video') return ['mp4', 'mov', 'avi'].includes(ext);
      if (type === 'eps') return ['eps', 'ai', 'svg'].includes(ext);
      return true;
    }).filter(f => f.status === 'completed' || f.status === 'saved' || f.title || f.keywords);

    if (candidateFiles.length === 0) {
      showNotification(`No ${type === 'all' ? 'files' : type.toUpperCase()} with metadata to save. Please generate metadata first.`, 'info');
      return;
    }

    if (!activeDir) {
      showNotification("Packaging renamed files with embedded 5-star metadata into ZIP download...", 'info');
      await handleDownloadZip();
      return;
    }

    showNotification(`Applying in-place changes to ${candidateFiles.length} files in folder "${activeDir.name || 'selected'}"...`, 'info');
    setIsGenerating(true);

    let successCount = 0;
    let failCount = 0;

    for (const file of candidateFiles) {
      try {
        await saveMetadataToLocalFile(file.id, file, activeDir);
        successCount++;
      } catch (err) {
        console.error(`Failed to embed ${file.filename}:`, err);
        failCount++;
      }
    }

    setIsGenerating(false);
    showNotification(`✓ Direct Disk Update: Successfully renamed & embedded ${successCount} files inside "${activeDir.name || 'your folder'}"!`, 'success');
  };

  const filteredFiles = useMemo(() => {
    if (settings.metadataFor === 'all') return files;
    return files.filter(f => {
      const ext = f.fileType.toLowerCase();
      if (settings.metadataFor === 'image') return ['jpg', 'jpeg', 'png'].includes(ext);
      if (settings.metadataFor === 'video') return ['mp4', 'mov'].includes(ext);
      if (settings.metadataFor === 'eps') return ['eps'].includes(ext);
      return true;
    });
  }, [files, settings.metadataFor]);

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
    if (!activeDir) {
      activeDir = await ensureDirectoryHandle();
    }

    if (activeDir) {
      try {
        await saveMetadataToLocalFile(id, fileMetadata, activeDir);
        showNotification(`✓ ফোল্ডারে সরাসরি রিনেম এবং ভেতরে মেটাডাটা ও ৫-স্টার সেভ হয়েছে: "${fileMetadata.filename}"!`, 'success');
        return;
      } catch (err: any) {
        showNotification(`ফোল্ডারে সেভ ব্যর্থ হয়েছে: ${err.message}`, 'error');
        return;
      }
    }

    // Direct single file handle save
    if (fileMetadata.handle && 'createWritable' in fileMetadata.handle) {
      try {
        const outputBlob = await prepareEmbeddedBlob(actualFile, fileMetadata);
        const writable = await fileMetadata.handle.createWritable();
        await writable.write(outputBlob);
        await writable.close();
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'saved' } : f));
        showNotification(`✓ সরাসরি ডিস্কে "${fileMetadata.filename}" আপডেট হয়েছে!`, 'success');
        return;
      } catch (err: any) {
        console.warn("Direct file handle save failed:", err);
      }
    }

    // If no directory handle is connected
    if (window.self !== window.top) {
      setIsIframeNoticeOpen(true);
    } else {
      showNotification("সরাসরি ফোল্ডারে রিনেম ও মেটাডাটা সেভ করতে অনুগ্রহ করে আপনার ফোল্ডারটি সিলেক্ট করুন।", 'info');
    }
  };

  const handleFilesAdded = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'eps', 'mp4', 'mov', 'ai', 'svg'];
    
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
      
      const isImage = file.type.startsWith('image/') && ext !== 'eps';
      
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

    // Async extraction of EPS thumbnails
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item.fileType === 'eps') {
        const file = newFileObjects[item.id];
        extractEpsThumbnail(file).then(thumb => {
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

      {/* Direct Disk Save Banner for iframe preview */}
      {window.self !== window.top && (
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-blue-700 text-white px-4 py-2 flex items-center justify-between shadow-md z-50 text-xs font-semibold animate-in fade-in border-b border-emerald-400/30">
          <div className="flex items-center gap-2.5">
            <span className="text-sm bg-white/20 p-1 rounded-full">⚡</span>
            <span>
              <strong className="text-emerald-200">সরাসরি কম্পিউটারের ফোল্ডারে ফাইল রিনেম ও সেভ করতে চান?</strong> প্রিভিউ ফ্রেমের পরিবর্তে নতুন ট্যাবে খুলুন — তাহলে <strong>কোনো ডাউনলোড ছাড়া</strong> আপনার আসল ফোল্ডারেই সব ফাইল রিনেম ও মেটাডাটা সেভ হবে!
            </span>
          </div>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="ml-4 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-950 rounded-sm font-black uppercase text-[10px] tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 transition-transform active:scale-95"
          >
            <ExternalLink size={13} />
            <span>নতুন ট্যাবে খুলুন (Open in New Tab)</span>
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-secondary border-b border-border z-40 shadow-xl relative text-foreground">
        {/* Top Branding Bar */}
        <div className="flex items-center px-4 py-2 bg-background border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-[13px] font-black uppercase tracking-[0.2em] text-foreground">
              SS <span className="text-blue-500">Smart Meta</span>
            </h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              title="Open app in a new browser tab for direct disk access (Chrome requirement)"
            >
              <ExternalLink size={12} />
              <span>Open in New Tab</span>
            </button>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50 hidden sm:block">
              Professional Metadata Engine
            </div>
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-sm transition-all group border border-transparent hover:border-border cursor-pointer"
              title="Open History"
            >
              <HistoryIcon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground uppercase tracking-tight">History</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent rounded-sm transition-all group border border-transparent hover:border-border cursor-pointer"
              title="Open Settings"
            >
              <Settings size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground uppercase tracking-tight">Settings</span>
            </button>
          </div>
        </div>

        {/* Ribbon Actions (The Buttons Area) */}
        <div className="flex flex-col bg-muted">
          {/* Controls Bar */}
          <div className="flex items-center flex-wrap px-4 py-0.5 gap-y-1 gap-x-2 border-b border-border/30">
            {/* Active AI Provider Group */}
            <div className="flex flex-col gap-0.5 p-0.5 border border-border rounded-sm bg-background/60 min-w-[130px] shadow-sm">
              <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90 w-fit">PROVIDER :*</span>
              <select 
                value={activeKey.provider}
                onChange={(e) => {
                  const provider = e.target.value as keyof ApiConfig;
                  const firstReadyIndex = apiConfig[provider].findIndex(key => key.trim() !== '');
                  setActiveKey({ provider, index: firstReadyIndex !== -1 ? firstReadyIndex : 0 });
                }}
                className="bg-secondary border border-border text-foreground text-[11px] px-1.5 py-0 rounded-sm focus:outline-primary outline-none cursor-pointer h-7 font-bold uppercase"
              >
                <option value="gemini">GEMINI {apiConfig.gemini.some(k => k) ? '(READY)' : '(EMPTY)'}</option>
                <option value="groq">GROQ {apiConfig.groq.some(k => k) ? '(READY)' : '(EMPTY)'}</option>
                <option value="mistral">MISTRAL {apiConfig.mistral.some(k => k) ? '(READY)' : '(EMPTY)'}</option>
              </select>
            </div>

            {/* Theme Group */}
            <div className="flex flex-col gap-0.5 p-0.5 border border-border rounded-sm bg-background/60 shadow-sm">
              <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90 w-fit">THEME :*</span>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="bg-secondary border border-border text-foreground text-[11px] px-1.5 py-0 rounded-sm focus:outline-primary outline-none cursor-pointer h-7 font-bold uppercase"
              >
                <option value="classic">CLASSIC PEACH (MATCH SYSTEM)</option>
                <option value="dark">DARK</option>
                <option value="light">LIGHT</option>
                <option value="blue">BLUE</option>
              </select>
            </div>

            {/* Gen Options Group */}
            <div className="flex flex-col gap-0.5 p-0.5 border border-border rounded-sm bg-background/60 shadow-sm">
              <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90 w-fit">GEN OPTIONS :</span>
              <div className="flex items-center gap-2 px-1 h-7">
                <label className="flex items-center gap-1 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={genOptions.autoSave}
                    onChange={(e) => setGenOptions(prev => ({ ...prev, autoSave: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded-sm bg-secondary border border-border text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-foreground uppercase">Save</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={genOptions.autoExport}
                    onChange={(e) => setGenOptions(prev => ({ ...prev, autoExport: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded-sm bg-secondary border border-border text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-foreground uppercase">Export</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={genOptions.aiEnhance}
                    onChange={(e) => setGenOptions(prev => ({ ...prev, aiEnhance: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded-sm bg-secondary border border-border text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-foreground uppercase">Enhance</span>
                </label>
              </div>
            </div>

            <div className="flex-1" />

            {/* Input Group */}
            <div className="flex items-center gap-1.5 p-1 border border-border rounded-sm bg-background/60 relative pt-3 shadow-sm">
              <div className="absolute top-0 left-1 -translate-y-1/2">
                <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90">INPUT :*</span>
              </div>
              <button 
                onClick={handleFileSelectDirect}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-accent rounded-sm transition-all group cursor-pointer border border-border hover:border-foreground/40 shadow-sm bg-secondary"
                title="Add individual files (Images, EPS Vectors, Videos)"
              >
                <div className="p-0 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-all">
                  <Plus size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Add Files</span>
              </button>
              <button 
                onClick={handleDirectorySelect}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-accent rounded-sm transition-all group cursor-pointer border border-border hover:border-foreground/40 shadow-sm bg-secondary"
                title="Select folder location on your computer for direct in-place file modifications"
              >
                <div className="p-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-all">
                  <FolderPlus size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Add Folder</span>
              </button>
            </div>

            {/* Processing Group */}
            <div className="flex items-center gap-1.5 p-1 border border-border rounded-sm bg-background/60 relative pt-3 shadow-sm">
              <div className="absolute top-0 left-1 -translate-y-1/2">
                <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90">PROCESSING :*</span>
              </div>
              <button 
                onClick={startGeneration}
                disabled={isGenerating || files.length === 0}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-emerald-500/10 rounded-sm transition-all group cursor-pointer disabled:opacity-30 border border-border hover:border-emerald-600 shadow-sm bg-secondary"
              >
                <div className="p-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-all">
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Generate</span>
              </button>
              <button 
                onClick={() => {
                  setFiles(prev => prev.map(f => ({ ...f, status: 'pending' })));
                  setTimeout(startGeneration, 100);
                }}
                disabled={isGenerating || files.length === 0}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-blue-500/10 rounded-sm transition-all group cursor-pointer disabled:opacity-30 border border-border hover:border-blue-600 shadow-sm bg-secondary"
              >
                <div className="p-0 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-all">
                  <RefreshCcw size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Regen All</span>
              </button>
              <button 
                onClick={() => {
                  setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending' } : f));
                  setTimeout(startGeneration, 100);
                }}
                disabled={isGenerating || !files.some(f => f.status === 'error')}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-amber-500/10 rounded-sm transition-all group cursor-pointer disabled:opacity-30 border border-border hover:border-amber-600 shadow-sm bg-secondary"
              >
                <div className="p-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-all">
                  <RefreshCw size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Retry Errors</span>
              </button>
              <button 
                onClick={() => {
                  stopRef.current = true;
                  setIsGenerating(false);
                }}
                disabled={!isGenerating}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-rose-500/10 rounded-sm transition-all group cursor-pointer disabled:opacity-30 border border-border hover:border-rose-600 shadow-sm bg-secondary"
              >
                <div className="p-0 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-all">
                  <Square size={14} className="fill-current" />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Stop</span>
              </button>
              <button 
                onClick={clearAll}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-rose-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-rose-600 shadow-sm bg-secondary"
              >
                <div className="p-0 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-all">
                  <Trash2 size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Clear</span>
              </button>
            </div>

            {/* Export Group */}
            <div className="flex items-center gap-1.5 p-1 border border-border rounded-sm bg-background/60 relative pt-3 shadow-sm">
              <div className="absolute top-0 left-1 -translate-y-1/2">
                <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1 bg-background/90">EXPORT :*</span>
              </div>
              <button 
                onClick={() => handleExport(selectedExportSite)}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-cyan-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-cyan-600 shadow-sm bg-secondary"
                title={`Export in ${selectedExportSite.toUpperCase()} format`}
              >
                <div className="p-0 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-all">
                  <FileSpreadsheet size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Export CSV</span>
              </button>
            </div>

            {/* Direct In-Place Disk Actions Group */}
            <div className="flex items-center gap-1.5 p-1 border border-emerald-500/30 rounded-sm bg-background/60 relative pt-3 shadow-sm">
              <div className="absolute top-0 left-1 -translate-y-1/2">
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/30 px-1 bg-background/90">DIRECT DISK IN-PLACE :*</span>
              </div>
              <button 
                onClick={() => handleEmbed('all')}
                disabled={files.length === 0 || isGenerating}
                className="flex flex-col items-center justify-center min-w-[58px] h-10 hover:bg-emerald-500/15 rounded-sm transition-all group cursor-pointer border border-emerald-500/50 hover:border-emerald-600 shadow-sm bg-emerald-500/10 disabled:opacity-30"
                title="Directly renames every file to its generated Title and embeds metadata in your local folder. Zero downloads!"
              >
                <div className="p-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-all">
                  <FolderCheck size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Save In-Place</span>
              </button>
              <button 
                onClick={renameAllByTitle}
                disabled={files.length === 0}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-amber-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-amber-600 shadow-sm bg-secondary disabled:opacity-30"
                title="Automatically update all filenames using their current titles"
              >
                <div className="p-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-all">
                  <Edit3 size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Rename All</span>
              </button>
              <button 
                onClick={() => handleEmbed('image')}
                disabled={files.length === 0 || isGenerating}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-indigo-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-indigo-600 shadow-sm bg-secondary disabled:opacity-30"
                title="Directly renames JPG/PNG files and embeds EXIF/IPTC/XMP in your folder"
              >
                <div className="p-0 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-all">
                  <FileImage size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Img In-Place</span>
              </button>
              <button 
                onClick={() => handleEmbed('eps')}
                disabled={files.length === 0 || isGenerating}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-orange-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-orange-600 shadow-sm bg-secondary disabled:opacity-30"
                title="Directly renames EPS/AI/SVG vectors and embeds PostScript XMP + sidecar in your folder"
              >
                <div className="p-0 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-all">
                  <Layers size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">EPS In-Place</span>
              </button>
              <button 
                onClick={() => handleEmbed('video')}
                disabled={files.length === 0 || isGenerating}
                className="flex flex-col items-center justify-center min-w-[50px] h-10 hover:bg-rose-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-rose-600 shadow-sm bg-secondary disabled:opacity-30"
                title="Directly renames MP4/MOV videos and writes companion .xmp sidecars in your folder"
              >
                <div className="p-0 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-all">
                  <Video size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Vid In-Place</span>
              </button>
              <button 
                onClick={() => setIsEmbedModalOpen(true)}
                className="flex flex-col items-center justify-center min-w-[45px] h-10 hover:bg-purple-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-purple-600 shadow-sm bg-secondary"
                title="Adobe Photoshop & Illustrator Automation Scripts (.jsx)"
              >
                <div className="p-0 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-all">
                  <FileCode size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Adobe JSX</span>
              </button>
              <button 
                onClick={handleDownloadZip}
                className="flex flex-col items-center justify-center min-w-[45px] h-10 hover:bg-emerald-500/10 rounded-sm transition-all group cursor-pointer border border-border hover:border-emerald-600 shadow-sm bg-secondary"
                title="Download All Renamed Files & Metadata in a single ZIP Bundle"
              >
                <div className="p-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-all">
                  <Download size={16} strokeWidth={3} />
                </div>
                <span className="text-[9px] font-black text-foreground uppercase tracking-tighter">Zip Bundle</span>
              </button>
            </div>

            {/* Utilities Group */}
            <div className="flex-1" />
          </div>

          {/* Secondary Controls Bar */}
          <div className="flex items-center flex-wrap px-4 py-1.5 gap-y-2 gap-x-4 bg-muted border-b border-border">
            {/* Connected Folder Status Pill */}
            <div className={cn(
              "flex items-center gap-2 border px-2 py-1 rounded-sm text-[10px] font-bold shadow-xs transition-all",
              directoryHandle 
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" 
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            )}>
              {directoryHandle ? (
                <>
                  <FolderCheck size={14} className="text-emerald-500 shrink-0" />
                  <span className="truncate max-w-[180px]">Folder: <strong>{folderName || 'Active'}</strong></span>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded-xs font-black uppercase tracking-wider">
                    In-Place
                  </span>
                  <button 
                    onClick={handleDirectorySelect}
                    className="text-[9px] underline hover:text-foreground cursor-pointer ml-1 text-muted-foreground"
                    title="Change to another folder location"
                  >
                    Change
                  </button>
                </>
              ) : (
                <>
                  <FolderPlus size={14} className="text-amber-500 shrink-0" />
                  <span>Folder Not Connected</span>
                  <button 
                    onClick={handleDirectorySelect}
                    className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xs uppercase text-[8px] font-black tracking-wider cursor-pointer ml-1"
                  >
                    Set Location
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 border border-border px-2 py-1 rounded-sm bg-background/60">
              <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1.5 bg-background/90 w-fit">ASSET TYPE :*</span>
              <div className="flex bg-secondary rounded-sm overflow-hidden border border-border p-0.5">
                {[
                  { id: 'all', label: 'All', icon: Database },
                  { id: 'image', label: 'Image', icon: FileImage },
                  { id: 'video', label: 'Video', icon: Video },
                  { id: 'eps', label: 'EPS', icon: Layers }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setSettings(prev => ({ ...prev, metadataFor: item.id as any }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all",
                      settings.metadataFor === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon size={12} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border border-border px-2 py-1 rounded-sm bg-background/60">
              <span className="text-[9px] font-black text-foreground uppercase tracking-widest border border-border px-1.5 bg-background/90 w-fit">EXPORT PRESET :*</span>
              <select 
                value={selectedExportSite}
                onChange={(e) => setSelectedExportSite(e.target.value)}
                className="bg-secondary border border-border text-foreground text-[10px] font-bold px-2 py-1 rounded-sm focus:outline-primary outline-none cursor-pointer"
              >
                <option value="adobe">Adobe Stock</option>
                <option value="shutterstock">Shutterstock</option>
                <option value="getty">Getty/iStock</option>
                <option value="alamy">Alamy</option>
                <option value="pond5">Pond5</option>
                <option value="dreamstime">Dreamstime</option>
                <option value="freepik">Freepik</option>
                <option value="vecteezy">Vecteezy</option>
                <option value="csv">General CSV</option>
              </select>
            </div>

            <button 
              onClick={() => handleExport(selectedExportSite)}
              className="px-3 py-1 rounded-sm bg-secondary text-foreground border border-border text-[10px] font-black uppercase tracking-widest hover:bg-accent active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download size={12} strokeWidth={3} />
              Download CSV
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3 ml-auto">
              {isPaused && (
                <div className="flex items-center gap-2 border border-red-500/30 px-2 py-1 rounded-sm bg-red-500/10 animate-pulse">
                  <AlertCircle size={10} className="text-red-400" />
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Rate Limit Cooldown ({cooldownTimer}s)</span>
                </div>
              )}
              <div className="flex items-center gap-2 border border-border/30 px-2 py-1 rounded-sm bg-background/40">
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]", isGenerating ? (isPaused ? "bg-red-500" : "bg-amber-500 animate-pulse") : "bg-emerald-500")} />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  {isGenerating ? (isPaused ? 'Rate Limited' : 'Processing...') : 'System Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2 border border-border/30 px-2 py-1 rounded-sm bg-background/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Assets:</span>
                <span className="text-[10px] font-black text-blue-400 tabular-nums">{files.length}</span>
              </div>
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

      {/* Main Content Area - Windows Explorer Style Table */}
      <div className="flex-1 overflow-hidden flex flex-col bg-background relative">
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
        {/* Windows Style Table Header */}
        <div className="flex flex-row w-full border-b border-border bg-muted text-[9px] font-black uppercase tracking-widest text-foreground">
          <div className="w-[12%] px-2 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            FILENAME :* <ChevronRight size={9} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[15%] px-2 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            TITLE :* <ChevronRight size={9} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[25%] px-2 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            KEYWORDS :* <ChevronRight size={10} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[20%] px-3 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            DESCRIPTION :* <ChevronRight size={10} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[10%] px-3 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            CATEGORY :* <ChevronRight size={10} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[8%] px-3 py-1.5 border-r border-border shrink-0 hover:bg-background/50 cursor-pointer flex items-center justify-between">
            KW COUNT : <ChevronRight size={10} className="rotate-90 opacity-50" />
          </div>
          <div className="w-[10%] px-3 py-1.5 text-center shrink-0 hover:bg-background/50 cursor-pointer">
            RATING :
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
            <div className="h-full w-full border-t border-border">
              <FixedSizeList
                height={window.innerHeight - 200}
                itemCount={filteredFiles.length}
                itemSize={42}
                width="100%"
                itemData={{
                  files: filteredFiles,
                  updateFile,
                  regenerateSingleFile,
                  downloadWithMetadata,
                  deleteFile,
                  isGenerating,
                  openErrorModal
                }}
                className="custom-scrollbar"
              >
                {FileRow}
              </FixedSizeList>
            </div>
          )}
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
                    Directly saves embedded EXIF/IPTC/XMP into your local files with the new title name and writes .xmp companion files.
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
                    Packages all files renamed with your Titles, embedded metadata, .xmp sidecars, and both Adobe .jsx scripts in one clean zip file.
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

      {/* Iframe Direct Disk Notice Modal */}
      {isIframeNoticeOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-background border border-emerald-500/40 rounded-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-emerald-500/30 flex items-center justify-between bg-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FolderCheck size={20} />
                <h3 className="font-black text-sm uppercase tracking-wider">সরাসরি ফোল্ডারে ফাইল রিনেম ও মেটাডাটা সেভ</h3>
              </div>
              <button 
                onClick={() => setIsIframeNoticeOpen(false)} 
                className="p-1 hover:bg-emerald-500/20 rounded text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-background text-foreground text-sm">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs leading-relaxed space-y-1">
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  ❓ কেন ফাইল ডাউনলোড হচ্ছিল?
                </p>
                <p className="text-muted-foreground">
                  আপনি বর্তমানে AI Studio প্রিভিউ ফ্রেমের (iFrame) মধ্যে কাজ করছেন। গুগল ক্রোম ও এজ ব্রাউজারের সিকিউরিটি রুল অনুযায়ী কোনো ওয়েবসাইট আইফ্রেমের ভেতর থেকে সরাসরি ব্যবহারকারীর কম্পিউটারের হার্ডডিস্ক ফোল্ডার পরিবর্তন বা রিনেম করতে পারে না।
                </p>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs leading-relaxed space-y-2">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  ⚡ কোনো ডাউনলোড ছাড়াই সরাসরি ফোল্ডারে ফাইল রিনেম ও সেভ করার ৩টি সহজ ধাপ:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>নিচের <strong>"নতুন ট্যাবে খুলুন (Open in New Tab)"</strong> বাটনে চাপ দিন।</li>
                  <li>নতুন ট্যাবে অ্যাপটি খুললে <strong>"Add Folder"</strong> অথবা <strong>"Save In-Place"</strong> এ ক্লিক করে আপনার কম্পিউটারের ফোল্ডারটি একবার সিলেক্ট করুন এবং ব্রাউজার পারমিশন চাইলে <em>"View & Edit Files"</em> এ সম্মতি দিন।</li>
                  <li>এরপর <strong>"Save In-Place"</strong> চাপলেই কোনো ডাউনলোড ছাড়া আপনার কম্পিউটারের ফোল্ডারের আসল ফাইলগুলোই রিনেম হয়ে যাবে এবং ভেতরে ৫-স্টার, টাইটেল ও কিওয়ার্ড বসে যাবে!</li>
                </ol>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button 
                  onClick={() => {
                    setIsIframeNoticeOpen(false);
                    window.open(window.location.href, '_blank');
                  }}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-md transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <ExternalLink size={16} />
                  <span>নতুন ট্যাবে খুলুন (Open in New Tab)</span>
                </button>
                <button 
                  onClick={() => setIsIframeNoticeOpen(false)}
                  className="py-3 px-4 bg-secondary hover:bg-muted text-foreground font-bold text-xs uppercase tracking-wider rounded-md transition-all border border-border cursor-pointer"
                >
                  বুঝেছি (Close)
                </button>
              </div>
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
        accept=".jpg,.jpeg,.png,.eps,.mp4,.mov,.ai,.svg,.webp,.avi"
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
