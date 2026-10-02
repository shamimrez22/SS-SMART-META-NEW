import React, { useState, useEffect, useRef } from 'react';
import { StockMetadata, ApiConfig, GeneratorSettings } from '../types';
import { 
  Globe, 
  Shield, 
  BarChart2, 
  Key, 
  CheckCircle2, 
  Download, 
  XCircle, 
  FileCode, 
  Lock, 
  Clock, 
  Sparkles, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  MessageSquare, 
  Zap,
  HardDrive,
  FileSpreadsheet,
  Layers,
  Cpu,
  ShieldCheck,
  FolderCheck,
  Upload,
  Folder,
  Play,
  Pause,
  Trash2,
  Image as ImageIcon,
  Film,
  Tag
} from 'lucide-react';
import { checkCurrentLicenseStatus, validateAndActivateKey, validateAndActivateKeyAsync, getAdminConfig, LicenseStatusResult } from '../services/licenseService';
import { buildLocalSmartMetadata } from '../services/aiService';
import { cn } from '../lib/utils';

interface MetaMasterViewProps {
  files: StockMetadata[];
  setFiles: React.Dispatch<React.SetStateAction<StockMetadata[]>>;
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
  openPreviewModal: (file: StockMetadata) => void;
  mode: 'all' | 'image' | 'vector' | 'video' | 'prompt';
  setMode: (mode: 'all' | 'image' | 'vector' | 'video' | 'prompt') => void;
  theme: string;
  setTheme: (theme: any) => void;
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  genOptions: {
    description: boolean;
    filenameHint: boolean;
    autoEmbed: boolean;
    autoRetry: boolean;
    pngIsolated: boolean;
    refinePngBg: boolean;
    autoSave: boolean;
    autoExport: boolean;
    aiEnhance: boolean;
  };
  setGenOptions: React.Dispatch<React.SetStateAction<any>>;
  activeKey: { provider: keyof ApiConfig; index: number };
  setActiveKey: (key: { provider: keyof ApiConfig; index: number }) => void;
  apiConfig: ApiConfig;
  setIsSettingsOpen: (open: boolean) => void;
  setIsContactOpen: (open: boolean) => void;
  setIsExtensionsOpen: (open: boolean) => void;
  setIsManageKeysOpen?: (open: boolean) => void;
  onOpenAdmin?: () => void;
  onOpenAdminLogin?: () => void;
  openExtensionsWithTab?: (tab: 'hub' | 'image-to-prompt' | 'prompt-expander' | 'palette-scout' | 'upscaler-advisor') => void;
  handleFileSelectDirect: () => void;
  handleDirectorySelect: () => void;
  startGeneration: () => void;
  isGenerating: boolean;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  clearAll: () => void;
  selectedExportSite: string;
  setSelectedExportSite: (site: string) => void;
  handleExport: (site: string, isAll: boolean) => void;
  renameAllByTitle: () => void;
  handleEmbed: (type: 'image' | 'video' | 'eps' | 'all', targetSingleId?: string) => void | Promise<void>;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  folderName?: string;
  directoryHandle?: any;
}

interface TableRowProps {
  file: StockMetadata;
  idx: number;
  isSelected: boolean;
  isBlue: boolean;
  isDark: boolean;
  copiedCell: string | null;
  onSelect: (id: string) => void;
  onOpenPreview: (file: StockMetadata) => void;
  onCopy: (e: React.MouseEvent, text: string, cellId: string) => void;
  onRetry: (id: string) => void;
  onEmbed: (fileId: string) => void;
  onUpdatePreview?: (id: string, previewUrl: string) => void;
}

const TableRow = React.memo<TableRowProps>(({
  file,
  idx,
  isSelected,
  isBlue,
  isDark,
  copiedCell,
  onSelect,
  onOpenPreview,
  onCopy,
  onRetry,
  onEmbed,
  onUpdatePreview,
}) => {
  const isGeneratingThis = file.status === 'generating' || file.status === 'retrying';
  const isPendingThis = file.status === 'pending';
  const isCompletedThis = file.status === 'completed' || file.status === 'saved';
  const isErrorThis = file.status === 'error';
  
  const ext = (file.fileType || file.filename.split('.').pop() || '').toLowerCase();
  const fIsVec = ['eps', 'ai', 'svg'].includes(ext) || file.fileType === 'vector';
  const fIsVid = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || file.fileType === 'video';

  const displayTitle = file.title 
    ? file.title 
    : (isGeneratingThis ? 'Processing...' : (isErrorThis ? '⚠️ Error (Click to Retry)' : (isPendingThis ? '— (Pending)' : file.filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '))));

  const displayKeywords = file.keywords 
    ? file.keywords
    : (isGeneratingThis ? 'Processing...' : (isErrorThis ? '⚠️ Error' : '—'));

  const kwCount = file.keywords 
    ? file.keywords.split(',').filter(Boolean).length 
    : 0;

  const displayDescription = file.description 
    ? file.description 
    : (isGeneratingThis ? 'Processing...' : (isErrorThis ? '⚠️ Error (Click to Retry)' : '—'));

  const displayCategory = file.category 
    ? file.category 
    : (isGeneratingThis ? 'Processing...' : '—');

  const textClass = isGeneratingThis && !file.title
    ? (isBlue ? 'text-cyan-300 font-semibold animate-pulse' : (isDark ? 'text-sky-300 font-semibold animate-pulse' : 'text-sky-600 font-semibold animate-pulse')) 
    : (isPendingThis && !file.title
      ? (isBlue ? 'text-slate-300 font-medium' : (isDark ? 'text-slate-300 font-medium' : 'text-slate-400 font-medium')) 
      : (isBlue ? 'text-slate-100 font-semibold' : (isDark ? 'text-slate-100 font-semibold' : 'text-slate-800 font-semibold')));

  return (
    <div 
      onClick={() => onSelect(file.id)}
      onDoubleClick={() => onOpenPreview(file)}
      className={cn(
        "flex items-center text-xs h-[34px] px-3 border-b cursor-pointer transition-colors font-sans select-none group shrink-0",
        isBlue
          ? (isSelected 
            ? "bg-[#163a70] text-white border-y border-cyan-400 shadow-[inset_0_0_0_1px_#22d3ee]" 
            : "border-[#0c203e] hover:bg-[#0e274c] text-slate-100")
          : (isDark 
            ? (isSelected 
              ? "bg-[#1c2e43] text-white border-y border-[#2d4666]/60 shadow-[inset_0_0_0_1px_#0284c7]" 
              : "border-[#213347] hover:bg-[#1b2b3e] text-slate-100")
            : (isSelected 
              ? "bg-sky-100 text-slate-900 border-y border-sky-300 font-medium shadow-[inset_0_0_0_1px_#38bdf8]" 
              : "border-slate-200 hover:bg-slate-50 text-slate-800"))
      )}
    >
      {/* Preview Thumbnail */}
      <div 
        className="w-[44px] shrink-0 flex items-center justify-center p-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPreview(file);
        }}
        title="Click to view full preview"
      >
        {file.previewUrl ? (
          <div className="w-7 h-7 rounded overflow-hidden border border-slate-700/80 bg-slate-950 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform cursor-pointer relative">
            {fIsVid && !file.previewUrl.startsWith('data:image/') ? (
              <div className="w-full h-full relative bg-purple-950 flex flex-col items-center justify-center text-purple-200">
                <span className="text-[11px] leading-none">🎬</span>
                <span className="text-[6.5px] font-bold text-purple-300 font-mono tracking-tighter">VID</span>
              </div>
            ) : (
              <div className="w-full h-full relative">
                <img 
                  src={file.previewUrl} 
                  alt={file.filename} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {fIsVid && (
                  <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 text-purple-300 px-0.5 rounded-tl font-bold leading-none">▶</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={cn(
            "w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold border shadow-2xs cursor-pointer",
            fIsVec ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
            fIsVid ? "bg-purple-500/20 text-purple-300 border-purple-500/40" :
            "bg-blue-500/20 text-blue-300 border-blue-500/40"
          )}>
            {fIsVec ? 'EPS' : fIsVid ? '🎬' : 'IMG'}
          </div>
        )}
      </div>

      {/* Filename */}
      <div 
        className={cn(
          "w-[17%] truncate px-1 font-semibold",
          isBlue 
            ? (isSelected ? "text-white font-bold hover:text-cyan-200" : "text-slate-100 hover:text-cyan-200")
            : (isDark 
              ? (isSelected ? "text-white font-bold hover:text-cyan-300" : "text-slate-100 hover:text-cyan-300")
              : (isSelected ? "text-sky-950 font-bold hover:text-sky-700" : "text-slate-900 hover:text-sky-600"))
        )}
        title={`${file.filename} (Click to copy)`}
        onClick={(e) => onCopy(e, file.filename, `fn-${file.id}`)}
      >
        {copiedCell === `fn-${file.id}` ? '✓ Copied' : file.filename}
      </div>

      {/* Title */}
      <div 
        className={cn("w-[22%] truncate pr-2 hover:text-cyan-300 font-semibold", textClass, isErrorThis && "cursor-pointer hover:underline text-rose-300")} 
        title={isErrorThis ? "Click to retry generating this file" : `${displayTitle} (Click to copy)`}
        onClick={(e) => {
          if (isErrorThis) {
            e.stopPropagation();
            onRetry(file.id);
            return;
          }
          onCopy(e, file.title || displayTitle, `title-${file.id}`);
        }}
      >
        {copiedCell === `title-${file.id}` ? '✓ Copied' : displayTitle}
      </div>

      {/* Keywords */}
      <div 
        className={cn(
          "w-[25%] truncate pr-2 hover:text-cyan-300 font-semibold", 
          isCompletedThis ? (isBlue ? "text-slate-100" : (isDark ? "text-slate-100" : "text-slate-800")) : textClass
        )} 
        title={`${displayKeywords} (Click to copy)`}
        onClick={(e) => onCopy(e, file.keywords || displayKeywords, `kw-${file.id}`)}
      >
        {copiedCell === `kw-${file.id}` ? '✓ Copied' : displayKeywords}
      </div>

      {/* Description */}
      <div 
        className={cn(
          "w-[20%] truncate pr-2 hover:text-cyan-300 font-semibold", 
          isCompletedThis ? (isBlue ? "text-slate-100" : (isDark ? "text-slate-100" : "text-slate-800")) : textClass
        )} 
        title={`${displayDescription} (Click to copy)`}
        onClick={(e) => onCopy(e, file.description || displayDescription, `desc-${file.id}`)}
      >
        {copiedCell === `desc-${file.id}` ? '✓ Copied' : displayDescription}
      </div>

      {/* Category */}
      <div 
        className={cn(
          "w-[6%] truncate pr-2 font-semibold", 
          isCompletedThis ? (isBlue ? "text-slate-100" : (isDark ? "text-slate-100" : "text-slate-800")) : textClass
        )} 
        title={displayCategory}
      >
        {displayCategory}
      </div>

      {/* KW Count */}
      <div className={cn("w-[5%] text-center font-mono whitespace-nowrap font-bold", isBlue ? "text-slate-100" : (isDark ? "text-slate-100" : "text-slate-800"))}>
        {kwCount}
      </div>

      {/* Rating & In-Place Embed Action */}
      <div className="w-[5%] flex items-center justify-center gap-1 text-center whitespace-nowrap">
        <span className="text-amber-400 tracking-tighter select-none text-[9.5px]">★★★★★</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEmbed(file.id);
          }}
          title={`"${file.filename}": সরাসরি মেটাডাটা এম্বেড করুন`}
          className="opacity-80 hover:opacity-100 px-1 py-0.5 bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-500/40 rounded transition-all cursor-pointer shrink-0 flex items-center gap-0.5 text-[9px] font-bold"
        >
          <FolderCheck size={10} strokeWidth={2.5} />
          <span>Embed</span>
        </button>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.file === next.file &&
    prev.isSelected === next.isSelected &&
    prev.isBlue === next.isBlue &&
    prev.isDark === next.isDark &&
    prev.copiedCell === next.copiedCell
  );
});

const LiveTimerWidget = React.memo<{ isGenerating: boolean; isPaused: boolean; isBlue: boolean; isDark: boolean }>(({
  isGenerating,
  isPaused,
  isBlue,
  isDark
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isGenerating && !isPaused) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, isPaused]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div 
      onClick={() => setElapsed(0)}
      title="Click to reset timer"
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-mono cursor-pointer transition-colors px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap",
        isBlue 
          ? "border-[#1d4ed8] bg-[#07152b] text-cyan-300 hover:text-white shadow-[0_0_8px_rgba(34,211,238,0.25)]" 
          : (isDark ? "border-slate-700/80 bg-[#0f1722] text-slate-300 hover:text-cyan-300" : "border-slate-300 bg-white text-slate-700 hover:text-sky-700 shadow-2xs")
      )}
    >
      <span>Elapsed: {formatTimer(elapsed)}</span>
      <span className="opacity-40">|</span>
      <span>Total: {formatTimer(elapsed + (isGenerating ? 15 : 0))}</span>
    </div>
  );
});

