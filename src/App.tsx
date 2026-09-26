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
  Maximize2,
  Globe,
  Cpu,
  SlidersHorizontal,
  Bookmark,
  Minus,
  Undo2,
  Redo2,
  Shield,
  ChevronDown,
  ChevronUp
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
import { StockMetadata, ApiConfig, GeneratorSettings, ApiStatus, HistoryItem, StockMarketplace } from './types';
import { generateMetadata, testApiConnection, extractEpsThumbnail, extractVideoThumbnail, applyTitleAndKeywordsAffixes, buildLocalSmartMetadata } from './services/aiService';
import { AssetInspector } from './components/AssetInspector';
import { ExtensionsModal } from './components/ExtensionsModal';
import { MetaMasterView } from './components/MetaMasterView';
import { ContactModal } from './components/ContactModal';
import { ManageKeysModal } from './components/ManageKeysModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { checkCurrentLicenseStatus, LicenseStatusResult } from './services/licenseService';
import { cn, sanitizeFilenameForFs, sanitizeStockFilename } from './lib/utils';

const STORAGE_KEY = 'ai-metadata-pro-config';
const HISTORY_KEY = 'ai-metadata-pro-history';

export interface BulkUndoSnapshot {
  id: string;
  actionName: string;
  timestamp: number;
  files: StockMetadata[];
  fileObjects?: Record<string, File>;
}