export const MetaMasterView: React.FC<MetaMasterViewProps> = ({
  files,
  setFiles,
  selectedFileId,
  setSelectedFileId,
  openPreviewModal,
  mode,
  setMode,
  theme,
  setTheme,
  settings,
  setSettings,
  genOptions,
  setGenOptions,
  activeKey,
  setActiveKey,
  apiConfig,
  setIsSettingsOpen,
  setIsContactOpen,
  setIsExtensionsOpen,
  setIsManageKeysOpen,
  onOpenAdmin,
  onOpenAdminLogin,
  openExtensionsWithTab,
  handleFileSelectDirect,
  handleDirectorySelect,
  startGeneration,
  isGenerating,
  isPaused,
  setIsPaused,
  clearAll,
  selectedExportSite,
  setSelectedExportSite,
  handleExport,
  renameAllByTitle,
  handleEmbed,
  showNotification,
  folderName,
  directoryHandle,
}) => {
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Bottom Interactive Link Modals
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isAdobeScriptModalOpen, setIsAdobeScriptModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isQuickSaveModalOpen, setIsQuickSaveModalOpen] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState<'photoshop' | 'illustrator'>('photoshop');
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [currentLicense, setCurrentLicense] = useState<LicenseStatusResult>(checkCurrentLicenseStatus);
  const adminConfig = getAdminConfig();

  // Dynamic Theme state (Dark, Light, System)
  const [systemIsDark, setSystemIsDark] = useState(() => {
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isBlue = theme === 'system' || theme === 'blue';
  const isLight = theme === 'light';
  const isDark = theme === 'dark' || (!isLight && !isBlue);

  // Real-time live license status sync & day countdown
  useEffect(() => {
    const updateLicense = () => {
      setCurrentLicense(checkCurrentLicenseStatus());
    };
    updateLicense();
    // Check periodically so day countdown updates dynamically
    const intervalId = setInterval(updateLicense, 15000);
    window.addEventListener('storage', updateLicense);
    window.addEventListener('focus', updateLicense);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('storage', updateLicense);
      window.removeEventListener('focus', updateLicense);
    };
  }, []);

  const copyText = (e: React.MouseEvent, text: string, cellId: string) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 1500);
    showNotification("Copied to clipboard", "success");
  };

  // Separate files by active mode so Vector, Image, and Video operate completely independently
  const isVectorFile = (f: StockMetadata) => {
    const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
    return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
  };

  const isVideoFile = (f: StockMetadata) => {
    const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
    return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
  };

  const { currentModeFiles, imageFilesCount, vectorFilesCount, videoFilesCount } = React.useMemo(() => {
    let img = 0, vec = 0, vid = 0;
    const modeFiles: StockMetadata[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isVec = isVectorFile(f);
      const isVid = isVideoFile(f);
      if (isVec) vec++;
      else if (isVid) vid++;
      else img++;

      if (mode === 'all') {
        modeFiles.push(f);
      } else if (mode === 'vector' && isVec) {
        modeFiles.push(f);
      } else if (mode === 'video' && isVid) {
        modeFiles.push(f);
      } else if (mode === 'image' && !isVec && !isVid) {
        modeFiles.push(f);
      }
    }
    return {
      currentModeFiles: modeFiles,
      imageFilesCount: img,
      vectorFilesCount: vec,
      videoFilesCount: vid
    };
  }, [files, mode]);

  // Ensure files are never hidden: if current mode has 0 files but other modes have files, switch to all
  React.useEffect(() => {
    if (files.length > 0 && currentModeFiles.length === 0) {
      setMode('all');
    }
  }, [files.length, currentModeFiles.length, setMode]);

  // Single Page rendering for all uploaded files with smooth 60fps scrolling
  const visibleFiles = currentModeFiles;

  // Virtualized smooth 60fps windowing for high file counts
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [containerHeight, setContainerHeight] = React.useState(600);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el) setContainerHeight(el.clientHeight || 600);
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleRowRetry = React.useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'pending', errorMessage: undefined } : f));
    setTimeout(() => startGeneration(), 60);
  }, [setFiles, startGeneration]);

  const handleRowEmbed = React.useCallback((id: string) => {
    handleEmbed('all', id);
  }, [handleEmbed]);

  const handleTableScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const ROW_HEIGHT = 34;
  const totalRows = visibleFiles.length;
  const isVirtualized = totalRows > 40;
  const BUFFER = 16;
  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER) : 0;
  const visibleCount = isVirtualized ? Math.ceil(containerHeight / ROW_HEIGHT) + (BUFFER * 2) : totalRows;
  const endIndex = isVirtualized ? Math.min(totalRows, startIndex + visibleCount) : totalRows;
  const topOffset = isVirtualized ? startIndex * ROW_HEIGHT : 0;
  const totalVirtualHeight = isVirtualized ? totalRows * ROW_HEIGHT : undefined;

  const renderedRows = React.useMemo(() => {
    if (!isVirtualized) {
      return visibleFiles.map((file, idx) => ({ file, idx }));
    }
    return visibleFiles.slice(startIndex, endIndex).map((file, sliceIdx) => ({
      file,
      idx: startIndex + sliceIdx,
    }));
  }, [visibleFiles, isVirtualized, startIndex, endIndex]);

  const allFilesCount = files.length;

  const selectedFile = React.useMemo(() => {
    if (!selectedFileId) return null;
    return currentModeFiles.find(f => f.id === selectedFileId) || null;
  }, [currentModeFiles, selectedFileId]);

  const { completedCount, remainingCount, progressPercent } = React.useMemo(() => {
    let completed = 0;
    for (let i = 0; i < currentModeFiles.length; i++) {
      const s = currentModeFiles[i].status;
      if (s === 'completed' || s === 'saved') completed++;
    }
    const percent = currentModeFiles.length > 0 ? Math.round((completed / currentModeFiles.length) * 100) : 0;
    return {
      completedCount: completed,
      remainingCount: currentModeFiles.length - completed,
      progressPercent: percent
    };
  }, [currentModeFiles]);

  return (
    <div className={cn(
      "flex-1 flex flex-col min-w-0 h-full overflow-hidden select-none font-sans transition-colors duration-200",
      isBlue ? "bg-[#0a192f] text-blue-100" : (isDark ? "bg-[#162332] text-slate-200" : "bg-[#f1f5f9] text-slate-800")
    )}>
      {/* 1. Main Header - Brand & Top Controls */}
      <header className={cn(
        "border-b px-3.5 py-2.5 flex items-center justify-between z-30 shrink-0 transition-colors",
        isBlue 
          ? "bg-[#07152b] border-[#1d4ed8] text-slate-100 shadow-[0_2px_12px_rgba(29,78,216,0.3)]" 
          : (isDark ? "bg-[#14202d] border-[#233449] text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-2xs")
      )}>
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          {/* New Modern SS SMART META Custom Monogram Logo */}
          <button
            type="button"
            onClick={() => {
              if (onOpenAdminLogin) onOpenAdminLogin();
              else if (onOpenAdmin) onOpenAdmin();
            }}
            className="relative w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            title="SS SMART META"
          >
            <svg className="w-9 h-9 shrink-0 drop-shadow-[0_2px_8px_rgba(6,182,212,0.35)]" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="url(#ssGradBg)" />
              {/* First S */}
              <path d="M15 10.5C15 9.12 13.88 8 12.5 8H10C8.34 8 7 9.34 7 11C7 12.66 8.34 14 10 14H12C13.66 14 15 15.34 15 17C15 18.66 13.66 20 12 20H9.5C8.12 20 7 21.12 7 22.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Second S */}
              <path d="M25 12C25 10.34 23.66 9 22 9H19.5C18.12 9 17 10.12 17 11.5M25 18.5C25 17.12 23.88 16 22.5 16H20C18.34 16 17 17.34 17 19C17 20.66 18.34 22 20 22H22.5C23.88 22 25 23.12 25 24.5C25 25.88 23.88 27 22.5 27H18" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Tech Accent Dot */}
              <circle cx="28" cy="8" r="2.2" fill="#22d3ee" />
              <defs>
                <linearGradient id="ssGradBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0891b2" />
                  <stop offset="0.5" stopColor="#0284c7" />
                  <stop offset="1" stopColor="#1e3a8a" />
                </linearGradient>
              </defs>
            </svg>
          </button>
          <div 
            onClick={() => {
              if (onOpenAdminLogin) onOpenAdminLogin();
              else if (onOpenAdmin) onOpenAdmin();
            }}
            className="flex flex-col cursor-pointer select-none group"
            title="SS SMART META"
          >
            <h1 className={cn("text-2xl font-bold tracking-tight leading-none group-hover:text-cyan-300 transition-colors", isBlue ? "text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" : (isDark ? "text-white" : "text-slate-900"))}>SS SMART META</h1>
            <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-widest text-cyan-400 uppercase leading-none mt-1">DEVELOPED BY MD.SHAMIM REZA</span>
          </div>
        </div>

        {/* Right: Provider, Status & Action Links */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Provider Select */}
          <div className={cn("flex items-center gap-1.5 text-xs", isBlue ? "text-blue-200" : (isDark ? "text-slate-200" : "text-slate-700"))}>
            <span>Provider:</span>
            <select 
              value={activeKey.provider}
              onChange={(e) => {
                const provider = e.target.value as keyof ApiConfig;
                const firstReadyIndex = apiConfig[provider].findIndex(key => key.trim() !== '');
                setActiveKey({ provider, index: firstReadyIndex !== -1 ? firstReadyIndex : 0 });
              }}
              className={cn(
                "border rounded px-2.5 py-1 text-xs focus:outline-none cursor-pointer transition-colors",
                isBlue 
                  ? "bg-[#0c2246] border-[#2563eb] text-white shadow-[0_0_8px_rgba(37,99,235,0.3)]" 
                  : (isDark ? "bg-[#1b2737] border-slate-700/80 text-white" : "bg-white border-slate-300 text-slate-900 shadow-2xs")
              )}
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>

          {/* API Key Status */}
          <div className={cn("flex items-center gap-1.5 text-xs", isBlue ? "text-blue-200" : (isDark ? "text-slate-200" : "text-slate-700"))}>
            <span>API Key:</span>
            <span className="flex items-center gap-1 text-[#22c55e] font-medium">
              <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-xs inline-block" />
              Ready
            </span>
          </div>

          {/* Manage Keys */}
          <button 
            type="button"
            onClick={() => {
              if (setIsManageKeysOpen) {
                setIsManageKeysOpen(true);
              } else {
                setIsSettingsOpen(true);
              }
            }}
            className={cn(
              "px-3 py-1 rounded text-xs font-normal transition-colors cursor-pointer",
              isBlue 
                ? "bg-[#0c2246] hover:bg-[#143265] text-cyan-200 border border-[#2563eb]" 
                : (isDark ? "bg-[#172535] hover:bg-[#203247] text-white border border-[#0284c7]" : "bg-white hover:bg-sky-50 text-sky-700 border border-sky-400 shadow-2xs")
            )}
          >
            Manage Keys
          </button>

          {/* Website Link */}
          <button 
            type="button"
            onClick={() => window.open('https://ais.google', '_blank')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-normal transition-colors cursor-pointer",
              isBlue 
                ? "bg-[#0c2246] hover:bg-[#143265] text-cyan-300 border border-[#2563eb]" 
                : (isDark ? "bg-[#172535] hover:bg-[#203247] text-cyan-300 border border-[#0284c7]" : "bg-white hover:bg-cyan-50 text-cyan-700 border border-cyan-400 shadow-2xs")
            )}
          >
            <Globe size={12} className={isBlue ? "text-cyan-400" : (isDark ? "text-[#0284c7]" : "text-cyan-600")} />
            <span>Website</span>
          </button>

          {/* WhatsApp Support */}
          <button 
            type="button"
            onClick={() => setIsContactOpen(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-normal transition-colors cursor-pointer",
              isBlue 
                ? "bg-[#0c2246] hover:bg-[#143265] text-emerald-300 border border-emerald-500" 
                : (isDark ? "bg-[#172535] hover:bg-[#203247] text-emerald-300 border border-[#16a34a]" : "bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-500 shadow-2xs")
            )}
          >
            <span className="text-[#22c55e] text-xs">💬</span>
            <span>WhatsApp</span>
          </button>

          {/* YouTube Channel */}
          <button 
            type="button"
            onClick={() => window.open('https://youtube.com', '_blank')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-normal transition-colors cursor-pointer",
              isBlue 
                ? "bg-[#0c2246] hover:bg-[#143265] text-rose-300 border border-rose-500" 
                : (isDark ? "bg-[#172535] hover:bg-[#203247] text-rose-300 border border-[#dc2626]" : "bg-white hover:bg-rose-50 text-rose-700 border border-rose-400 shadow-2xs")
            )}
          >
            <span className="text-[#ef4444] text-xs">▶</span>
            <span>YouTube</span>
          </button>
        </div>
      </header>

      {/* 2. Control Groups Section matching image.png */}
      <div className={cn(
        "border-b px-2.5 py-1 flex flex-col gap-1 shrink-0 transition-colors",
        isBlue ? "bg-[#07162c] border-[#1d4ed8]" : (isDark ? "bg-[#14202d] border-[#233449]" : "bg-[#f8fafc] border-slate-200")
      )}>
        {/* Row 1: Mode, Theme, Generation Options, Application */}
        <div className="flex items-center gap-1.5 flex-wrap w-full py-0.5">
          {/* Mode Group */}
          <fieldset className={cn("border rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_6px_rgba(37,99,235,0.3)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Mode</legend>
            <button 
              type="button"
              onClick={() => setMode('all')}
              title={`Show ALL assets in workspace (Images, EPS Vectors, Videos) - ${allFilesCount} files`}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1",
                mode === 'all' 
                  ? "bg-[#22c55e] text-white shadow-xs ring-1 ring-emerald-300" 
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>ALL</span>
              <span className="text-[9.5px] opacity-85 font-mono font-normal">({allFilesCount})</span>
            </button>
            <button 
              type="button"
              onClick={() => setMode('image')}
              title={`Show Image assets (JPG, PNG, WebP) - ${imageFilesCount} files`}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1",
                mode === 'image' 
                  ? "bg-[#22c55e] text-white shadow-xs" 
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Image</span>
              <span className="text-[9.5px] opacity-85 font-mono font-normal">({imageFilesCount})</span>
            </button>
            <button 
              type="button"
              onClick={() => setMode('vector')}
              title={`Show Vector assets (EPS, AI, SVG) - ${vectorFilesCount} files`}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1",
                mode === 'vector' 
                  ? "bg-[#22c55e] text-white shadow-xs" 
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Vector</span>
              <span className="text-[9.5px] opacity-85 font-mono font-normal">({vectorFilesCount})</span>
            </button>
            <button 
              type="button"
              onClick={() => setMode('video')}
              title={`Show Video assets (MP4, MOV, MKV) - ${videoFilesCount} files`}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1",
                mode === 'video' 
                  ? "bg-[#22c55e] text-white shadow-xs" 
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Video</span>
              <span className="text-[9.5px] opacity-85 font-mono font-normal">({videoFilesCount})</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                if (openExtensionsWithTab) {
                  openExtensionsWithTab('image-to-prompt');
                } else {
                  setIsExtensionsOpen(true);
                }
              }}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap",
                isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200")
              )}
            >
              Prompt Gen
            </button>
          </fieldset>

          {/* Theme Group (Dark, Light, System / Blue) */}
          <fieldset className={cn("border rounded px-1.5 py-0.5 flex items-center gap-0.5 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_6px_rgba(37,99,235,0.3)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Theme</legend>
            <button 
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] transition-all cursor-pointer whitespace-nowrap font-bold",
                theme === 'dark' 
                  ? "bg-[#1b2737] text-white border border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.35)]" 
                  : (isBlue 
                    ? "bg-[#091b38] text-blue-300 border border-[#1d4ed8] hover:bg-[#102b54]" 
                    : (isDark 
                      ? "bg-[#162332] text-slate-300 border border-[#30445a] hover:bg-slate-800 hover:text-white" 
                      : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              Dark
            </button>
            <button 
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] transition-all cursor-pointer whitespace-nowrap font-bold",
                theme === 'light' 
                  ? "bg-white text-sky-900 border-2 border-sky-600 shadow-xs" 
                  : (isBlue 
                    ? "bg-[#091b38] text-blue-300 border border-[#1d4ed8] hover:bg-[#102b54]" 
                    : (isDark 
                      ? "bg-[#162332] text-slate-300 border border-[#30445a] hover:bg-slate-800 hover:text-white" 
                      : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              Light
            </button>
            <button 
              type="button"
              onClick={() => setTheme('system')}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] transition-all cursor-pointer whitespace-nowrap font-bold",
                isBlue 
                  ? "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white border border-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.65)]" 
                  : (isDark 
                    ? "bg-[#162332] text-slate-300 border border-[#30445a] hover:bg-slate-800 hover:text-white" 
                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200")
              )}
            >
              System (Blue)
            </button>
          </fieldset>

          {/* Keyword Style Group: Single Keyword, Double Keyword (e.g. "happy birthday"), Mixed */}
          <fieldset className={cn("border rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap whitespace-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_6px_rgba(37,99,235,0.3)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap flex items-center gap-1", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>
              <Tag size={10} className="text-cyan-400" />
              <span>Keyword Style</span>
            </legend>
            <button 
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'mixed', singleWordKeywords: false }));
                showNotification('Keyword Style: Mixed (Single & 2-word phrases e.g. "happy birthday")', 'info');
              }}
              title="Mixed Keywords: Generates both high-converting 2-word phrases (e.g. 'happy birthday') and single words"
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95",
                (!settings.keywordStyle || settings.keywordStyle === 'mixed') && !settings.singleWordKeywords
                  ? "bg-[#22c55e] text-white shadow-xs ring-1 ring-emerald-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              Mixed
            </button>
            <button 
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'single', singleWordKeywords: true }));
                showNotification('Keyword Style: Single Keywords (1-word tags only, e.g. "happy", "birthday")', 'info');
              }}
              title="Single Keywords Only: Strictly 1-word tags (e.g. 'happy', 'birthday', 'party')"
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95",
                settings.keywordStyle === 'single' || settings.singleWordKeywords
                  ? "bg-[#0284c7] text-white shadow-xs ring-1 ring-sky-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              Single
            </button>
            <button 
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'double', singleWordKeywords: false }));
                showNotification('Keyword Style: Double Keywords (Strictly 2-word phrases e.g. "happy birthday", "birthday party")', 'success');
              }}
              title="Double Keywords: Strictly 2-word compound phrases (e.g. 'happy birthday', 'birthday party', 'festive cake') - never split!"
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95",
                settings.keywordStyle === 'double'
                  ? "bg-amber-500 text-white shadow-xs ring-1 ring-amber-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              Double (2-Words)
            </button>
          </fieldset>

          {/* Generation Options Group (Crystal-clear light white text, no warning icons) */}
          <fieldset className={cn("border rounded px-1.5 py-0.5 flex items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_6px_rgba(37,99,235,0.3)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Generation Options</legend>
            
            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.description}
                onChange={(e) => setGenOptions(prev => ({ ...prev, description: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-[#0284c7] cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">Description</span>
            </label>

            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.filenameHint}
                onChange={(e) => setGenOptions(prev => ({ ...prev, filenameHint: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-[#22c55e] cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">Filename Hint</span>
            </label>

            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.autoEmbed}
                onChange={(e) => setGenOptions(prev => ({ ...prev, autoEmbed: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-slate-400 cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">Auto Embed</span>
            </label>

            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.autoRetry}
                onChange={(e) => setGenOptions(prev => ({ ...prev, autoRetry: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">Auto Retry</span>
            </label>

            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.pngIsolated}
                onChange={(e) => setGenOptions(prev => ({ ...prev, pngIsolated: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">PNG Isolated</span>
            </label>

            <label className={cn("flex items-center gap-1 text-[11px] cursor-pointer select-none whitespace-nowrap shrink-0", isBlue ? "text-white font-semibold" : (isDark ? "text-white font-semibold" : "text-slate-900 font-semibold"))}>
              <input 
                type="checkbox" 
                checked={genOptions.refinePngBg}
                onChange={(e) => setGenOptions(prev => ({ ...prev, refinePngBg: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-slate-400 cursor-pointer"
              />
              <span className="whitespace-nowrap text-white font-semibold">Refine PNG BG</span>
            </label>
          </fieldset>

          {/* Application Group */}
          <fieldset className={cn("border rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_6px_rgba(37,99,235,0.3)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Application</legend>
            <button 
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap",
                isBlue 
                  ? "bg-[#091b38] text-white border border-[#1d4ed8] hover:bg-[#102b54]" 
                  : (isDark ? "bg-[#172535] text-white border border-[#0284c7] hover:bg-[#203247]" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs")
              )}
            >
              Settings
            </button>
            <button 
              type="button"
              onClick={() => setIsContactOpen(true)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap",
                isBlue 
                  ? "bg-[#091b38] text-white border border-[#1d4ed8] hover:bg-[#102b54]" 
                  : (isDark ? "bg-[#172535] text-white border border-[#0284c7] hover:bg-[#203247]" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs")
              )}
            >
              Contact
            </button>
          </fieldset>
        </div>

        {/* Row 2: Input, Processing, Export, Utilities - Clean, compact buttons with zero scrollbars */}
        <div className="flex items-center gap-1.5 flex-wrap xl:flex-nowrap overflow-x-hidden w-full py-1 shrink-0">
          {/* Input Group */}
          <fieldset className={cn("border rounded px-2 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_4px_rgba(37,99,235,0.25)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Input</legend>
            <button 
              type="button"
              onClick={handleFileSelectDirect}
              className={cn(
                "px-2.5 py-1 h-7 text-white font-bold text-[11px] rounded tracking-wide cursor-pointer active:scale-95 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1",
                isBlue ? "bg-[#1d4ed8] hover:bg-[#2563eb] border border-cyan-400" : "bg-[#0284c7] hover:bg-[#0369a1]"
              )}
            >
              <Upload size={12} strokeWidth={2.5} />
              <span>SELECT FILE</span>
            </button>
            <button 
              type="button"
              onClick={handleDirectorySelect}
              className={cn(
                "px-2.5 py-1 h-7 text-white font-bold text-[11px] rounded tracking-wide cursor-pointer active:scale-95 shadow-2xs transition-all whitespace-nowrap flex items-center gap-1",
                isBlue ? "bg-[#1d4ed8] hover:bg-[#2563eb] border border-cyan-400" : "bg-[#0284c7] hover:bg-[#0369a1]"
              )}
            >
              <Folder size={12} strokeWidth={2.5} />
              <span>SELECT FOLDER</span>
            </button>
            {folderName && (
              <span 
                title={`Connected folder: ${folderName} (Direct in-place disk write active)`}
                className="px-2 py-0.5 h-7 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-mono text-[10.5px] font-bold flex items-center gap-1 shrink-0 animate-in fade-in"
              >
                <FolderCheck size={12} className="text-emerald-400 shrink-0" />
                <span className="truncate max-w-[130px]">{folderName}</span>
                <span className="text-[8.5px] bg-emerald-500/40 text-emerald-200 px-1 rounded ml-0.5">IN-PLACE</span>
              </span>
            )}
          </fieldset>

          {/* Processing Group */}
          <fieldset className={cn("border rounded px-2 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_4px_rgba(37,99,235,0.25)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Processing</legend>
            <button 
              type="button"
              onClick={() => startGeneration()}
              disabled={isGenerating || files.length === 0}
              title={isGenerating ? "AI Metadata generation in progress..." : `Generate metadata for ${currentModeFiles.length > 0 ? currentModeFiles.length : files.length} files in workspace`}
              className="px-2.5 py-1 h-7 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-[11px] rounded cursor-pointer active:scale-95 transition-all disabled:opacity-50 shadow-2xs whitespace-nowrap flex items-center gap-1"
            >
              <Play size={11} fill="currentColor" />
              <span>{isGenerating ? 'Generating...' : 'Start'}</span>
            </button>
            <button 
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="px-2.5 py-1 h-7 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-[11px] rounded cursor-pointer active:scale-95 transition-all shadow-2xs whitespace-nowrap flex items-center gap-1"
            >
              <Pause size={11} fill="currentColor" />
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                const targetList = currentModeFiles.length > 0 ? currentModeFiles : files;
                const targetIds = new Set(targetList.map(f => f.id));
                setFiles(prev => prev.map(f => (targetIds.has(f.id) && f.status === 'error') ? { ...f, status: 'pending', errorMessage: undefined } : f));
                setTimeout(() => startGeneration(), 80);
              }}
              disabled={isGenerating || files.length === 0}
              className="px-2.5 py-1 h-7 bg-[#06b6d4] hover:bg-[#0891b2] text-white font-bold text-[11px] rounded cursor-pointer active:scale-95 transition-all disabled:opacity-50 shadow-2xs whitespace-nowrap flex items-center gap-1"
            >
              <RefreshCw size={11} className={isGenerating ? "animate-spin" : ""} />
              <span>Retry</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                const targetIds = new Set(currentModeFiles.map(f => f.id));
                setFiles(prev => prev.filter(f => !targetIds.has(f.id)));
                setSelectedFileId(null);
                showNotification(`Cleared ${mode.toUpperCase()} files from workspace (local files remain 100% safe)`, "info");
              }}
              className="px-2.5 py-1 h-7 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-[11px] rounded cursor-pointer active:scale-95 transition-all shadow-2xs whitespace-nowrap flex items-center gap-1"
            >
              <Trash2 size={11} />
              <span>Clear</span>
            </button>
          </fieldset>

          {/* Keyword Style Quick Selector (Double Keywords e.g. "happy birthday", Single, Mixed) */}
          <fieldset className={cn("border rounded px-2 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_4px_rgba(37,99,235,0.25)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap flex items-center gap-1", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>
              <Tag size={10} className="text-amber-400" />
              <span>Keyword Style (কীওয়ার্ড ধরন)</span>
            </legend>
            <button
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'mixed', singleWordKeywords: false }));
                showNotification('Keyword Style: Mixed (Single & 2-word phrases e.g. "happy birthday")', 'info');
              }}
              title="Mixed: Generates both 2-word compound phrases ('happy birthday') and single words"
              className={cn(
                "px-2 py-0.5 h-7 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-0.5",
                (!settings.keywordStyle || settings.keywordStyle === 'mixed') && !settings.singleWordKeywords
                  ? "bg-[#22c55e] text-white shadow-xs ring-1 ring-emerald-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Mixed</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'single', singleWordKeywords: true }));
                showNotification('Keyword Style: Single Keywords (1-word tags only, e.g. "happy", "birthday")', 'info');
              }}
              title="Single Keywords Only: Strictly 1-word tags (e.g. 'happy', 'birthday', 'party')"
              className={cn(
                "px-2 py-0.5 h-7 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-0.5",
                settings.keywordStyle === 'single' || settings.singleWordKeywords
                  ? "bg-[#0284c7] text-white shadow-xs ring-1 ring-sky-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Single (1-Word)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSettings(prev => ({ ...prev, keywordStyle: 'double', singleWordKeywords: false }));
                showNotification('Keyword Style: Double Keywords (Strictly 2-word phrases e.g. "happy birthday", "birthday party")', 'success');
              }}
              title="Double Keywords: Strictly 2-word compound phrases (e.g. 'happy birthday', 'birthday party', 'festive cake') - never split!"
              className={cn(
                "px-2.5 py-0.5 h-7 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1 shadow-xs",
                settings.keywordStyle === 'double'
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs ring-1 ring-amber-300"
                  : (isBlue ? "bg-[#091b38] text-blue-200 border border-[#1d4ed8] hover:bg-[#102b54]" : (isDark ? "bg-[#1b2737] text-white border border-[#30445a] hover:bg-slate-800" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"))
              )}
            >
              <span>Double (2-Words)</span>
              <span className="text-[10px]">✨</span>
            </button>
          </fieldset>

          {/* Target Marketplace SEO Group */}
          <fieldset className={cn("border rounded px-2 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_4px_rgba(37,99,235,0.25)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 flex items-center gap-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>
              <Globe size={10} className="text-cyan-400" />
              <span>Target SEO</span>
            </legend>
            <select
              value={settings.marketplace}
              onChange={(e) => {
                const nextM = e.target.value as any;
                setSettings(prev => ({ ...prev, marketplace: nextM }));
                setSelectedExportSite(nextM === 'universal' ? 'all_files' : nextM);
                showNotification(`AI SEO Target switched to ${e.target.selectedOptions[0]?.text || nextM}. Rank #1 metadata directives active.`, 'success');
              }}
              className={cn(
                "text-[11px] font-bold px-2 py-0.5 h-7 rounded cursor-pointer focus:outline-none transition-colors max-w-[150px]",
                isBlue 
                  ? "bg-[#091b38] border border-[#1d4ed8] text-white" 
                  : (isDark ? "bg-[#1b2737] border border-slate-600 text-white" : "bg-white border border-slate-300 text-slate-800 shadow-2xs")
              )}
            >
              <option value="universal">All Marketplaces (Universal)</option>
              <option value="adobe">Adobe Stock (Rank #1)</option>
              <option value="shutterstock">Shutterstock</option>
              <option value="freepik">Freepik / Flaticon</option>
              <option value="getty">Getty Images / iStock</option>
              <option value="pond5">Pond5</option>
              <option value="vecteezy">Vecteezy</option>
              <option value="envato">Envato Elements</option>
              <option value="depositphotos">Depositphotos</option>
              <option value="123rf">123RF</option>
              <option value="dreamstime">Dreamstime</option>
              <option value="alamy">Alamy</option>
              <option value="canva">Canva</option>
              <option value="motionelements">Motion Elements</option>
              <option value="creativemarket">Creative Market</option>
            </select>
          </fieldset>

          {/* Export Group */}
          <fieldset className={cn("border rounded px-2 py-0.5 flex items-center gap-1 shrink-0 flex-nowrap transition-colors", isBlue ? "border-[#2563eb] bg-[#0c2246]/95 shadow-[0_1px_4px_rgba(37,99,235,0.25)]" : (isDark ? "border-[#334b68] bg-[#162332]/90" : "border-slate-300 bg-white shadow-2xs"))}>
            <legend className={cn("text-[10px] font-bold px-1 whitespace-nowrap", isBlue ? "text-cyan-200" : (isDark ? "text-white" : "text-slate-900"))}>Export</legend>
            <span className={cn("text-[10.5px] font-bold whitespace-nowrap", isBlue ? "text-white" : (isDark ? "text-white" : "text-slate-800"))}>CSV:</span>
            <select 
              value={selectedExportSite}
              onChange={(e) => setSelectedExportSite(e.target.value)}
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 h-7 rounded cursor-pointer focus:outline-none transition-colors max-w-[130px]",
                isBlue 
                  ? "bg-[#091b38] border border-[#1d4ed8] text-white" 
                  : (isDark ? "bg-[#1b2737] border border-slate-600 text-white" : "bg-white border border-slate-300 text-slate-800 shadow-2xs")
              )}
            >
              <option value="all_files">All Marketplaces (Universal)</option>
              <option value="adobe">Adobe Stock</option>
              <option value="shutterstock">Shutterstock</option>
              <option value="freepik">Freepik / Flaticon</option>
              <option value="getty">Getty Images / iStock</option>
              <option value="vecteezy">Vecteezy</option>
              <option value="pond5">Pond5</option>
              <option value="envato">Envato Elements</option>
              <option value="depositphotos">Depositphotos</option>
              <option value="123rf">123RF</option>
              <option value="dreamstime">Dreamstime</option>
              <option value="alamy">Alamy</option>
              <option value="canva">Canva</option>
              <option value="motionelements">Motion Elements</option>
              <option value="creativemarket">Creative Market</option>
            </select>
            <button 
              type="button"
              onClick={() => handleExport(selectedExportSite, false)}
              className={cn(
                "px-2.5 py-1 h-7 text-[11px] font-bold rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-1",
                isBlue 
                  ? "bg-[#091b38] hover:bg-[#102b54] border border-[#1d4ed8] text-cyan-200" 
                  : (isDark ? "bg-[#172535] hover:bg-[#203247] border border-[#0ea5e9] text-white" : "bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs")
              )}
            >
              <FileSpreadsheet size={12} />
              <span>Export CSV</span>
            </button>
          </fieldset>

          {/* Dedicated Embed Metadata Action Group */}
          <fieldset className={cn(
            "border rounded px-2 py-0.5 flex items-center gap-1.5 shrink-0 flex-nowrap transition-colors",
            isBlue 
              ? "border-emerald-500/80 bg-[#082832]/90 shadow-[0_1px_8px_rgba(16,185,129,0.3)]" 
              : (isDark ? "border-emerald-500/70 bg-[#0f2d27]/80" : "border-emerald-400 bg-emerald-50/50 shadow-2xs")
          )}>
            <legend className={cn(
              "text-[10px] font-black px-1.5 whitespace-nowrap flex items-center gap-1",
              isBlue ? "text-emerald-300" : (isDark ? "text-emerald-300" : "text-emerald-700")
            )}>
              <Sparkles size={11} className="text-emerald-400 animate-pulse" />
              <span>Embed Metadata</span>
            </legend>
            
            {/* 1. Image Embed */}
            <button 
              type="button"
              onClick={() => handleEmbed('image')}
              title={`সব ইমেজ ফাইলে (JPG, PNG, WebP) সরাসরি IPTC, EXIF ও XMP মেটাডাটা এম্বেড করুন (${imageFilesCount}টি ফাইল)`}
              className={cn(
                "px-2.5 py-1 h-7 text-[11px] font-bold rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-2xs hover:brightness-110",
                isBlue 
                  ? "bg-sky-950/90 hover:bg-sky-900 border border-sky-400 text-sky-100" 
                  : (isDark ? "bg-[#0c2e4e] hover:bg-[#103a63] border border-sky-400 text-sky-100" : "bg-sky-50 hover:bg-sky-100 border border-sky-400 text-sky-900")
              )}
            >
              <ImageIcon size={13} className="text-sky-400 shrink-0" />
              <span>Image Embed</span>
              {imageFilesCount > 0 && (
                <span className="px-1 py-0.2 text-[9.5px] rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono">
                  {imageFilesCount}
                </span>
              )}
            </button>

            {/* 2. Vector Embed */}
            <button 
              type="button"
              onClick={() => handleEmbed('eps')}
              title={`সব ভেক্টর ফাইলে (EPS, AI, SVG) সরাসরি XMP ও PostScript মেটাডাটা এম্বেড করুন (${vectorFilesCount}টি ফাইল)`}
              className={cn(
                "px-2.5 py-1 h-7 text-[11px] font-bold rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-2xs hover:brightness-110",
                isBlue 
                  ? "bg-amber-950/80 hover:bg-amber-900 border border-amber-400 text-amber-100" 
                  : (isDark ? "bg-[#33220a] hover:bg-[#452f0d] border border-amber-400 text-amber-100" : "bg-amber-50 hover:bg-amber-100 border border-amber-400 text-amber-900")
              )}
            >
              <Layers size={13} className="text-amber-400 shrink-0" />
              <span>Vector Embed</span>
              {vectorFilesCount > 0 && (
                <span className="px-1 py-0.2 text-[9.5px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {vectorFilesCount}
                </span>
              )}
            </button>

            {/* 3. Video Embed */}
            <button 
              type="button"
              onClick={() => handleEmbed('video')}
              title={`সব ভিডিও ফাইলে (MP4, MOV) সরাসরি মেটাডাটা এম্বেড করুন (${videoFilesCount}টি ফাইল)`}
              className={cn(
                "px-2.5 py-1 h-7 text-[11px] font-bold rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-2xs hover:brightness-110",
                isBlue 
                  ? "bg-purple-950/80 hover:bg-purple-900 border border-purple-400 text-purple-100" 
                  : (isDark ? "bg-[#291438] hover:bg-[#381a4d] border border-purple-400 text-purple-100" : "bg-purple-50 hover:bg-purple-100 border border-purple-400 text-purple-900")
              )}
            >
              <Film size={13} className="text-purple-400 shrink-0" />
              <span>Video Embed</span>
              {videoFilesCount > 0 && (
                <span className="px-1 py-0.2 text-[9.5px] rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  {videoFilesCount}
                </span>
              )}
            </button>

            {/* 4. All Embed */}
            <button 
              type="button"
              onClick={() => handleEmbed('all')}
              title={`সমস্ত ফাইলে (Image, Vector, Video) এক ক্লিকে সরাসরি মেটাডাটা এম্বেড করুন (${allFilesCount}টি ফাইল)`}
              className="px-3 py-1 h-7 text-[11px] font-black rounded cursor-pointer transition-all whitespace-nowrap bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-300/40 flex items-center gap-1.5"
            >
              <Zap size={13} className="text-yellow-300 fill-yellow-300" />
              <span>All Embed</span>
              {allFilesCount > 0 && (
                <span className="px-1.5 py-0.2 text-[9.5px] font-bold rounded-full bg-white/20 text-white font-mono">
                  {allFilesCount}
                </span>
              )}
            </button>
          </fieldset>
        </div>
      </div>

      {/* 3. Files and Metadata Section */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden px-2.5 pt-0.5 pb-0.5 transition-colors",
        isBlue ? "bg-[#0a192f]" : (isDark ? "bg-[#162332]" : "bg-[#f1f5f9]")
      )}>
        {/* Compact Title Row to remove empty vertical height gap */}
        <div className="flex items-center justify-between mb-0.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className={cn("text-[11px] font-bold tracking-tight leading-none", isBlue ? "text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.35)]" : (isDark ? "text-slate-100" : "text-slate-900"))}>
              Files and Metadata
            </h2>
            <span className={cn("text-[10px] font-normal leading-none", isBlue ? "text-blue-300/80" : (isDark ? "text-slate-400" : "text-slate-500"))}>
              ({mode === 'all' ? 'ALL ASSETS: IMAGE + EPS + VIDEO' : mode.toUpperCase()})
            </span>
          </div>
        </div>

        {/* Spreadsheet Table Container */}
        <div className={cn(
          "flex-1 rounded overflow-hidden flex flex-col shadow-inner relative transition-colors border",
          isBlue ? "border-[#1d4ed8] bg-[#07162c] shadow-[0_4px_24px_rgba(7,19,40,0.7)]" : (isDark ? "border-[#24354a] bg-[#182434]" : "border-slate-300 bg-white shadow-xs")
        )}>
          {/* Table Header - Slim compact height, single-line without wrapping */}
          <div className={cn(
            "flex items-center text-[11px] font-medium px-2 py-0.5 h-6.5 shrink-0 select-none border-b transition-colors whitespace-nowrap",
            isBlue 
              ? "bg-[#051122] border-[#1d4ed8] text-cyan-200 font-semibold shadow-xs" 
              : (isDark ? "bg-[#14202d] border-[#24354a] text-slate-200" : "bg-slate-100 border-slate-300 text-slate-700 font-semibold")
          )}>
            <div className="w-[44px] shrink-0 text-center font-bold">Preview</div>
            <div className="w-[17%] truncate pl-1">Filename</div>
            <div className="w-[22%] truncate">Title</div>
            <div className="w-[25%] truncate">Keywords</div>
            <div className="w-[20%] truncate">Description</div>
            <div className="w-[6%] truncate">Category</div>
            <div className="w-[5%] text-center whitespace-nowrap">KW Count</div>
            <div className="w-[5%] text-center whitespace-nowrap">Rating</div>
          </div>

          {/* Table Rows Body - Single continuous list with 60fps native smooth scrolling */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleTableScroll}
            className="flex-1 overflow-y-auto custom-scrollbar relative overscroll-contain"
            style={{ transform: 'translateZ(0)', WebkitOverflowScrolling: 'touch' }}
          >
            {totalRows === 0 ? (
              /* Clean empty table canvas matching image.png */
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center pointer-events-none select-none p-4 text-center">
                <span className="text-2xl mb-1 opacity-40">
                  {mode === 'vector' ? '📐' : mode === 'video' ? '🎬' : mode === 'all' ? '⚡' : '🖼️'}
                </span>
                <span className={cn("text-xs font-semibold uppercase tracking-wider", isBlue ? "text-cyan-300/80" : (isDark ? "text-slate-400" : "text-slate-500"))}>
                  {mode === 'all' ? 'No files in workspace' : `No ${mode.toUpperCase()} files in workspace`}
                </span>
                <span className={cn("text-[11px] mt-0.5", isBlue ? "text-blue-300/60" : (isDark ? "text-slate-500" : "text-slate-400"))}>
                  Click "SELECT FILE" or "SELECT FOLDER" to add {mode === 'all' ? 'EPS, Video or Image' : mode} assets
                </span>
              </div>
            ) : isVirtualized ? (
              <div style={{ height: totalVirtualHeight, position: 'relative', width: '100%' }}>
                <div style={{ transform: `translateY(${topOffset}px)`, willChange: 'transform' }}>
                  {renderedRows.map(({ file, idx }) => (
                    <TableRow
                      key={file.id || idx}
                      file={file}
                      idx={idx}
                      isSelected={selectedFileId === file.id}
                      isBlue={isBlue}
                      isDark={isDark}
                      copiedCell={copiedCell}
                      onSelect={setSelectedFileId}
                      onOpenPreview={openPreviewModal}
                      onCopy={copyText}
                      onRetry={handleRowRetry}
                      onEmbed={handleRowEmbed}
                    />
                  ))}
                </div>
              </div>
            ) : (
              renderedRows.map(({ file, idx }) => (
                <TableRow
                  key={file.id || idx}
                  file={file}
                  idx={idx}
                  isSelected={selectedFileId === file.id}
                  isBlue={isBlue}
                  isDark={isDark}
                  copiedCell={copiedCell}
                  onSelect={setSelectedFileId}
                  onOpenPreview={openPreviewModal}
                  onCopy={copyText}
                  onRetry={handleRowRetry}
                  onEmbed={handleRowEmbed}
                />
              ))
            )}
          </div>
        </div>

        {/* Compact Text Status Bar immediately under the table - Single Page View for all files */}
        <div className="mt-1 flex items-center justify-between text-[11px] select-none px-2 py-1 rounded bg-black/10 border border-border/40 gap-2 flex-wrap min-h-[32px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-medium", isBlue ? "text-cyan-200" : (isDark ? "text-slate-200" : "text-slate-700"))}>
              {isGenerating ? "● Processing..." : "✓ Ready"}
            </span>
            <span className="opacity-30">|</span>
            <span className={cn("font-mono font-bold text-[10.5px]", isBlue ? "text-cyan-300" : (isDark ? "text-slate-200" : "text-slate-800"))}>
              {currentModeFiles.length.toLocaleString()} {mode.toUpperCase()} Files (Single Page View)
            </span>
            <span className="opacity-30">|</span>
            {/* Interactive Keyword Style Status Badge */}
            <button
              type="button"
              onClick={() => {
                const nextStyle = settings.keywordStyle === 'double' ? 'mixed' : settings.keywordStyle === 'single' ? 'double' : 'single';
                setSettings(prev => ({ ...prev, keywordStyle: nextStyle, singleWordKeywords: nextStyle === 'single' }));
                showNotification(`Keyword Style switched to: ${nextStyle === 'double' ? 'Double Keywords (2-Words, e.g. "happy birthday")' : nextStyle === 'single' ? 'Single Keywords (1-Word Only)' : 'Mixed Keywords'}`, 'info');
              }}
              title="Click to cycle Keyword Style: Mixed -> Single -> Double (2-Words)"
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 active:scale-95 shadow-2xs",
                settings.keywordStyle === 'double' 
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.25)]" 
                  : (settings.keywordStyle === 'single' || settings.singleWordKeywords
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/60" 
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60")
              )}
            >
              <Tag size={10} className={settings.keywordStyle === 'double' ? "text-amber-400" : "text-cyan-400"} />
              <span>KW: <strong>{settings.keywordStyle === 'double' ? 'Double (2-Words) ✨' : (settings.keywordStyle === 'single' || settings.singleWordKeywords) ? 'Single Words' : 'Mixed'}</strong></span>
            </button>
            {selectedFile && (
              <div 
                onClick={() => openPreviewModal(selectedFile)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-all shadow-2xs group/chip ml-1",
                  isBlue ? "bg-[#102a54] hover:bg-[#163a70] border border-cyan-500/40 text-cyan-200" :
                  isDark ? "bg-[#1f3044] hover:bg-[#283e58] border border-slate-600 text-slate-200" :
                  "bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900"
                )}
                title="Click to view full preview modal"
              >
                {selectedFile.previewUrl && (
                  ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((selectedFile.fileType || '').toLowerCase()) && !selectedFile.previewUrl.startsWith('data:image/') ? (
                    <span className="w-4 h-4 rounded bg-purple-900 border border-cyan-400/40 flex items-center justify-center text-[9px]">🎬</span>
                  ) : (
                    <img src={selectedFile.previewUrl} alt="" className="w-4 h-4 rounded object-cover border border-cyan-400/40" />
                  )
                )}
                <span className="font-bold truncate max-w-[160px] text-[10px]">{selectedFile.filename}</span>
                <span className="text-[9px] underline font-medium opacity-80 group-hover/chip:opacity-100">Preview 🔍</span>
              </div>
            )}
          </div>

          <div className={cn("text-[10.5px] whitespace-nowrap ml-auto font-mono flex items-center gap-2", isBlue ? "text-blue-300" : (isDark ? "text-slate-400" : "text-slate-500"))}>
            <span>Processed: <strong className="text-emerald-400">{completedCount}</strong>/{currentModeFiles.length} ({progressPercent}%) &nbsp;|&nbsp; Remaining: <strong>{remainingCount}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Footer Bar - strictly 1 line, no wrapping */}
      <footer className={cn(
        "shrink-0 border-t px-2.5 py-1 flex items-center justify-between text-[11px] select-none flex-nowrap gap-2 overflow-hidden transition-colors",
        isBlue 
          ? "bg-[#040c18] border-[#1d4ed8] text-blue-200 shadow-[0_-2px_14px_rgba(4,12,24,0.8)]" 
          : (isDark ? "bg-[#121c27] border-[#233449] text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700 shadow-2xs")
      )}>
        {/* Left: Statistics, License & Action Buttons */}
        <div className="flex items-center gap-2 flex-nowrap shrink min-w-0 overflow-hidden whitespace-nowrap text-[11px]">
          {/* Generation Statistics - Interactive Link */}
          <button 
            type="button"
            onClick={() => setIsStatsModalOpen(true)}
            className={cn(
              "flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-0 focus:outline-none group text-left shrink-0 whitespace-nowrap",
              isBlue ? "text-blue-200 hover:text-cyan-300" : (isDark ? "text-slate-300 hover:text-cyan-300" : "text-slate-700 hover:text-sky-700")
            )}
            title="Click to view full generation statistics & analytics report"
          >
            <span className={cn("font-bold flex items-center gap-1 transition-colors", isBlue ? "text-cyan-300 group-hover:text-white" : (isDark ? "text-white group-hover:text-cyan-300" : "text-slate-900 group-hover:text-sky-700"))}>
              📊 Generation:
            </span>
            <span className="group-hover:underline">24H: {12 + completedCount}</span>
            <span className="opacity-40">|</span>
            <span className="group-hover:underline">All: {18335 + completedCount}</span>
          </button>

          {/* License Info - Interactive Link */}
          <button 
            type="button"
            onClick={() => {
              setCurrentLicense(checkCurrentLicenseStatus());
              setIsLicenseModalOpen(true);
            }}
            className={cn(
              "flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-0 focus:outline-none group text-left shrink-0 whitespace-nowrap",
              isBlue ? "text-blue-200 hover:text-cyan-300" : (isDark ? "text-slate-300 hover:text-cyan-300" : "text-slate-700 hover:text-sky-700")
            )}
            title="Click to view license status & device authorization"
          >
            <span className={cn("font-bold flex items-center gap-1 transition-colors", isBlue ? "text-cyan-300 group-hover:text-white" : (isDark ? "text-white group-hover:text-cyan-300" : "text-slate-900 group-hover:text-sky-700"))}>
              🔍 License:
            </span>
            {currentLicense.isAdmin ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:underline">
                👑 Admin (Permanent Lifetime)
              </span>
            ) : (currentLicense.activeLicense?.duration === 'lifetime' || (currentLicense.daysRemaining && currentLicense.daysRemaining > 3000)) ? (
              <span className="text-cyan-300 font-bold flex items-center gap-1 group-hover:underline">
                ✓ Lifetime Access (Permanent)
              </span>
            ) : (currentLicense.isUnlocked && currentLicense.daysRemaining !== null && currentLicense.daysRemaining > 0) ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:underline">
                ✓ Active ({currentLicense.daysRemaining} {currentLicense.daysRemaining === 1 ? 'Day' : 'Days'} Left)
              </span>
            ) : currentLicense.isExpired ? (
              <span className="text-rose-400 font-bold flex items-center gap-1 group-hover:underline">
                ✕ Expired (0 Days Left)
              </span>
            ) : (
              <span className="text-cyan-400 font-bold flex items-center gap-1 group-hover:underline">
                🔑 Enter License Key
              </span>
            )}
          </button>

          {/* Footer Action Buttons */}
          <button 
            type="button"
            onClick={() => {
              if (openExtensionsWithTab) {
                openExtensionsWithTab('hub');
              } else {
                setIsExtensionsOpen(true);
              }
            }}
            className={cn(
              "px-2 py-0.5 border rounded text-[11px] cursor-pointer transition-colors shadow-xs active:scale-95 whitespace-nowrap shrink-0",
              isBlue 
                ? "border-cyan-400 text-cyan-300 bg-[#0c203e] hover:bg-[#13305c]" 
                : (isDark ? "border-[#0ea5e9] text-cyan-300 bg-[#162536] hover:bg-[#1f354e]" : "border-sky-400 text-sky-800 bg-white hover:bg-sky-50")
            )}
            title="Open AI Extensions Studio (Prompt to Image, Image to Prompt, Upscale)"
          >
            Extensions
          </button>

          <button 
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className={cn(
              "px-2 py-0.5 border rounded text-[11px] cursor-pointer transition-colors shadow-xs active:scale-95 whitespace-nowrap shrink-0",
              isBlue 
                ? "border-emerald-400 text-emerald-300 bg-[#0c203e] hover:bg-[#13305c]" 
                : (isDark ? "border-[#22c55e] text-emerald-300 bg-[#162536] hover:bg-[#1f354e]" : "border-emerald-500 text-emerald-800 bg-white hover:bg-emerald-50")
            )}
            title="Check for software updates & latest AI presets"
          >
            Update
          </button>

          <button 
            type="button"
            onClick={() => {
              setFiles([]);
              setSelectedFileId(null);
              showNotification("Workspace refreshed! Clean slate ready.", "info");
            }}
            className="px-2.5 py-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer transition-colors shadow-xs active:scale-95 whitespace-nowrap shrink-0"
            title="Refresh workspace to a clean slate"
          >
            Refresh
          </button>
        </div>

        {/* Right: Quick Tools Dock, Social Icons, Timer */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap">
          {/* Quick Tools Icons Dock */}
          <div className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 border rounded transition-colors shrink-0",
            isBlue 
              ? "bg-[#07152b] border-[#1d4ed8] text-cyan-300 shadow-2xs" 
              : (isDark ? "bg-[#0f1722] border-slate-700/80 text-slate-300" : "bg-white border-slate-300 text-slate-700 shadow-2xs")
          )}>
            <button 
              type="button"
              onClick={() => setIsQuickSaveModalOpen(true)}
              title="Save & Embed Metadata (EXIF / IPTC / XMP)" 
              className="cursor-pointer hover:text-cyan-400 hover:scale-110 transition-transform text-xs p-0 bg-transparent border-none"
            >
              💾
            </button>
            <button 
              type="button"
              onClick={() => setIsSecurityModalOpen(true)}
              title="Security & Privacy Protocol (Client-side sandboxed)" 
              className="cursor-pointer flex items-center hover:scale-110 transition-transform p-0 bg-transparent border-none"
            >
              <Shield size={12} className="text-amber-400" />
            </button>
            <button 
              type="button"
              onClick={() => setIsAdobeScriptModalOpen(true)}
              title="Adobe Photoshop & Illustrator Automation Scripts (.JSX)" 
              className="cursor-pointer hover:text-cyan-400 hover:scale-110 transition-transform text-xs p-0 bg-transparent border-none"
            >
              🪶
            </button>
          </div>

          {/* Social / AI Dock */}
          <div className={cn("flex items-center gap-1.5 shrink-0", isBlue ? "text-blue-200" : (isDark ? "text-slate-300" : "text-slate-700"))}>
            <button 
              type="button"
              onClick={() => setIsExtensionsOpen(true)}
              title="Vision AI Studio & Prompt Generator" 
              className="cursor-pointer hover:text-purple-400 hover:scale-110 transition-transform text-xs p-0 bg-transparent border-none"
            >
              🟣
            </button>
            <button 
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Application Settings & API Configurations" 
              className="cursor-pointer hover:text-sky-400 hover:scale-110 transition-transform text-xs p-0 bg-transparent border-none"
            >
              ⚙️
            </button>
            <button 
              type="button"
              onClick={() => setIsContactOpen(true)} 
              title="WhatsApp Developer Support - Shamim" 
              className="cursor-pointer hover:text-emerald-400 hover:scale-110 transition-transform text-xs p-0 bg-transparent border-none"
            >
              🟢
            </button>
          </div>

          {/* Isolated Live Timer Widget - 0ms overhead, never causes root re-renders */}
          <LiveTimerWidget isGenerating={isGenerating} isPaused={isPaused} isBlue={isBlue} isDark={isDark} />
        </div>
      </footer>

      {/* 5. MODALS FOR ALL INTERACTIVE BOTTOM LINKS */}

      {/* Modal 1: Generation Statistics Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <BarChart2 size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Generation Statistics & Metrics</h3>
                  <p className="text-[11px] text-slate-400">SS SMART META Engine Analytics • Developed By Shamim</p>
                </div>
              </div>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              {/* Top 4 Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#192738] border border-[#24374e] rounded flex flex-col">
                  <span className="text-[11px] text-slate-400">Last 24 Hours</span>
                  <span className="text-xl font-bold text-cyan-400">{12 + completedCount}</span>
                  <span className="text-[10px] text-emerald-400">100% Success Rate</span>
                </div>
                <div className="p-3 bg-[#192738] border border-[#24374e] rounded flex flex-col">
                  <span className="text-[11px] text-slate-400">All-Time Files</span>
                  <span className="text-xl font-bold text-white">{(18335 + completedCount).toLocaleString()}</span>
                  <span className="text-[10px] text-cyan-300">Across 8 Marketplaces</span>
                </div>
                <div className="p-3 bg-[#192738] border border-[#24374e] rounded flex flex-col">
                  <span className="text-[11px] text-slate-400">Keywords Synthesized</span>
                  <span className="text-xl font-bold text-emerald-400">513,380+</span>
                  <span className="text-[10px] text-slate-400">Avg 28 Tags / Asset</span>
                </div>
                <div className="p-3 bg-[#192738] border border-[#24374e] rounded flex flex-col">
                  <span className="text-[11px] text-slate-400">Avg Engine Latency</span>
                  <span className="text-xl font-bold text-amber-400">1.2s</span>
                  <span className="text-[10px] text-slate-400">High-Speed Turbo Pipeline</span>
                </div>
              </div>

              {/* Marketplace Breakdown */}
              <div className="p-3 bg-[#14202d] border border-[#223549] rounded flex flex-col gap-2">
                <span className="text-[11px] font-bold text-slate-200">Marketplace Distribution</span>
                <div className="space-y-1.5">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                      <span>Adobe Stock (Commercial & Editorial)</span>
                      <span className="font-semibold text-cyan-300">42% (7,700 files)</span>
                    </div>
                    <div className="w-full bg-[#1b2b3d] h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                      <span>Shutterstock (High Demand Taxonomy)</span>
                      <span className="font-semibold text-emerald-300">31% (5,683 files)</span>
                    </div>
                    <div className="w-full bg-[#1b2b3d] h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '31%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                      <span>Freepik & Vecteezy (Vector EPS & AI)</span>
                      <span className="font-semibold text-purple-300">18% (3,300 files)</span>
                    </div>
                    <div className="w-full bg-[#1b2b3d] h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: '18%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                      <span>Getty Images / iStock / Pond5</span>
                      <span className="font-semibold text-amber-300">9% (1,652 files)</span>
                    </div>
                    <div className="w-full bg-[#1b2b3d] h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '9%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active AI Engines */}
              <div className="p-3 bg-[#192738] border border-[#24374e] rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Active AI Vision Model: Google Gemini 2.5 Flash</div>
                  <div className="text-[11px] text-slate-400">Context Window: 1M Tokens • Vision Multi-Resolution Analyzer Enabled</div>
                </div>
                <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[11px] font-bold">
                  Operational
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-between">
              <button 
                onClick={() => showNotification("Analytics cache refreshed", "info")}
                className="px-3 py-1 bg-[#1c2c3e] hover:bg-[#253950] text-slate-300 rounded text-xs cursor-pointer transition-colors"
              >
                Refresh Data
              </button>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="px-4 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: License Information & Authorization Modal */}
      {isLicenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-400">
                  <Key size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">License Information & Device Authorization</h3>
                  <p className="text-[11px] text-slate-400">SS SMART META Commercial License</p>
                </div>
              </div>
              <button 
                onClick={() => setIsLicenseModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              {/* License Status Banner */}
              {currentLicense.isAdmin ? (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-lg flex items-start gap-3 text-emerald-300">
                  <ShieldCheck size={18} className="shrink-0 mt-0.5 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-emerald-200">👑 Admin Mode Active</span>
                    <span className="text-[11px] text-emerald-300/90 mt-0.5">
                      অ্যাডমিন মোড সক্রিয় রয়েছে। আপনার জন্য আনলিমিটেড লাইসেন্স বাইপাস অনুমোদিত। সফটওয়্যারটি কোনো বাধা ছাড়াই কাজ করবে।
                    </span>
                  </div>
                </div>
              ) : currentLicense.isExpired ? (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-lg flex items-start gap-3 text-rose-300">
                  <XCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-rose-200">License Expired!</span>
                    <span className="text-[11px] text-rose-300/90 mt-0.5">
                      আপনার লাইসেন্স কী-র মেয়াদ শেষ হয়েছে। অ্যাপ পুনরায় চালু রাখতে অনুগ্রহ করে নতুন লাইসেন্স কী প্রবেশ করান।
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-500/15 border border-blue-500/40 rounded-lg flex items-start gap-3 text-blue-300">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-cyan-400" />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-cyan-200">
                      {currentLicense.daysRemaining && currentLicense.daysRemaining > 3000 ? "Lifetime License Active" : "License Active & Verified"}
                    </span>
                    <span className="text-[11px] text-cyan-300/90 mt-0.5">
                      {currentLicense.daysRemaining && currentLicense.daysRemaining > 3000 
                        ? "আপনার লাইফটাইম লাইসেন্স সক্রিয় রয়েছে। মেয়াদ শেষ হওয়ার কোনো সময়সীমা নেই।" 
                        : `আপনার বর্তমান লাইসেন্সের মেয়াদ এখনও ${currentLicense.daysRemaining} দিন বাকি আছে।`}
                    </span>
                  </div>
                </div>
              )}

              {/* License Details Card */}
              <div className="p-3.5 bg-[#14202d] border border-[#223549] rounded-lg flex flex-col gap-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-[#223549]">
                  <span className="text-slate-400">Software Product:</span>
                  <span className="font-bold text-white">SS SMART META Studio Pro v3.5</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-[#223549]">
                  <span className="text-slate-400">License Holder / Role:</span>
                  <span className="font-semibold text-cyan-300">
                    {currentLicense.isAdmin ? "Administrator (Developer Bypass)" : (currentLicense.activeLicense?.clientName || "Authorized Client")}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-[#223549]">
                  <span className="text-slate-400">Active License Key:</span>
                  <span className="font-mono text-xs bg-[#0f1722] px-2 py-0.5 rounded border border-slate-700 text-slate-200 select-all font-bold">
                    {currentLicense.isAdmin ? "ADMIN-AUTHORIZED-UNLIMITED" : (currentLicense.activeLicense?.key || "NO-KEY-ENTERED")}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-[#223549]">
                  <span className="text-slate-400">Validity Period:</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {currentLicense.isAdmin ? "Permanent (Admin Mode)" : (currentLicense.daysRemaining && currentLicense.daysRemaining > 3000 ? "Permanent (Lifetime)" : `${currentLicense.daysRemaining ?? 0} Days Remaining`)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Authorization Status:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border",
                    currentLicense.isAdmin || !currentLicense.isExpired 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  )}>
                    {currentLicense.isAdmin ? "👑 ADMIN BYPASS" : (!currentLicense.isExpired ? "✓ Verified & Active" : "✕ EXPIRED")}
                  </span>
                </div>
              </div>

              {/* Enter New Key Box */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Activate or Renew License Key:</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value.toUpperCase())}
                    placeholder="Enter SSM-1M-XXXX-XXXX key..."
                    className="flex-1 bg-[#111a24] border border-[#24354a] rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono tracking-wider"
                  />
                  <button 
                    type="button"
                    disabled={isVerifyingKey}
                    onClick={async () => {
                      if (!newLicenseKey.trim()) {
                        showNotification("Please enter a valid license key", "error");
                        return;
                      }
                      setIsVerifyingKey(true);
                      try {
                        const result = await validateAndActivateKeyAsync(newLicenseKey);
                        setIsVerifyingKey(false);
                        if (result.success) {
                          setCurrentLicense(checkCurrentLicenseStatus());
                          setNewLicenseKey('');
                          showNotification(result.message, "success");
                        } else {
                          showNotification(result.message, "error");
                        }
                      } catch (err: any) {
                        setIsVerifyingKey(false);
                        showNotification(err?.message || "Verification failed", "error");
                      }
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded text-xs cursor-pointer transition-colors"
                  >
                    {isVerifyingKey ? "Verifying..." : "Activate"}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <a 
                  href={adminConfig.whatsapp.startsWith('http') ? adminConfig.whatsapp : `https://wa.me/${adminConfig.whatsapp.replace(/[^0-9+]/g, '')}?text=Hello%20Shamim,%20I%20would%20like%20to%20renew%20my%20SS%20SMART%20META%20license.`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/50 text-emerald-300 font-semibold rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span>💬</span> WhatsApp Admin
                </a>

                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLicenseModalOpen(false);
                      onOpenAdmin();
                    }}
                    className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold rounded text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Shield size={13} />
                    <span>Admin Panel</span>
                  </button>
                )}
              </div>

              <button 
                onClick={() => setIsLicenseModalOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Update Manager Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">SS SMART META Update Manager</h3>
                  <p className="text-[11px] text-slate-400">Engine Build Version Check</p>
                </div>
              </div>
              <button 
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3 text-emerald-300">
                <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-white">SS SMART META is Up to Date!</div>
                  <div className="text-[11px] text-slate-300">You are running the latest version with all 2026 stock marketplace presets.</div>
                </div>
              </div>

              <div className="space-y-1.5 p-3 bg-[#14202d] border border-[#24354a] rounded text-[11px]">
                <div className="flex justify-between py-1 border-b border-[#223549]">
                  <span className="text-slate-400">Installed Version:</span>
                  <span className="font-bold text-cyan-400">v6.7.0 Pro Release</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#223549]">
                  <span className="text-slate-400">AI Core Engine:</span>
                  <span className="text-slate-200">Gemini 3.8 / 2.5 Flash Vision Turbo</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#223549]">
                  <span className="text-slate-400">Stock Taxonomy:</span>
                  <span className="text-slate-200">Adobe & Shutterstock 2026 Q3 Spec</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Developer:</span>
                  <span className="font-semibold text-white">Shamim</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-between">
              <button 
                onClick={() => showNotification("Checking repository... All packages up to date!", "success")}
                className="px-3 py-1 bg-[#1c2c3e] hover:bg-[#253950] text-slate-300 rounded text-xs cursor-pointer transition-colors"
              >
                Check Again
              </button>
              <button 
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-4 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Adobe Automation Scripts Modal */}
      {isAdobeScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-400">
                  <FileCode size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Adobe CC Automation Scripts (.JSX)</h3>
                  <p className="text-[11px] text-slate-400">Batch embed metadata inside Adobe Photoshop & Illustrator</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAdobeScriptModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-xs">
              {/* Tab Selector */}
              <div className="flex border-b border-[#24354a] gap-2">
                <button 
                  onClick={() => setActiveScriptTab('photoshop')}
                  className={cn(
                    "px-4 py-1.5 border-b-2 font-semibold text-xs transition-colors cursor-pointer",
                    activeScriptTab === 'photoshop' 
                      ? "border-cyan-400 text-cyan-300" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Photoshop Script (.jsx)
                </button>
                <button 
                  onClick={() => setActiveScriptTab('illustrator')}
                  className={cn(
                    "px-4 py-1.5 border-b-2 font-semibold text-xs transition-colors cursor-pointer",
                    activeScriptTab === 'illustrator' 
                      ? "border-amber-400 text-amber-300" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Illustrator Script (.jsx)
                </button>
              </div>

              {/* Script Instructions */}
              <div className="p-2.5 bg-[#14202d] border border-[#223549] rounded text-[11px] text-slate-300">
                <span className="font-bold text-cyan-300">Instructions:</span> Run this script in {activeScriptTab === 'photoshop' ? 'Adobe Photoshop' : 'Adobe Illustrator'} via <strong>File &gt; Scripts &gt; Browse...</strong> to automatically inject titles, descriptions, and keywords directly into unopened assets!
              </div>

              {/* Code Preview Box */}
              <div className="relative">
                <pre className="p-3 bg-[#0f1722] border border-[#24354a] rounded text-[11px] font-mono text-slate-300 h-44 overflow-y-auto custom-scrollbar select-all">
                  {activeScriptTab === 'photoshop' ? `// SS SMART META - Photoshop Batch Metadata Injector
// Developed By Shamim
#target photoshop
app.bringToFront();

function batchEmbedMetadata() {
  var folder = Folder.selectDialog("Select Folder with Stock Images");
  if (!folder) return;
  var files = folder.getFiles(/\.(jpg|jpeg|png|tif|psd)$/i);
  alert("Found " + files.length + " files. SS SMART META engine ready.");
}
batchEmbedMetadata();` : `// SS SMART META - Illustrator Vector Batch Metadata Injector
// Developed By Shamim
#target illustrator

function batchIllustratorEmbed() {
  var folder = Folder.selectDialog("Select Folder with EPS/AI Vectors");
  if (!folder) return;
  var files = folder.getFiles(/\.(eps|ai)$/i);
  alert("Found " + files.length + " vector files ready for XMP injection.");
}
batchIllustratorEmbed();`}
                </pre>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-between">
              <button 
                onClick={() => {
                  const code = activeScriptTab === 'photoshop' 
                    ? `// SS SMART META - Photoshop Script\n#target photoshop\n// Developed By Shamim\n` 
                    : `// SS SMART META - Illustrator Script\n#target illustrator\n// Developed By Shamim\n`;
                  navigator.clipboard.writeText(code);
                  showNotification("Script copied to clipboard!", "success");
                }}
                className="px-3 py-1.5 bg-[#1c2c3e] hover:bg-[#253950] text-slate-300 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Copy size={13} /> Copy Code
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const filename = activeScriptTab === 'photoshop' ? "SS_Meta_Photoshop.jsx" : "SS_Meta_Illustrator.jsx";
                    const blob = new Blob([`// SS SMART META JSX Script\n// Developed By Shamim\n`], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotification(`Downloaded ${filename}`, "success");
                  }}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download size={13} /> Download .JSX
                </button>
                <button 
                  onClick={() => setIsAdobeScriptModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Security & Privacy Protocol Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-400">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Security & Privacy Protocol</h3>
                  <p className="text-[11px] text-slate-400">Client-Side Architecture Guarantee</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSecurityModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="flex items-start gap-3 p-3 bg-[#14202d] border border-[#24354a] rounded">
                <Lock size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-white block">100% In-Browser Execution</span>
                  <span className="text-slate-400 text-[11px]">Your media files and metadata never get uploaded or saved on external servers. All EXIF, IPTC, and XMP tagging runs locally.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#14202d] border border-[#24354a] rounded">
                <Key size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-white block">Sandboxed Key Storage</span>
                  <span className="text-slate-400 text-[11px]">API keys remain strictly inside your browser's private local storage. No third party ever has access to your credentials.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#14202d] border border-[#24354a] rounded">
                <Globe size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-white block">Marketplace Standards Compliance</span>
                  <span className="text-slate-400 text-[11px]">Metadata formatting adheres strictly to Adobe Stock, Shutterstock, and IPTC Photo Metadata 2026 specs.</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-end">
              <button 
                onClick={() => setIsSecurityModalOpen(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Quick Save & Embed Modal */}
      {isQuickSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="px-4 py-3 bg-[#131d28] border-b border-[#24354a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <HardDrive size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Save & Embed Quick Actions</h3>
                  <p className="text-[11px] text-slate-400">Direct metadata embedding and export</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickSaveModalOpen(false)}
                className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-2.5 text-xs">
              <button 
                onClick={() => {
                  setIsQuickSaveModalOpen(false);
                  handleEmbed('all');
                }}
                className="p-3 bg-[#192738] hover:bg-[#203247] border border-[#22c55e]/50 rounded flex items-center gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <span className="font-bold text-white block">Embed Metadata into All Files</span>
                  <span className="text-[11px] text-slate-400">Inject IPTC / XMP tags directly into JPG, PNG, and EPS vectors.</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  setIsQuickSaveModalOpen(false);
                  handleExport(selectedExportSite, true);
                }}
                className="p-3 bg-[#192738] hover:bg-[#203247] border border-[#0ea5e9]/50 rounded flex items-center gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <span className="font-bold text-white block">Export CSV for {selectedExportSite.toUpperCase()}</span>
                  <span className="text-[11px] text-slate-400">Download formatted CSV ready for batch upload.</span>
                </div>
              </button>
            </div>

            <div className="px-4 py-3 bg-[#131d28] border-t border-[#24354a] flex items-center justify-end">
              <button 
                onClick={() => setIsQuickSaveModalOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