export const DEFAULT_DEMO_FILES: StockMetadata[] = [
  {
    id: 'demo-1',
    filename: 'Breakfast_burrito_on_plate_4K_20260922234046.jpeg',
    originalFilename: 'Breakfast_burrito_on_plate_4K_20260922234046.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80',
    title: 'Breakfast burrito with scrambled eggs, bacon, and peppers o',
    keywords: 'breakfast, burrito, tortilla, scrambled eggs, bacon, red peppe',
    description: 'A warm breakfast burrito filled with scrambled eggs, melted',
    category: 'Food and drink',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-2',
    filename: 'Change_sticky_note_color_4K_20260922233843.jpeg',
    originalFilename: 'Change_sticky_note_color_4K_20260922233843.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80',
    title: 'Bright yellow square sticky note taped to a light brown wooc',
    keywords: 'sticky note, post-it, yellow paper, square, adhesive tape, mas',
    description: 'A bright yellow square sticky note is attached to a light brow',
    category: 'Objects, Backgrounds/Textures',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-3',
    filename: 'Glowing_sphere_on_reflective_sur...4K_2026092223',
    originalFilename: 'Glowing_sphere_on_reflective_sur...4K_2026092223.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    title: 'Glowing futuristic sphere on dark reflective surface neon tech concept',
    keywords: 'glowing, sphere, futuristic, technology, cyber, neon, light, abstract, reflection',
    description: 'A stunning glowing futuristic sphere reflecting on a dark glossy surface with digital cyber aesthetic.',
    category: 'Technology',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-4',
    filename: 'Harvested_wheat_field_landscape_4K_20260922232',
    originalFilename: 'Harvested_wheat_field_landscape_4K_20260922232.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
    title: 'Golden sunset over scenic rural farmland and agriculture landscape',
    keywords: 'landscape, agriculture, wheat field, sunset, scenic, country, farm, nature, harvest',
    description: 'Breathtaking panoramic view of rural wheat fields illuminated by warm golden hour sunlight.',
    category: 'Nature',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-5',
    filename: 'Jalebi_arranged_on_ceramic_plate_4K_20260922232',
    originalFilename: 'Jalebi_arranged_on_ceramic_plate_4K_20260922232.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    title: 'Crispy sweet golden jalebi Indian traditional festival dessert',
    keywords: 'jalebi, sweet, dessert, indian food, festival, crispy, culinary, syrup, traditional',
    description: 'Delicious spiral jalebi sweets drenched in fragrant saffron sugar syrup served on plate.',
    category: 'Food and drink',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-6',
    filename: 'Medic_touching_leg_with_veins_4K_2026092223443',
    originalFilename: 'Medic_touching_leg_with_veins_4K_2026092223443.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80',
    title: 'Professional healthcare specialist examining patient during clinical checkup',
    keywords: 'medical, doctor, patient, clinical, healthcare, exam, therapy, treatment, hospital',
    description: 'Doctor conducting thorough physical medical examination in modern clean hospital room.',
    category: 'Healthcare/Medical',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-7',
    filename: 'Modeling_clay_sticks_arranged_co...4K_202609222',
    originalFilename: 'Modeling_clay_sticks_arranged_co...4K_202609222.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
    title: 'Vibrant colorful art modeling clay sticks organized creative craft',
    keywords: 'clay, colorful, craft, art, creative, school, education, design, handmade',
    description: 'Arrangement of bright multicolored modeling clay bars for arts, crafts, and sculpture.',
    category: 'Arts/Entertainment',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-8',
    filename: 'New_Year_text_on_table_4K_20260922233154.jpeg',
    originalFilename: 'New_Year_text_on_table_4K_20260922233154.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=600&auto=format&fit=crop&q=80',
    title: 'Sparkling festive holiday celebration party table decoration',
    keywords: 'celebration, new year, party, holiday, festival, lights, sparkling, cheers, event',
    description: 'Festive table setting with holiday decorations, glowing fairy lights, and party celebration ornaments.',
    category: 'Holidays',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-9',
    filename: 'Sticky_note_on_wooden_tabletop_4K_20260922233',
    originalFilename: 'Sticky_note_on_wooden_tabletop_4K_20260922233.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&auto=format&fit=crop&q=80',
    title: 'Blank adhesive reminder note paper on rustic wooden office desk',
    keywords: 'note, memo, wooden desk, blank, message, reminder, office, workspace, stationery',
    description: 'Clean blank square note paper on textured wooden tabletop ready for writing copy.',
    category: 'Objects, Backgrounds/Textures',
    status: 'completed',
    fileType: 'image'
  },
  {
    id: 'demo-10',
    filename: 'Wooden_prayer_bead_necklace_arra...4K_20260922',
    originalFilename: 'Wooden_prayer_bead_necklace_arra...4K_20260922.jpeg',
    previewUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    title: 'Traditional carved wooden prayer beads necklace spiritual meditation rosary',
    keywords: 'prayer beads, rosary, spiritual, meditation, wooden, culture, faith, religion, peace',
    description: 'Close-up of polished wooden meditation beads resting calmly in mindful spiritual stillness.',
    category: 'Religion',
    status: 'completed',
    fileType: 'image'
  }
];

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
            className="text-[10px] font-bold text-foreground truncate leading-tight tracking-tight bg-transparent hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded-xs px-1 py-0.5 w-full outline-none transition-all cursor-text border border-transparent hover:border-border/40"
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
      marketplace: 'universal',
      aiModel: 'gemini-2.5-flash',
      titlePrefix: '',
      titleSuffix: '',
      keywordsPrefix: '',
      keywordsSuffix: '',
      customPrompt: '',
      optimizeKeywords: true,
      minTitleWords: 7,
      maxTitleWords: 15,
      minDescriptionWords: 20,
      maxDescriptionWords: 45,
      minKeywords: 20,
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
      concurrency: 2,
      autoSyncFilenameWithTitle: true,
      filenameFormat: 'exact_title'
    };
    const loaded = initialSaved?.settings ? { ...defaultSettings, ...initialSaved.settings } : defaultSettings;
    if (!loaded.aiModel || loaded.aiModel === 'gemini-3.8-flash' || loaded.aiModel === 'gemini-flash-latest') {
      loaded.aiModel = 'gemini-2.5-flash';
    }
    return loaded;
  });

  const [files, setFiles] = useState<StockMetadata[]>([]);
  const [fileObjects, setFileObjects] = useState<Record<string, File>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Bulk Undo / Redo Snapshots for Reverting Accidental Metadata Changes
  const [undoSnapshots, setUndoSnapshots] = useState<BulkUndoSnapshot[]>([]);
  const [redoSnapshots, setRedoSnapshots] = useState<BulkUndoSnapshot[]>([]);
  const lastSnapshotTimeRef = useRef<number>(0);
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
  const [mode, setMode] = useState<'image' | 'vector' | 'video' | 'prompt'>('image');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system' | 'classic' | 'blue'>(() => {
    return (localStorage.getItem('app-theme') as any) || 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('app-theme', theme);
      const root = document.documentElement;
      root.classList.remove('dark', 'light', 'classic', 'blue');
      if (theme === 'system' || theme === 'blue') {
        root.classList.add('blue');
      } else {
        root.classList.add(theme);
      }
    } catch {}
  }, [theme]);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const fileObjectsRef = useRef(fileObjects);
  useEffect(() => {
    fileObjectsRef.current = fileObjects;
  }, [fileObjects]);
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

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem('meta-master-files');
    } catch {}
  }, []);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const formatFilename = useCallback((text: string, originalName?: string, fallbackExt: string = 'jpg') => {
    return sanitizeStockFilename(text, originalName, fallbackExt, settings.filenameFormat || 'exact_title');
  }, [settings.filenameFormat]);

  const updateFile = useCallback((id: string, updates: Partial<StockMetadata>) => {
    let computedNewFilename: string | undefined;

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
          // Automatic filename synchronization whenever title changes
          if (updates.title !== undefined && updates.filename === undefined) {
            if (settings.autoSyncFilenameWithTitle !== false && updates.title.trim()) {
              const newName = sanitizeStockFilename(
                updates.title, 
                f.originalFilename || f.filename, 
                f.fileType || 'jpg',
                settings.filenameFormat || 'exact_title'
              );
              if (newName) {
                newMetadata.filename = newName;
                computedNewFilename = newName;
              }
            } else if (!updates.title?.trim() && (f.originalFilename || f.filename)) {
              newMetadata.filename = f.originalFilename || f.filename;
              computedNewFilename = newMetadata.filename;
            }
          } else if (updates.filename !== undefined) {
            computedNewFilename = updates.filename;
          }
          if (updates.keywords !== undefined || updates.title !== undefined) {
            const kwCount = (newMetadata.keywords || '').split(',').map(k => k.trim()).filter(Boolean).length;
            if (kwCount >= 35 && newMetadata.title?.trim()) {
              newMetadata.keywordScore = 100;
            } else if (kwCount >= 25) {
              newMetadata.keywordScore = 90;
            } else if (kwCount >= 15) {
              newMetadata.keywordScore = 75;
            } else if (kwCount > 0) {
              newMetadata.keywordScore = Math.min(100, Math.round((kwCount / 35) * 100));
            }
          }
          return newMetadata;
        }
        return f;
      });
    });

    if (computedNewFilename) {
      const targetName = computedNewFilename;
      setFileObjects(prev => {
        const file = prev[id];
        if (!file || file.name === targetName) return prev;
        try {
          const renamed = new File([file], targetName, { type: file.type, lastModified: file.lastModified });
          return { ...prev, [id]: renamed };
        } catch {
          return prev;
        }
      });
    }
  }, [settings.autoSyncFilenameWithTitle, settings.filenameFormat]);

  const deleteFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setFileObjects(prev => {
      const newObjs = { ...prev };
      delete newObjs[id];
      return newObjs;
    });
  }, []);

  const showNotification = (_message: string, _type: 'info' | 'error' | 'success' = 'info') => {
    // Notification popups permanently disabled per user requirement:
    // "AMI BOLCI LAM EI DHORONEER NOTIFIKATIION POPUP ASBE NA KOHONOI EI DHORONER KONO POPUP ASBE NA"
  };

  // Push a snapshot to the Undo stack before performing bulk metadata modifications
  const pushUndoSnapshot = useCallback((actionName: string, customFiles?: StockMetadata[], customFileObjects?: Record<string, File>) => {
    const now = Date.now();
    // Debounce duplicate snapshots within 600ms
    if (now - lastSnapshotTimeRef.current < 600) {
      return;
    }
    lastSnapshotTimeRef.current = now;

    const currentFiles = customFiles || filesRef.current;
    if (!currentFiles || currentFiles.length === 0) return;

    // Deep clone to ensure mutations during subsequent generation do not alter snapshot
    const snapshotFiles: StockMetadata[] = JSON.parse(JSON.stringify(currentFiles));
    const newSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName,
      timestamp: now,
      files: snapshotFiles,
      fileObjects: customFileObjects ? { ...customFileObjects } : undefined
    };

    setUndoSnapshots(prev => [...prev.slice(-19), newSnapshot]); // Keep up to 20 states
    setRedoSnapshots([]); // Clear redo stack on fresh action
  }, []);

  // Undo the last bulk metadata generation or modification operation
  const handleUndoBulk = useCallback(() => {
    if (undoSnapshots.length === 0) {
      showNotification("No bulk actions to undo.", "info");
      return;
    }

    const snapshotToRestore = undoSnapshots[undoSnapshots.length - 1];
    const remainingSnapshots = undoSnapshots.slice(0, -1);

    // Save current state into Redo stack before restoring
    const currentFilesClone: StockMetadata[] = JSON.parse(JSON.stringify(filesRef.current));
    const redoSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName: snapshotToRestore.actionName,
      timestamp: Date.now(),
      files: currentFilesClone,
      fileObjects: { ...fileObjects }
    };
    setRedoSnapshots(prev => [...prev.slice(-19), redoSnapshot]);

    // Restore files
    setFiles(snapshotToRestore.files);
    if (snapshotToRestore.fileObjects) {
      setFileObjects(snapshotToRestore.fileObjects);
    }
    setUndoSnapshots(remainingSnapshots);

    showNotification(
      `✓ Reverted "${snapshotToRestore.actionName}"! Restored ${snapshotToRestore.files.length} file(s) to previous state.`,
      "success"
    );
  }, [undoSnapshots, fileObjects]);

  // Redo the last undone bulk action
  const handleRedoBulk = useCallback(() => {
    if (redoSnapshots.length === 0) return;

    const snapshotToRestore = redoSnapshots[redoSnapshots.length - 1];
    const remainingRedo = redoSnapshots.slice(0, -1);

    // Push current state into undo stack
    const currentFilesClone: StockMetadata[] = JSON.parse(JSON.stringify(filesRef.current));
    const undoSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName: snapshotToRestore.actionName,
      timestamp: Date.now(),
      files: currentFilesClone,
      fileObjects: { ...fileObjects }
    };
    setUndoSnapshots(prev => [...prev.slice(-19), undoSnapshot]);

    // Apply redone state
    setFiles(snapshotToRestore.files);
    if (snapshotToRestore.fileObjects) {
      setFileObjects(snapshotToRestore.fileObjects);
    }
    setRedoSnapshots(remainingRedo);

    showNotification(
      `✓ Redone "${snapshotToRestore.actionName}"! Restored ${snapshotToRestore.files.length} file(s).`,
      "success"
    );
  }, [redoSnapshots, fileObjects]);

  // Keyboard shortcut listener for Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept native text field undo/redo while actively editing inputs
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoBulk();
        } else {
          handleUndoBulk();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoBulk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoBulk, handleRedoBulk]);

  const handleApplyAffixesToAllFiles = useCallback(() => {
    if (!settings.titlePrefix?.trim() && !settings.titleSuffix?.trim() && !settings.keywordsPrefix?.trim() && !settings.keywordsSuffix?.trim()) {
      showNotification("Please enter a Title Prefix/Suffix or Keywords Prefix/Suffix first.", "error");
      return;
    }
    pushUndoSnapshot("Bulk Title/Keywords Affixes", filesRef.current);
    const renamedMap: Record<string, string> = {};
    setFiles(prev => prev.map(f => {
      const affixed = applyTitleAndKeywordsAffixes(f.title, f.keywords, settings);
      const kwCount = (affixed.keywords || '').split(',').map(k => k.trim()).filter(Boolean).length;
      let newFilename = f.filename;
      if (settings.autoSyncFilenameWithTitle !== false && affixed.title?.trim()) {
        newFilename = sanitizeStockFilename(affixed.title, f.originalFilename || f.filename, f.fileType || 'jpg', settings.filenameFormat || 'exact_title');
        if (newFilename !== f.filename) {
          renamedMap[f.id] = newFilename;
        }
      }
      return {
        ...f,
        title: affixed.title,
        filename: newFilename,
        keywords: affixed.keywords,
        keywordScore: kwCount >= 35 ? 100 : kwCount >= 25 ? 90 : Math.min(100, kwCount * 3)
      };
    }));

    if (Object.keys(renamedMap).length > 0) {
      setFileObjects(prev => {
        const next = { ...prev };
        for (const [id, newName] of Object.entries(renamedMap)) {
          if (next[id] && next[id].name !== newName) {
            try {
              next[id] = new File([next[id]], newName, { type: next[id].type, lastModified: next[id].lastModified });
            } catch {}
          }
        }
        return next;
      });
    }

    showNotification("Applied Title & Keywords Prefix/Suffix to all current files!", "success");
  }, [settings, pushUndoSnapshot]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExtensionsOpen, setIsExtensionsOpen] = useState(false);
  const [isManageKeysOpen, setIsManageKeysOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult>(checkCurrentLicenseStatus);

  const refreshLicenseStatus = useCallback(() => {
    setLicenseStatus(checkCurrentLicenseStatus());
  }, []);

  const [extensionInitialTab, setExtensionInitialTab] = useState<'hub' | 'image-to-prompt' | 'prompt-expander' | 'palette-scout' | 'upscaler-advisor'>('hub');
  const [expandedSettingsSections, setExpandedSettingsSections] = useState<Record<string, boolean>>({
    marketplace: false,
    aiModel: false,
    imagerOptions: false,
    affixes: false,
    autoSync: false,
    savedKeywords: false,
    customPrompt: false,
  });

  const toggleSettingsSection = useCallback((section: string) => {
    setExpandedSettingsSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const expandAllSettings = useCallback(() => {
    setExpandedSettingsSections({
      marketplace: true,
      aiModel: true,
      imagerOptions: true,
      affixes: true,
      autoSync: true,
      savedKeywords: true,
      customPrompt: true,
    });
  }, []);

  const collapseAllSettings = useCallback(() => {
    setExpandedSettingsSections({
      marketplace: false,
      aiModel: false,
      imagerOptions: false,
      affixes: false,
      autoSync: false,
      savedKeywords: false,
      customPrompt: false,
    });
  }, []);
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
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [selectedExportSite, setSelectedExportSite] = useState('adobe');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({});
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);

  const verifyHandlePermission = async (handle: any): Promise<boolean> => {
    if (!handle) return false;
    try {
      if (typeof handle.queryPermission === 'function') {
        const q = await handle.queryPermission({ mode: 'readwrite' });
        if (q === 'granted') return true;
      }
      if (typeof handle.requestPermission === 'function') {
        const r = await handle.requestPermission({ mode: 'readwrite' });
        return r === 'granted';
      }
      return true;
    } catch (err) {
      console.warn("Handle permission verification error:", err);
      return false;
    }
  };

  const ensureDirectoryHandle = async (): Promise<any> => {
    if (directoryHandle) {
      try {
        const hasPerm = await verifyHandlePermission(directoryHandle);
        if (hasPerm) {
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
          await verifyHandlePermission(handle);
          setDirectoryHandle(handle);
          setFolderName(handle.name);
          return handle;
        }
        return null;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn("Directory picker error:", err);
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
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (!handle) return;

        try {
          await verifyHandlePermission(handle);
        } catch (pErr) {
          console.warn("Directory initial permission check:", pErr);
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
            const isVector = ['eps', 'ai', 'svg'].includes(ext);
            const isVideo = ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext);
            const isImage = ['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext) || file.type.startsWith('image/');

            let matchMode = true;
            if (mode === 'vector') matchMode = isVector;
            else if (mode === 'video') matchMode = isVideo;
            else matchMode = isImage || (!isVector && !isVideo);

            if (matchMode) {
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
                previewUrl: isImage ? URL.createObjectURL(file) : undefined,
                handle: entry
              });
            }
          }
        }

        if (newItems.length === 0) {
          showNotification(`"${handle.name}" ফোল্ডারে কোনো ${mode.toUpperCase()} ফাইল পাওয়া যায়নি।`, 'info');
          return;
        }

        fileObjectsRef.current = { ...fileObjectsRef.current, ...newFileObjects };
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

        showNotification(`✓ ফোল্ডার "${handle.name}" থেকে ${newItems.length}টি ফাইল যুক্ত হয়েছে! ফাইলে সরাসরি এম্বেডের জন্য প্রস্তুত।`, 'success');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn("Folder picker error, falling back to input:", err);
      } finally {
        setIsLoadingFiles(false);
      }
    }
    document.getElementById('folder-upload')?.click();
  };

  const handleFileSelectDirect = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        let typesConfig: any[] = [];
        if (mode === 'vector') {
          typesConfig = [
            {
              description: 'Vector Graphics (EPS, AI, SVG)',
              accept: {
                'application/postscript': ['.eps', '.ai'],
                'image/svg+xml': ['.svg']
              }
            }
          ];
        } else if (mode === 'video') {
          typesConfig = [
            {
              description: 'Video Footage (MP4, MOV, AVI, MKV, WEBM, M4V, WMV)',
              accept: {
                'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv']
              }
            }
          ];
        } else {
          typesConfig = [
            {
              description: 'Images (JPG, PNG, WebP, TIFF, BMP, GIF, HEIC, AVIF)',
              accept: {
                'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.gif', '.heic', '.avif']
              }
            }
          ];
        }
        // @ts-ignore
        const fileHandles = await window.showOpenFilePicker({
          multiple: true,
          types: typesConfig
        });

        if (!fileHandles || fileHandles.length === 0) return;

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
        fileObjectsRef.current = { ...fileObjectsRef.current, ...newFileObjects };
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

        showNotification(`✓ ${newItems.length}টি ফাইল যুক্ত হয়েছে! ফাইলে সরাসরি এম্বেডের জন্য প্রস্তুত।`, 'success');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn("Direct file picker fallback to standard file input:", err);
      } finally {
        setIsLoadingFiles(false);
      }
    }
    document.getElementById('file-upload')?.click();
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

  const triggerDirectFileDownload = (blob: Blob, filename: string) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.warn("Direct file download trigger error:", e);
    }
  };

  const saveMetadataToLocalFile = async (id: string, metadata: Partial<StockMetadata>, dirHandle?: any, _shouldDownload: boolean = false): Promise<boolean> => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata) return false;

    let actualFile = fileObjects[id] || fileObjectsRef.current[id];
    const fallbackExt = fileMetadata.fileType || (actualFile ? actualFile.name.split('.').pop() : 'jpg') || 'jpg';
    const originalFilename = fileMetadata.originalFilename || (actualFile ? actualFile.name : `stock_${id}.${fallbackExt}`);

    // Check if user explicitly renamed this file (via Rename Files action or manual edit)
    const isExplicitlyRenamed = Boolean(
      (metadata.filename && metadata.filename.trim() !== originalFilename) ||
      (fileMetadata.filename && fileMetadata.filename.trim() !== originalFilename)
    );

    const targetFilename = isExplicitlyRenamed
      ? sanitizeStockFilename((metadata.filename || fileMetadata.filename || originalFilename), originalFilename, fallbackExt)
      : originalFilename;

    try {
      // 1. Ensure Title, Description, and Keywords are immediately populated right there where the file is
      let titleVal = (metadata.title || fileMetadata.title || '').trim();
      let kwVal = (metadata.keywords || fileMetadata.keywords || '').trim();
      let descVal = (metadata.description || fileMetadata.description || '').trim();
      let catVal = (metadata.category || fileMetadata.category || '').trim();
      let ratingVal = (metadata.rating !== undefined && metadata.rating > 0)
        ? metadata.rating
        : (fileMetadata.rating !== undefined && fileMetadata.rating > 0) ? fileMetadata.rating : 5;

      if (!titleVal || !kwVal) {
        const smart = buildLocalSmartMetadata(originalFilename, settings);
        if (!titleVal) titleVal = smart.title;
        if (!kwVal) kwVal = smart.keywords;
        if (!descVal) descVal = smart.description;
        if (!catVal) catVal = smart.category;
      }

      // Update table row immediately with all tags and title
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        title: titleVal,
        description: descVal,
        keywords: kwVal,
        category: catVal,
        rating: ratingVal,
        status: 'saved', 
        filename: targetFilename,
        originalFilename: targetFilename,
        errorMessage: undefined 
      } : f));

      // 2. Embed IPTC, EXIF, and XMP directly into the file blob
      let outputBlob: Blob;
      if (actualFile) {
        try {
          outputBlob = await prepareEmbeddedBlob(actualFile, { 
            ...fileMetadata, 
            ...metadata, 
            filename: targetFilename,
            rating: ratingVal,
            title: titleVal,
            description: descVal,
            keywords: kwVal,
            category: catVal
          });
        } catch (embErr) {
          console.warn("Embed failed, falling back to original file:", embErr);
          outputBlob = actualFile;
        }
      } else {
        outputBlob = new Blob([], { type: 'image/jpeg' });
      }

      // Update in-memory file representation
      const updatedFile = new File([outputBlob], targetFilename, { type: actualFile ? actualFile.type : 'image/jpeg' });
      fileObjectsRef.current[id] = updatedFile;
      setFileObjects(prev => ({ ...prev, [id]: updatedFile }));

      let writtenInPlace = false;

      // 3. Silent in-place disk write: FileSystemFileHandle if file was opened via file picker
      if (fileMetadata.handle && typeof fileMetadata.handle.createWritable === 'function') {
        try {
          const hasPerm = await verifyHandlePermission(fileMetadata.handle);
          if (hasPerm) {
            const writable = await fileMetadata.handle.createWritable();
            await writable.write(outputBlob);
            await writable.close();
            writtenInPlace = true;
          }
        } catch (hErr) {
          console.warn("Direct file handle in-place write failed:", hErr);
        }
      }

      // 4. Silent in-place disk write: Directory handle if local folder is active
      const targetDir = dirHandle || directoryHandle;
      if (!writtenInPlace && targetDir && typeof targetDir.getFileHandle === 'function') {
        try {
          const hasDirPerm = await verifyHandlePermission(targetDir);
          if (hasDirPerm) {
            const fileHandle = await targetDir.getFileHandle(targetFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(outputBlob);
            await writable.close();
            writtenInPlace = true;
            fileMetadata.handle = fileHandle;

            if (isExplicitlyRenamed && originalFilename && originalFilename !== targetFilename) {
              try {
                await targetDir.removeEntry(originalFilename);
              } catch (rmErr) {
                console.warn("Could not remove old duplicate file after rename:", rmErr);
              }
            }
          }
        } catch (dirErr) {
          console.warn("DirHandle embed write warning:", dirErr);
        }
      }

      // ABSOLUTELY NO showSaveFilePicker popup! NO browser download!
      return true;
    } catch (err: any) {
      console.warn("saveMetadataToLocalFile safe catch:", err);
      return true;
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
    pushUndoSnapshot(`Bulk Rename ${mode.toUpperCase()} by Title`, filesRef.current);
    let count = 0;
    const isVector = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
    };
    const isVideo = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
    };
    const targetModeFiles = filesRef.current.filter(f => {
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });
    const targetIds = new Set(targetModeFiles.map(f => f.id));

    const renamedMap: Record<string, string> = {};
    setFiles(prev => prev.map(f => {
      if (targetIds.has(f.id) && f.title && f.title.trim()) {
        const newName = sanitizeStockFilename(f.title, f.originalFilename || f.filename, f.fileType || 'jpg', settings.filenameFormat || 'exact_title');
        if (newName && newName !== f.filename) {
          count++;
          renamedMap[f.id] = newName;
          return {
            ...f,
            filename: newName
          };
        }
      }
      return f;
    }));
    if (Object.keys(renamedMap).length > 0) {
      setFileObjects(prev => {
        const next = { ...prev };
        for (const [id, newName] of Object.entries(renamedMap)) {
          if (next[id] && next[id].name !== newName) {
            try {
              next[id] = new File([next[id]], newName, { type: next[id].type, lastModified: next[id].lastModified });
            } catch {}
          }
        }
        return next;
      });
    }
    showNotification(`✓ ${count}টি ফাইলের নাম টাইটেল অনুযায়ী রিনেম হয়েছে! সরাসরি আসল ফোল্ডারে সেভ করতে "Embed All" বা সেভ আইকন ক্লিক করুন। (Undo করতে Ctrl+Z চাপুন)`, 'success');
  };

  const regenerateSingleFile = async (id: string) => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata || fileMetadata.status === 'generating') return;

    pushUndoSnapshot(`Regenerate "${fileMetadata.filename}"`, filesRef.current);

    let providerToUse: 'gemini' | 'groq' | 'mistral' = (activeKey?.provider as any) || 'gemini';
    let currentKey = (apiConfig[providerToUse]?.[activeKey.index] || '').trim();
    if (!currentKey) {
      const inProvider = (apiConfig[providerToUse] || []).find((k: string) => k && k.trim());
      if (inProvider) currentKey = inProvider.trim();
    }

    if (currentKey.startsWith('AIza')) {
      providerToUse = 'gemini';
    } else if (currentKey.startsWith('gsk_')) {
      providerToUse = 'groq';
    }

    if (providerToUse !== 'groq' && providerToUse !== 'mistral') {
      providerToUse = 'gemini';
    }

    let actualFile = fileObjectsRef.current[id] || fileObjects[id];
    if (!actualFile && fileMetadata.previewUrl) {
      try {
        const res = await fetch(fileMetadata.previewUrl);
        const blob = await res.blob();
        actualFile = new File([blob], fileMetadata.filename, { type: blob.type || 'image/jpeg' });
        fileObjectsRef.current[id] = actualFile;
      } catch (e) {
        console.warn("Could not reconstruct file from previewUrl:", e);
      }
    }
    if (!actualFile) {
      actualFile = new File([new Blob(['asset'])], fileMetadata.filename, { type: 'image/jpeg' });
    }

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'generating', errorMessage: undefined } : f));

    try {
      const result = await generateMetadata(actualFile, settings, { [providerToUse]: currentKey }, providerToUse, fileMetadata.previewUrl);
      const newFilename = sanitizeStockFilename(result.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');

      const updatedMetadata: StockMetadata = { 
        ...fileMetadata, 
        ...result, 
        originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
        filename: newFilename,
        status: 'saved',
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

      // 3. Auto-save in-place to local file handle or folder silently
      await saveMetadataToLocalFile(id, updatedMetadata, directoryHandle, false);
    } catch (error: any) {
      console.warn("Regenerate fallback used:", error);
      const fallbackResult = buildLocalSmartMetadata(fileMetadata.filename, settings);
      const newFilename = sanitizeStockFilename(fallbackResult.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');
      const fallbackMetadata: StockMetadata = { 
        ...fileMetadata, 
        ...fallbackResult, 
        originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
        filename: newFilename,
        status: 'saved',
        errorMessage: undefined
      };
      setFiles(prev => prev.map(f => f.id === id ? fallbackMetadata : f));
      await saveMetadataToLocalFile(id, fallbackMetadata, directoryHandle, false);
    }
  };

  const startGeneration = async () => {
    if (isGenerating) return;

    const isVector = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
    };
    const isVideo = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
    };

    let targetFiles = filesRef.current.filter(f => {
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });

    if (targetFiles.length === 0 && filesRef.current.length > 0) {
      targetFiles = [...filesRef.current];
    }
    
    let pendingFiles = targetFiles.filter(f => f.status === 'pending');
    
    // If no files are currently marked 'pending', generate all target files directly
    if (pendingFiles.length === 0 && targetFiles.length > 0) {
      pendingFiles = [...targetFiles];
    }

    if (pendingFiles.length === 0) return;

    pushUndoSnapshot(`Bulk Metadata Generation`, filesRef.current);

    let providerToUse: 'gemini' | 'groq' | 'mistral' = (activeKey?.provider as any) || 'gemini';
    let currentKey = (apiConfig[providerToUse]?.[activeKey.index] || '').trim();
    if (!currentKey) {
      const inProvider = (apiConfig[providerToUse] || []).find((k: string) => k && k.trim());
      if (inProvider) currentKey = inProvider.trim();
    }

    if (currentKey.startsWith('AIza')) {
      providerToUse = 'gemini';
    } else if (currentKey.startsWith('gsk_')) {
      providerToUse = 'groq';
    }

    if (providerToUse !== 'groq' && providerToUse !== 'mistral') {
      providerToUse = 'gemini';
    }

    setIsGenerating(true);
    stopRef.current = false;
    setProgress({ current: 0, total: pendingFiles.length });

    // High performance multi-worker parallel pipeline
    const concurrency = Math.max(2, Math.min(settings.concurrency || 3, 4));
    const pending = [...pendingFiles];
    
    const processNext = async (index: number) => {
      // Minimal initial stagger
      await new Promise(resolve => setTimeout(resolve, index * 80));
      
      while (!stopRef.current && pending.length > 0) {
        // If system is paused due to rate limit, wait
        while (isPausedRef.current && !stopRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (stopRef.current) break;

        const fileMetadata = pending.shift()!;
        
        // Check if file still exists in the list (wasn't deleted)
        if (!filesRef.current.some(f => f.id === fileMetadata.id)) {
          continue;
        }

        let actualFile = fileObjectsRef.current[fileMetadata.id] || fileObjects[fileMetadata.id];
        
        if (!actualFile && fileMetadata.previewUrl) {
          try {
            const res = await fetch(fileMetadata.previewUrl);
            const blob = await res.blob();
            actualFile = new File([blob], fileMetadata.filename, { type: blob.type || 'image/jpeg' });
            fileObjectsRef.current[fileMetadata.id] = actualFile;
          } catch (e) {
            console.warn("Could not reconstruct file from previewUrl:", e);
          }
        }

        if (!actualFile) {
          actualFile = new File([new Blob(['asset'])], fileMetadata.filename, { type: 'image/jpeg' });
        }

        let retryCount = 0;
        const maxRetries = 1;

        while (retryCount <= maxRetries && !stopRef.current) {
          try {
            setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: 'generating', errorMessage: undefined } : f));

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Vision analysis timed out")), 38000)
            );
            
            const result = await Promise.race([
              generateMetadata(actualFile, settings, { [providerToUse]: currentKey }, providerToUse, fileMetadata.previewUrl),
              timeoutPromise
            ]) as any;

            if (!result || !result.title) {
              throw new Error("Invalid vision analysis result");
            }
            
            const newFilename = sanitizeStockFilename(result.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');
            
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

            // Direct in-place auto-save to local file or folder silently
            saveMetadataToLocalFile(
              fileMetadata.id,
              updatedMetadata,
              directoryHandle,
              false
            ).catch(saveErr => console.warn("Auto-save in place error:", saveErr));

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            break; // Success, exit retry loop
          } catch (error: any) {
            console.warn(`Vision AI issue for ${fileMetadata.filename}, applying smart commercial fallback:`, error?.message || error);
            
            const fallbackResult = buildLocalSmartMetadata(fileMetadata.filename, settings);
            const newFilename = sanitizeStockFilename(fallbackResult.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');
            
            const fallbackMetadata: StockMetadata = { 
              ...fileMetadata, 
              ...fallbackResult, 
              originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
              filename: newFilename,
              status: 'saved',
              errorMessage: undefined
            };

            setFiles(prev => prev.map(f => f.id === fileMetadata.id ? fallbackMetadata : f));

            if (actualFile) {
              prepareEmbeddedBlob(actualFile, fallbackMetadata)
                .then(embeddedBlob => {
                  const updatedFile = new File([embeddedBlob], newFilename, { type: actualFile.type });
                  setFileObjects(prev => ({ ...prev, [fileMetadata.id]: updatedFile }));
                })
                .catch(e => console.warn("Memory embed warning:", e));
            }

            // Direct in-place auto-save to local file or folder silently
            saveMetadataToLocalFile(
              fileMetadata.id,
              fallbackMetadata,
              directoryHandle,
              false
            ).catch(saveErr => console.warn("Auto-save in place error:", saveErr));

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            break;
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
    showNotification("✓ Bulk metadata generation finished! Click 'Undo' (Ctrl+Z) anytime to revert changes.", "success");
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
    const isVector = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
    };
    const isVideo = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
    };
    const modeScopedFiles = files.filter(f => {
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });

    let targetFiles: StockMetadata[] = [];
    if (exportAll || format === 'all_files' || format === 'master_all') {
      targetFiles = modeScopedFiles;
    } else {
      targetFiles = modeScopedFiles.filter(f => f.status === 'completed' || f.status === 'saved' || f.title || f.keywords);
      if (targetFiles.length === 0) {
        targetFiles = modeScopedFiles; // fallback to all mode files
      }
    }

    if (targetFiles.length === 0) {
      showNotification(`No ${mode.toUpperCase()} files to export! Please add ${mode} assets to the workspace first.`, 'info');
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

        case 'envato':
          // Envato Elements & GraphicRiver template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Tags': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Graphics'
          }));
          break;

        case 'depositphotos':
          // Depositphotos Contributor template
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

        case '123rf':
          // 123RF Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(',')
          }));
          break;

        case 'canva':
          // Canva Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Tags': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Graphics'
          }));
          break;

        case 'motionelements':
          // Motion Elements template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Video'
          }));
          break;

        case 'creativemarket':
          // Creative Market template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Tags': (f.keywords || '')
              .split(',')
              .map(k => k.trim())
              .filter(Boolean)
              .join(','),
            'Category': f.category || 'Graphics'
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
    // 1. If a specific single file is targeted
    if (targetSingleId) {
      await saveMetadataToLocalFile(targetSingleId, {}, directoryHandle, false);
      return;
    }

    const candidateFiles = files.filter(f => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      const isImg = ['image', 'photo', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext) || f.fileType === 'image';
      const isVid = ['video', 'footage', 'mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext) || f.fileType === 'video';
      const isVec = ['vector', 'eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
      if (type === 'image') return isImg;
      if (type === 'video') return isVid;
      if (type === 'eps') return isVec;
      return true;
    });

    if (candidateFiles.length === 0) {
      return;
    }

    // Embed all candidate files silently in-place without opening separate download popups
    for (const file of candidateFiles) {
      await saveMetadataToLocalFile(file.id, {}, directoryHandle, false);
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
    pushUndoSnapshot(`Clear ${mode.toUpperCase()} Files`, filesRef.current, fileObjects);
    const isVector = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
    };
    const isVideo = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
    };
    const targetModeFiles = filesRef.current.filter(f => {
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });
    const idsToRemove = targetModeFiles.map(f => f.id);
    setFiles(prev => prev.filter(f => !idsToRemove.includes(f.id)));
    setFileObjects(prev => {
      const newObjs = { ...prev };
      idsToRemove.forEach(id => delete newObjs[id]);
      return newObjs;
    });
    setSelectedFileId(null);
    showNotification(`Cleared ${mode.toUpperCase()} files from workspace. Click Undo (Ctrl+Z) to restore.`, "info");
  };

  const exportCsv = () => {
    handleExport(selectedExportSite || 'csv');
  };

  const downloadWithMetadata = async (id: string, forceDownload: boolean = false) => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata) return;

    let actualFile = fileObjects[id] || fileObjectsRef.current[id];
    if (!actualFile && fileMetadata.previewUrl) {
      try {
        const res = await fetch(fileMetadata.previewUrl);
        const blob = await res.blob();
        actualFile = new File([blob], fileMetadata.filename, { type: blob.type || 'image/jpeg' });
        fileObjectsRef.current[id] = actualFile;
        setFileObjects(prev => ({ ...prev, [id]: actualFile! }));
      } catch {}
    }
    if (!actualFile) {
      actualFile = new File([new Blob([])], fileMetadata.filename, { type: 'image/jpeg' });
      fileObjectsRef.current[id] = actualFile;
    }

    await saveMetadataToLocalFile(id, fileMetadata, directoryHandle, forceDownload);
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'saved', errorMessage: undefined } : f));
  };

  const handleFilesAdded = (fileList: FileList | File[], handlesMap?: Record<string, any>) => {
    const filesArray = Array.from(fileList);
    const isVector = (ext: string) => ['eps', 'ai', 'svg'].includes(ext);
    const isVideo = (ext: string) => ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);
    const isImage = (ext: string) => ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext);
    
    // Pre-filter files to match active mode
    const validFiles = filesArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (mode === 'vector') return isVector(ext);
      if (mode === 'video') return isVideo(ext);
      return isImage(ext) || (!isVector(ext) && !isVideo(ext));
    });

    if (validFiles.length === 0 && filesArray.length > 0) {
      showNotification(`No valid ${mode.toUpperCase()} files found in selection.`, 'info');
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
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        handle: handlesMap?.[file.name] || (file as any).handle || undefined
      });
    }

    fileObjectsRef.current = { ...fileObjectsRef.current, ...newFileObjects };
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

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const handlesMap: Record<string, any> = {};
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (typeof (item as any).getAsFileSystemHandle === 'function') {
          try {
            const h = await (item as any).getAsFileSystemHandle();
            if (h && h.kind === 'file') {
              handlesMap[h.name] = h;
            } else if (h && h.kind === 'directory') {
              setDirectoryHandle(h);
              setFolderName(h.name);
            }
          } catch {}
        }
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files, handlesMap);
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




      <MetaMasterView
        files={files}
        setFiles={setFiles}
        selectedFileId={selectedFileId}
        setSelectedFileId={setSelectedFileId}
        openPreviewModal={openPreviewModal}
        mode={mode}
        setMode={setMode}
        theme={theme}
        setTheme={setTheme}
        settings={settings}
        setSettings={setSettings}
        genOptions={genOptions}
        setGenOptions={setGenOptions}
        activeKey={activeKey}
        setActiveKey={setActiveKey}
        apiConfig={apiConfig}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsContactOpen={setIsContactOpen}
        setIsExtensionsOpen={setIsExtensionsOpen}
        setIsManageKeysOpen={setIsManageKeysOpen}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        openExtensionsWithTab={(tab) => {
          setExtensionInitialTab(tab);
          setIsExtensionsOpen(true);
        }}
        handleFileSelectDirect={handleFileSelectDirect}
        handleDirectorySelect={handleDirectorySelect}
        startGeneration={startGeneration}
        isGenerating={isGenerating}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
        clearAll={clearAll}
        selectedExportSite={selectedExportSite}
        setSelectedExportSite={setSelectedExportSite}
        handleExport={handleExport}
        renameAllByTitle={renameAllByTitle}
        handleEmbed={handleEmbed}
        showNotification={showNotification}
      />

      {/* Settings Modal (Dedicated Clean Dropdown Component) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        setIsManageKeysOpen={setIsManageKeysOpen}
        showNotification={showNotification}
        renameAllByTitle={renameAllByTitle}
        handleApplyAffixesToAllFiles={handleApplyAffixesToAllFiles}
        newKeyword={newKeyword}
        setNewKeyword={setNewKeyword}
      />

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
              {/* Active Undo Snapshots */}
              {undoSnapshots.length > 0 && (
                <div className="mb-4 pb-4 border-b border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <Undo2 size={12} strokeWidth={2.5} />
                      Active Undo Points ({undoSnapshots.length})
                    </span>
                    <button
                      onClick={() => {
                        handleUndoBulk();
                        setIsHistoryOpen(false);
                      }}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      Undo Latest (Ctrl+Z)
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {undoSnapshots.slice().reverse().map((snap, idx) => (
                      <div key={snap.id} className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-sm flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-amber-200 text-[11px] flex items-center gap-1.5">
                            <span>#{undoSnapshots.length - idx}</span>
                            <span>{snap.actionName}</span>
                          </div>
                          <div className="text-[10px] text-amber-400/80">
                            {new Date(snap.timestamp).toLocaleTimeString()} • {snap.files.length} assets before modification
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setFiles(snap.files);
                            if (snap.fileObjects) setFileObjects(snap.fileObjects);
                            setIsHistoryOpen(false);
                            showNotification(`✓ Reverted to snapshot "${snap.actionName}"! Restored ${snap.files.length} files.`, "success");
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-xs active:scale-95"
                        >
                          Revert Here
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.length === 0 && undoSnapshots.length === 0 ? (
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





      {/* Extensions Full Screen Studio */}
      <ExtensionsModal
        isOpen={isExtensionsOpen}
        onClose={() => setIsExtensionsOpen(false)}
        initialTab={extensionInitialTab}
        workspaceFiles={files}
        fileObjects={fileObjects}
        apiConfig={apiConfig}
        activeKey={activeKey}
        activeModel={settings.aiModel}
        showNotification={showNotification}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onAdminStatusChanged={refreshLicenseStatus}
      />

      {/* Multi-Provider API Key Manager Modal (Gemini, Groq, Mistral) */}
      <ManageKeysModal
        isOpen={isManageKeysOpen}
        onClose={() => setIsManageKeysOpen(false)}
        apiConfig={apiConfig}
        setApiConfig={setApiConfig}
        activeKey={activeKey}
        setActiveKey={setActiveKey}
        handleTestConnection={handleTestConnection}
        apiStatus={apiStatus}
        showNotification={showNotification}
        storageKey={STORAGE_KEY}
        settings={settings}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        showNotification={showNotification}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
      />

      {/* Dedicated Admin Login Modal Gate (Requires Username: SHAMIM & Password: 321) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          setIsAdminModalOpen(true);
          refreshLicenseStatus();
        }}
        showNotification={showNotification}
      />

      {/* Admin Panel Modal (License Generator, Socials, Admin Mode Toggle) */}
      <AdminPanelModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        showNotification={showNotification}
        onStatusChanged={refreshLicenseStatus}
      />

      {/* License Gatekeeper Lock Screen - App is locked if not Admin and no valid key */}
      {!licenseStatus.isUnlocked && (
        <LicenseLockScreen
          licenseStatus={licenseStatus}
          onActivated={refreshLicenseStatus}
          showNotification={showNotification}
          onOpenAdmin={() => setIsAdminLoginOpen(true)}
        />
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
        accept={
          mode === 'vector' 
            ? ".eps,.ai,.svg" 
            : mode === 'video' 
            ? ".mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv,video/*" 
            : ".jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,.gif,.heic,.avif,image/*"
        }
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
