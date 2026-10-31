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
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Camera,
  Film
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
import { generateMetadata, testApiConnection, extractEpsThumbnail, extractVideoThumbnail, renderSvgThumbnail, applyTitleAndKeywordsAffixes, buildLocalSmartMetadata, enforceStockTitleWordLimits, generateVectorArtboardThumbnail } from './services/aiService';
import { AssetInspector } from './components/AssetInspector';
import { ExtensionsModal } from './components/ExtensionsModal';
import { MetaMasterView } from './components/MetaMasterView';
import { ContactModal } from './components/ContactModal';
import { ManageKeysModal } from './components/ManageKeysModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { 
  checkCurrentLicenseStatus, 
  LicenseStatusResult,
  startLicenseHeartbeat,
  syncLocalKeysToServer
} from './services/licenseService';
import { cn, sanitizeFilenameForFs, sanitizeStockFilename } from './lib/utils';
import { sanitizeStockKeywords } from './services/marketplaceSanitizer';

const STORAGE_KEY = 'ai-metadata-pro-config';
const HISTORY_KEY = 'ai-metadata-pro-history';

export const SHUTTERSTOCK_PHOTO_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'The Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Illustrations/Clip-Art',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vectors',
  'Vintage'
];

export const SHUTTERSTOCK_VIDEO_CATEGORIES = [
  'Animals/Wildlife',
  'Art',
  'Backgrounds/Textures',
  'Buildings/Landmarks',
  'Business/Finance',
  'Education',
  'Food and drink',
  'Health care',
  'Holidays',
  'Industrial',
  'Nature',
  'Objects',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation'
];

export const SHUTTERSTOCK_CATEGORIES = SHUTTERSTOCK_PHOTO_CATEGORIES;

export function mapToShutterstockCategory(cat: string = '', tags: string = '', isVideo: boolean = false): string {
  const trimmed = (cat || '').trim();

  if (isVideo) {
    // Exact match in video list
    const exactVid = SHUTTERSTOCK_VIDEO_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exactVid) return exactVid;

    const text = `${trimmed} ${tags}`.toLowerCase();
    if (/animal|wildlife|bird|pet|dog|cat|fauna|fish|insect|safari/.test(text)) return 'Animals/Wildlife';
    if (/build|landmark|architect|tower|monument|city|skyline|house|urban|bridge/.test(text)) return 'Buildings/Landmarks';
    if (/busin|financ|money|trade|invest|bank|econom|offic|corporat|work/.test(text)) return 'Business/Finance';
    if (/food|drink|beverag|dish|meal|fruit|veget|cook|bak|restaur|cuisin/.test(text)) return 'Food and drink';
    if (/medic|health|doctor|patient|hospit|care|clinic|pharmac|treat/.test(text)) return 'Health care';
    if (/natur|landscap|forest|tree|sea|ocean|beach|mountain|river|sky|sun|waterfall|garden/.test(text)) return 'Nature';
    if (/peopl|person|human|man|woman|child|portrait|face|crowd|family|girl|boy/.test(text)) return 'People';
    if (/car|vehicl|traffic|road|highway|plane|train|transport|flight|drive|auto|truck/.test(text)) return 'Transportation';
    if (/sport|fit|athlet|exercis|run|train|gym|match|play|game|football|soccer/.test(text)) return 'Sports/Recreation';
    if (/sign|symbol|cross|icon|emblem|badge|arrow|warning|mark/.test(text)) return 'Signs/Symbols';
    if (/celebrat|holiday|christma|easter|new year|party|festiv/.test(text)) return 'Holidays';
    if (/industr|factor|construct|manufactur|engin|machin|build/.test(text)) return 'Industrial';
    if (/scienc|laborat|chemist|physic|biolog|research|microscop|dna/.test(text)) return 'Science';
    if (/relig|faith|church|temple|pray|mosque/.test(text)) return 'Religion';
    if (/educat|school|learn|student|univers|book|study/.test(text)) return 'Education';
    if (/comput|technolog|ai|digital|cyber|network|data|robot|screen|code|chip|software/.test(text)) return 'Technology';
    if (/art|paint|music|theatr|creativ|draw|sculptur|dance/.test(text)) return 'Art';
    // Abstract, particles, bokeh, textures, backgrounds, glowing, dark space, motion graphics
    if (/abstract|particle|glow|bokeh|light|space|texture|pattern|motion|cinematic|background|dark|energy|fluid|smoke|fire|wave/.test(text)) return 'Backgrounds/Textures';

    return 'Backgrounds/Textures';
  }

  // Image / Vector Photo list
  const exact = SHUTTERSTOCK_PHOTO_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const text = `${trimmed} ${tags}`.toLowerCase();
  if (/animal|wildlife|bird|pet|dog|cat|fauna|fish|insect|safari/.test(text)) return 'Animals/Wildlife';
  if (/build|landmark|architect|tower|monument|city|skyline|house|urban|bridge/.test(text)) return 'Buildings/Landmarks';
  if (/busin|financ|money|trade|invest|bank|econom|offic|corporat|work/.test(text)) return 'Business/Finance';
  if (/food|drink|beverag|dish|meal|fruit|veget|cook|bak|restaur|cuisin/.test(text)) return 'Food and Drink';
  if (/medic|health|doctor|patient|hospit|care|clinic|pharmac|treat/.test(text)) return 'Healthcare/Medical';
  if (/natur|landscap|forest|tree|sea|ocean|beach|mountain|river|sky|sun/.test(text)) return 'Nature';
  if (/peopl|person|human|man|woman|child|portrait|face|crowd|famil/.test(text)) return 'People';
  if (/car|vehicl|traffic|road|highway|plane|train|transport|flight|driv/.test(text)) return 'Transportation';
  if (/sport|fit|athlet|exercis|run|train|gym|match|play|game/.test(text)) return 'Sports/Recreation';
  if (/comput|technolog|ai|digital|cyber|network|data|robot|screen|code|chip/.test(text)) return 'Technology';
  if (/art|paint|music|theatr|creativ|draw|sculptur|cultur/.test(text)) return 'The Arts';
  if (/beaut|fashion|model|cloth|cosmet|makeup|styl|hair/.test(text)) return 'Beauty/Fashion';
  if (/celebrat|holiday|christma|easter|new year|party|festiv/.test(text)) return 'Holidays';
  if (/interi|room|furnitur|living|bedroom|kitchen|indoor/.test(text)) return 'Interiors';
  if (/industr|factor|construct|manufactur|engin|machin/.test(text)) return 'Industrial';
  if (/scienc|laborat|chemist|physic|biolog|research|microscop/.test(text)) return 'Science';
  if (/sign|symbol|icon|emblem|badge|arrow/.test(text)) return 'Signs/Symbols';
  if (/park|outdoor|garden|meadow|camp/.test(text)) return 'Parks/Outdoor';
  if (/vector|clipart|illustr/.test(text)) return 'Vectors';
  if (/abstract|concept|surreal|geometr/.test(text)) return 'Abstract';
  if (/textur|pattern|surfac|wall|wood|metal|paper/.test(text)) return 'Backgrounds/Textures';
  if (/vintag|retro|antiqu|classic|nostalg/.test(text)) return 'Vintage';
  if (/relig|faith|church|temple|pray/.test(text)) return 'Religion';
  if (/educat|school|learn|student|univers|book/.test(text)) return 'Education';

  return 'Objects';
}

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
    filename: 'Floral_Mandala_Ornament_Vector.eps',
    originalFilename: 'Floral_Mandala_Ornament_Vector.eps',
    previewUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    title: 'Decorative floral mandala ornament vector illustration design',
    keywords: 'mandala, floral, ornament, vector, pattern, decorative, bohemian, symmetry, graphic',
    description: 'Detailed symmetrical decorative mandala floral ornament vector graphic for print and textile design.',
    category: 'Vectors/Illustrations',
    status: 'completed',
    fileType: 'eps'
  },
  {
    id: 'demo-10',
    filename: 'Modern_Geometric_Brand_Badge.ai',
    originalFilename: 'Modern_Geometric_Brand_Badge.ai',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    title: 'Modern geometric abstract badge vector branding graphic',
    keywords: 'badge, geometric, branding, vector, emblem, modern, graphic design, abstract, logo',
    description: 'Minimalist geometric vector badge with clean lines and gradient abstract shapes.',
    category: 'Signs/Symbols',
    status: 'completed',
    fileType: 'ai'
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
            <div className="w-full h-full relative">
              <img src={file.previewUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
              {['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((file.fileType || '').toLowerCase()) && (
                <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 text-purple-200 px-0.5 rounded-tl font-bold leading-none">VID</span>
              )}
              {['eps', 'ai', 'svg'].includes((file.fileType || '').toLowerCase()) && (
                <span className="absolute bottom-0 right-0 text-[7px] bg-black/80 text-amber-300 px-0.5 rounded-tl font-bold leading-none">VEC</span>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/40 relative">
              {['eps', 'ai', 'svg'].includes((file.fileType || '').toLowerCase()) ? (
                <Layers size={14} className="text-amber-400 opacity-80" />
              ) : ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((file.fileType || '').toLowerCase()) ? (
                <Video size={14} className="text-purple-400 opacity-80" />
              ) : (
                <FileText size={15} className="text-blue-400 opacity-80" />
              )}
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
    let parsed: any = null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      parsed = JSON.parse(raw);
    }
    const userSettingsRaw = localStorage.getItem('ai-metadata-pro-user-settings');
    if (userSettingsRaw) {
      const userSettings = JSON.parse(userSettingsRaw);
      if (parsed) {
        parsed.settings = { ...parsed.settings, ...userSettings };
      } else {
        parsed = { settings: userSettings };
      }
    }
    return parsed;
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
      keywordStyle: 'mixed',
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
    if (!loaded.keywordStyle) {
      loaded.keywordStyle = loaded.singleWordKeywords ? 'single' : 'mixed';
    }
    if (!loaded.aiModel) {
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
  const isGeneratingRef = useRef(false);
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);
  const [isPaused, setIsPaused] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const stopRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const pendingQueueRef = useRef<StockMetadata[]>([]);
  const thumbnailAbortRef = useRef<boolean>(false);

  const handleStopGeneration = useCallback(() => {
    stopRef.current = true;
    if (generationAbortControllerRef.current) {
      try {
        generationAbortControllerRef.current.abort();
      } catch {}
      generationAbortControllerRef.current = null;
    }
    pendingQueueRef.current = [];
    setIsGenerating(false);
    setIsPaused(false);
    showNotification("Metadata generation stopped immediately.", "info");
  }, []);
  
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
  const [mode, setMode] = useState<'all' | 'image' | 'vector' | 'video' | 'prompt'>(() => {
    try {
      const saved = localStorage.getItem('ss_meta_active_mode_v1');
      if (saved && ['all', 'image', 'vector', 'video', 'prompt'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'all';
  });

  useEffect(() => {
    try {
      localStorage.setItem('ss_meta_active_mode_v1', mode);
    } catch {}
  }, [mode]);

  const [theme, setTheme] = useState<'teal' | 'dark' | 'system' | 'blue'>(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'light' || saved === 'classic') return 'teal';
    return (saved as any) || 'teal';
  });

  useEffect(() => {
    try {
      localStorage.setItem('app-theme', theme);
      const root = document.documentElement;
      root.classList.remove('dark', 'light', 'classic', 'blue', 'teal');
      if (theme === 'system' || theme === 'blue') {
        root.classList.add('blue');
      } else if (theme === 'teal') {
        root.classList.add('teal');
      } else {
        root.classList.add('dark');
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

  const fileHandlesRef = useRef<Record<string, any>>({});
  const latestEmbeddedBlobsRef = useRef<{ id: string; filename: string; blob: Blob }[]>([]);
  const [genOptions, setGenOptions] = useState(() => {
    const defaultGenOptions = {
      description: true,
      filenameHint: true,
      autoEmbed: false,
      autoRetry: true,
      pngIsolated: true,
      refinePngBg: false,
      autoSave: false,
      autoExport: false,
      aiEnhance: false
    };
    try {
      const saved = localStorage.getItem('ss_meta_gen_options_v1');
      if (saved) {
        return { ...defaultGenOptions, ...JSON.parse(saved) };
      }
    } catch {}
    return defaultGenOptions;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ss_meta_gen_options_v1', JSON.stringify(genOptions));
    } catch {}
  }, [genOptions]);

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
  const pushUndoSnapshot = useCallback((actionName: string, customFiles?: StockMetadata[], _customFileObjects?: Record<string, File>) => {
    const now = Date.now();
    // Debounce duplicate snapshots within 800ms
    if (now - lastSnapshotTimeRef.current < 800) {
      return;
    }
    lastSnapshotTimeRef.current = now;

    const currentFiles = customFiles || filesRef.current;
    if (!currentFiles || currentFiles.length === 0) return;

    // High performance shallow clone: Avoid heavy JSON.stringify on thousands of items
    const snapshotFiles: StockMetadata[] = currentFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      originalFilename: f.originalFilename,
      currentDiskFilename: f.currentDiskFilename,
      title: f.title,
      description: f.description,
      keywords: f.keywords,
      category: f.category,
      rating: f.rating,
      status: f.status,
      fileType: f.fileType,
      previewUrl: f.previewUrl
    }));

    const newSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName,
      timestamp: now,
      files: snapshotFiles
    };

    setUndoSnapshots(prev => [...prev.slice(-4), newSnapshot]); // Keep up to 5 states to prevent memory bloat
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
    const currentFilesClone: StockMetadata[] = filesRef.current.map(f => ({ ...f }));
    const redoSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName: snapshotToRestore.actionName,
      timestamp: Date.now(),
      files: currentFilesClone
    };
    setRedoSnapshots(prev => [...prev.slice(-4), redoSnapshot]);

    // Restore files
    setFiles(snapshotToRestore.files);
    setUndoSnapshots(remainingSnapshots);

    showNotification(
      `✓ Reverted "${snapshotToRestore.actionName}"! Restored ${snapshotToRestore.files.length} file(s) to previous state.`,
      "success"
    );
  }, [undoSnapshots]);

  // Redo the last undone bulk action
  const handleRedoBulk = useCallback(() => {
    if (redoSnapshots.length === 0) return;

    const snapshotToRestore = redoSnapshots[redoSnapshots.length - 1];
    const remainingRedo = redoSnapshots.slice(0, -1);

    // Push current state into undo stack
    const currentFilesClone: StockMetadata[] = filesRef.current.map(f => ({ ...f }));
    const undoSnapshot: BulkUndoSnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      actionName: snapshotToRestore.actionName,
      timestamp: Date.now(),
      files: currentFilesClone
    };
    setUndoSnapshots(prev => [...prev.slice(-4), undoSnapshot]);

    // Apply redone state
    setFiles(snapshotToRestore.files);
    setRedoSnapshots(remainingRedo);

    showNotification(
      `✓ Redone "${snapshotToRestore.actionName}"! Restored ${snapshotToRestore.files.length} file(s).`,
      "success"
    );
  }, [redoSnapshots]);

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

  // Universal Tactile & Click Feedback for ALL Buttons across the App
  // ("sob buttoney jeno click korley jeno money hoi buttoney click hoicey")
  useEffect(() => {
    const handleGlobalButtonClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('button');
      if (!target || target.disabled) return;

      // 1. Tactile Haptic Vibration on Touch/Mobile Devices (10ms)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch {}
      }

      // 2. Crisp subtle mechanical micro-click sound via Web Audio API (zero audio asset dependencies, 100% instant & non-blocking)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(650, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.018);
          gain.gain.setValueAtTime(0.035, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.018);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.02);
        }
      } catch {}
    };

    window.addEventListener('click', handleGlobalButtonClick, true);
    return () => window.removeEventListener('click', handleGlobalButtonClick, true);
  }, []);

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

  // Sync existing local keys to server on mount and continuously monitor license validity
  useEffect(() => {
    syncLocalKeysToServer();

    // Start real-time server-synced heartbeat
    const stopHeartbeat = startLicenseHeartbeat((terminationReason) => {
      refreshLicenseStatus();
      showNotification(terminationReason, 'error');
    });

    return () => {
      stopHeartbeat();
    };
  }, [refreshLicenseStatus, showNotification]);

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
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const previewModalFile = useMemo(() => {
    if (!previewModalFileId) return null;
    return files.find(f => f.id === previewModalFileId) || null;
  }, [previewModalFileId, files]);
  const openPreviewModal = useCallback((file: StockMetadata) => {
    setPreviewModalFileId(file.id);
    setPreviewZoom(1);
    setVideoCurrentTime(0);
    setVideoDuration(0);
  }, []);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [selectedExportSite, setSelectedExportSite] = useState(() => {
    try {
      return localStorage.getItem('ss_meta_selected_export_site_v1') || 'adobe';
    } catch {
      return 'adobe';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ss_meta_selected_export_site_v1', selectedExportSite);
    } catch {}
  }, [selectedExportSite]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const directoryHandleRef = useRef<any>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({});
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [embedPopup, setEmbedPopup] = useState<{
    isOpen: boolean;
    type: 'image' | 'video' | 'eps' | 'all' | 'single';
    total: number;
    current: number;
    currentFilename: string;
    status: 'processing' | 'completed' | 'error';
    inPlaceCount: number;
    renamedDiskCount?: number;
    message?: string;
  }>({
    isOpen: false,
    type: 'all',
    total: 0,
    current: 0,
    currentFilename: '',
    status: 'processing',
    inPlaceCount: 0,
    renamedDiskCount: 0,
    message: ''
  });

  // Auto-dismiss completed embed popup cleanly after 2.5 seconds
  useEffect(() => {
    if (embedPopup.isOpen && embedPopup.status === 'completed') {
      const timer = setTimeout(() => {
        setEmbedPopup(prev => ({ ...prev, isOpen: false }));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [embedPopup.isOpen, embedPopup.status]);

  const verifyHandlePermission = async (handle: any): Promise<boolean> => {
    if (!handle) return false;
    try {
      if (typeof handle.queryPermission === 'function') {
        const q = await handle.queryPermission({ mode: 'readwrite' });
        if (q === 'granted') return true;
        if (typeof handle.requestPermission === 'function') {
          const req = await handle.requestPermission({ mode: 'readwrite' });
          return req === 'granted';
        }
      }
      return true;
    } catch (err) {
      console.warn("Handle permission check:", err);
      return true;
    }
  };

  const ensureDirectoryHandle = async (): Promise<any> => {
    return directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
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

        const userSettingsRaw = localStorage.getItem('ai-metadata-pro-user-settings');
        if (userSettingsRaw) {
          const userSettings = JSON.parse(userSettingsRaw);
          setSettings(prev => ({
            ...prev,
            ...userSettings
          }));
        }

        // Also load from server permanent storage (/api/user-settings) so settings are never lost across sessions/restarts
        try {
          const srvRes = await fetch('/api/user-settings');
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData && srvData.success && srvData.settings) {
              setSettings(prev => ({
                ...prev,
                ...srvData.settings
              }));
            }
          }
        } catch {}

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

  // Save config to local storage and permanent disk storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiConfig, settings, activeKey }));
      localStorage.setItem('ai-metadata-pro-user-settings', JSON.stringify(settings));
    } catch (err) {
      console.error("Failed to save config to local storage:", err);
    }

    // Debounced disk save to /api/user-settings (never lost)
    const diskTimer = setTimeout(() => {
      fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).catch(() => {});
    }, 400);

    return () => clearTimeout(diskTimer);
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

  // Handle Theme Switching with #359FA0 primary teal
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'blue', 'light', 'classic', 'teal');
    root.style.colorScheme = 'dark';
    if (theme === 'system' || theme === 'blue') {
      root.classList.add('blue');
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.add('teal');
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

        if (typeof handle.requestPermission === 'function') {
          try {
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
              showNotification("ফোল্ডারে ফাইল রিনেম ও সেভ করার জন্য ব্রাউজারের 'Allow' পারমিশন প্রয়োজন।", 'info');
            }
          } catch (pErr) {
            console.warn("Directory initial permission check:", pErr);
          }
        }

        setIsLoadingFiles(true);
        setDirectoryHandle(handle);
        directoryHandleRef.current = handle;
        if (typeof window !== 'undefined') (window as any).__ss_active_dir = handle;
        setFolderName(handle.name);
        
        // Reset workspace when connecting a folder so old files never duplicate with new ones
        filesRef.current = [];
        fileObjectsRef.current = {};
        fileHandlesRef.current = {};
        setFiles([]);
        setFileObjects({});
        
        const allItems: StockMetadata[] = [];
        const allFileObjects: Record<string, File> = {};
        const seenNamesInDir = new Set<string>();
        let batchItems: StockMetadata[] = [];
        let batchFileObjects: Record<string, File> = {};

        let foundImages = 0;
        let foundVectors = 0;
        let foundVideos = 0;

        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            try {
              const file = await entry.getFile();
              const lowerName = file.name.toLowerCase().trim();
              if (seenNamesInDir.has(lowerName)) {
                continue; // Skip duplicate files in directory
              }
              seenNamesInDir.add(lowerName);

              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              const isVector = ['eps', 'ai', 'svg'].includes(ext);
              const isVideo = ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes(ext);
              const isImage = ['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext) || file.type.startsWith('image/');

              if (isVector) foundVectors++;
              else if (isVideo) foundVideos++;
              else if (isImage) foundImages++;

              // Include all supported media assets
              if (isImage || isVector || isVideo) {
                const id = Math.random().toString(36).substr(2, 9);
                batchFileObjects[id] = file;
                allFileObjects[id] = file;
                fileHandlesRef.current[id] = entry;

                const newItem: StockMetadata = {
                  id,
                  filename: file.name,
                  originalFilename: file.name,
                  initialDiskFilename: file.name,
                  currentDiskFilename: file.name,
                  title: '',
                  description: '',
                  keywords: '',
                  rating: 5,
                  status: 'pending',
                  fileType: ext,
                  previewUrl: (isImage || isVideo || ext === 'svg') ? URL.createObjectURL(file) : generateVectorArtboardThumbnail(file.name),
                  handle: entry
                };

                if (isVideo) {
                  extractVideoThumbnail(file).then(thumb => {
                    if (thumb) {
                      setFiles(prev => prev.map(item => item.id === id ? { ...item, previewUrl: thumb } : item));
                      const target = filesRef.current.find(item => item.id === id);
                      if (target) target.previewUrl = thumb;
                    }
                  }).catch(() => {});
                }

                batchItems.push(newItem);
                allItems.push(newItem);

                // Stream initial 10 items immediately so UI populates within 30ms, then stream chunks of 20
                if (batchItems.length >= (allItems.length <= 10 ? 10 : 20)) {
                  const chunkItems = [...batchItems];
                  const chunkObjs = { ...batchFileObjects };
                  batchItems = [];
                  batchFileObjects = {};

                  Object.assign(fileObjectsRef.current, chunkObjs);
                  filesRef.current = [...filesRef.current, ...chunkItems];
                  setFiles(prev => [...prev, ...chunkItems]);
                  setFileObjects(prev => ({ ...prev, ...chunkObjs }));
                  setSelectedFileId(prev => prev || chunkItems[0]?.id || null);

                  // Yield to browser event loop to maintain 60fps responsiveness and zero freeze
                  await new Promise(r => setTimeout(r, 0));
                }
              }
            } catch (fileErr) {
              console.warn("Could not read file from directory entry:", fileErr);
            }
          }
        }

        // Flush remaining buffered items
        if (batchItems.length > 0) {
          Object.assign(fileObjectsRef.current, batchFileObjects);
          filesRef.current = [...filesRef.current, ...batchItems];
          setFiles(prev => [...prev, ...batchItems]);
          setFileObjects(prev => ({ ...prev, ...batchFileObjects }));
          setSelectedFileId(prev => prev || batchItems[0]?.id || null);
        }

        if (allItems.length === 0) {
          showNotification(`"${handle.name}" ফোল্ডারে কোনো ছবি, ভেক্টর বা ভিডিও ফাইল পাওয়া যায়নি।`, 'info');
          return;
        }

        // Auto-switch mode: if mixed files exist, choose 'all' so NO files are ever hidden!
        const distinctTypes = (foundVectors > 0 ? 1 : 0) + (foundVideos > 0 ? 1 : 0) + (foundImages > 0 ? 1 : 0);
        if (distinctTypes > 1) {
          setMode('all');
        } else if (foundVectors > 0) {
          setMode('vector');
        } else if (foundVideos > 0) {
          setMode('video');
        } else {
          setMode('image');
        }

        showNotification(`✓ ফোল্ডার "${handle.name}" যুক্ত হয়েছে (${allItems.length} ফাইল)। মেটাডাটা সরাসরি এই ফোল্ডারের ফাইলে সেভ ও রিনেম হবে (কোনো ডাউনলোড হবে না)!`, 'success');
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
        // @ts-ignore
        const handles = await window.showOpenFilePicker({
          multiple: true,
          excludeAcceptAllOption: false,
          types: [
            {
              description: 'All Media Assets (Videos, Images, Vectors)',
              accept: {
                'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'],
                'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.gif', '.heic', '.avif'],
                'application/postscript': ['.eps', '.ai'],
                'image/svg+xml': ['.svg']
              }
            }
          ]
        });
        if (handles && handles.length > 0) {
          setIsLoadingFiles(true);
          const pickedFiles: File[] = [];
          const handlesMap: Record<string, any> = {};
          for (const h of handles) {
            try {
              if (typeof h.queryPermission === 'function') {
                try {
                  const perm = await h.queryPermission({ mode: 'readwrite' });
                  if (perm !== 'granted' && typeof h.requestPermission === 'function') {
                    await h.requestPermission({ mode: 'readwrite' });
                  }
                } catch {}
              }
              const f = await h.getFile();
              (f as any).handle = h;
              pickedFiles.push(f);
              handlesMap[f.name] = h;
              handlesMap[f.name.toLowerCase()] = h;
            } catch (err) {
              console.warn("Failed to get file from handle:", err);
            }
          }
          if (pickedFiles.length > 0) {
            handleFilesAdded(pickedFiles, handlesMap);
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn("showOpenFilePicker error, falling back to input:", err);
      } finally {
        setIsLoadingFiles(false);
      }
    }
    const input = document.getElementById('file-upload') as HTMLInputElement | null;
    if (input) {
      input.value = ''; // reset so same files can be re-selected
      input.click();
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

  const downloadQueueRef = useRef<Array<{ blob: Blob; filename: string }>>([]);
  const isDownloadingRef = useRef(false);

  const processDownloadQueue = () => {
    if (isDownloadingRef.current || downloadQueueRef.current.length === 0) return;
    isDownloadingRef.current = true;
    const item = downloadQueueRef.current.shift()!;
    try {
      const url = URL.createObjectURL(item.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.warn("Direct file download trigger error:", e);
    }
    setTimeout(() => {
      isDownloadingRef.current = false;
      processDownloadQueue();
    }, 200);
  };

  const triggerDirectFileDownload = (blob: Blob, filename: string) => {
    downloadQueueRef.current.push({ blob, filename });
    processDownloadQueue();
  };

  const saveMetadataToLocalFile = async (
    id: string, 
    metadata: Partial<StockMetadata>, 
    dirHandle?: any, 
    shouldDownload: boolean = false
  ): Promise<{ success: boolean; writtenInPlace: boolean; renamedOnDisk?: boolean; downloaded?: boolean; blob: Blob; filename: string; title?: string; description?: string; keywords?: string } | null> => {
    const fileMetadata = filesRef.current.find(f => f.id === id) || files.find(f => f.id === id);
    if (!fileMetadata) return null;

    let actualFile = fileObjects[id] || fileObjectsRef.current[id];
    if (!actualFile && (fileMetadata.handle || fileHandlesRef.current[id])) {
      try {
        const h = fileMetadata.handle || fileHandlesRef.current[id];
        if (typeof h?.getFile === 'function') {
          actualFile = await h.getFile();
          fileObjectsRef.current[id] = actualFile;
          setFileObjects(prev => ({ ...prev, [id]: actualFile }));
        }
      } catch (hErr) {
        console.warn("Could not retrieve file from handle in saveMetadataToLocalFile:", hErr);
      }
    }

    const targetDir = dirHandle || directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
    if (!actualFile && targetDir && typeof targetDir.getFileHandle === 'function') {
      const candidateNames = [
        (fileMetadata as any).currentDiskFilename,
        fileMetadata.filename,
        fileMetadata.originalFilename,
        (fileMetadata as any).initialDiskFilename
      ].filter(Boolean) as string[];

      for (const name of candidateNames) {
        try {
          const fh = await targetDir.getFileHandle(name);
          if (fh) {
            actualFile = await fh.getFile();
            fileObjectsRef.current[id] = actualFile;
            setFileObjects(prev => ({ ...prev, [id]: actualFile }));
            fileMetadata.handle = fh;
            fileHandlesRef.current[id] = fh;
            break;
          }
        } catch {}
      }
    }

    const isVideoAsset = ['mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'wmv'].includes((fileMetadata.fileType || '').toLowerCase()) || fileMetadata.fileType === 'video';
    if (!actualFile && fileMetadata.previewUrl && !isVideoAsset) {
      try {
        const res = await fetch(fileMetadata.previewUrl);
        const b = await res.blob();
        if (b && b.size > 100) {
          actualFile = new File([b], fileMetadata.filename, { type: b.type || 'image/jpeg' });
          fileObjectsRef.current[id] = actualFile;
          setFileObjects(prev => ({ ...prev, [id]: actualFile }));
        }
      } catch {}
    }

    const fallbackExt = fileMetadata.fileType || (actualFile ? actualFile.name.split('.').pop() : 'jpg') || 'jpg';
    const originalFilename = fileMetadata.originalFilename || (actualFile ? actualFile.name : `stock_${id}.${fallbackExt}`);

    try {
      // 1. Ensure Title, Description, and Keywords are immediately populated right there where the file is
      let titleVal = (metadata.title || fileMetadata.title || '').trim();
      let kwVal = (metadata.keywords || fileMetadata.keywords || '').trim();
      let descVal = (metadata.description || fileMetadata.description || '').trim();
      let catVal = (metadata.category || fileMetadata.category || '').trim();
      let ratingVal = (metadata.rating !== undefined && metadata.rating > 0)
        ? metadata.rating
        : (fileMetadata.rating !== undefined && fileMetadata.rating > 0) ? fileMetadata.rating : 5;

      if (!titleVal) {
        titleVal = (fileMetadata.originalFilename || fileMetadata.filename || 'stock_asset')
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .trim();
      }
      if (!descVal) {
        descVal = titleVal;
      }

      // Strictly eliminate 'universal', 'marketplace', 'marketplaces' terms from keywords
      kwVal = kwVal
        .split(',')
        .map(k => k.trim())
        .filter(k => k && !['universal', 'marketplace', 'marketplaces'].includes(k.toLowerCase()))
        .join(', ');

      // Determine target filename:
      // When EMBED or SAVE is run, the filename MUST reflect the title (or explicit custom filename)
      let baseForTarget = '';
      if (metadata.filename && metadata.filename.trim() && metadata.filename.trim() !== originalFilename) {
        baseForTarget = metadata.filename.trim();
      } else if (titleVal && titleVal.trim()) {
        baseForTarget = titleVal.trim();
      } else if (fileMetadata.filename && fileMetadata.filename.trim() && fileMetadata.filename.trim() !== originalFilename) {
        baseForTarget = fileMetadata.filename.trim();
      } else {
        baseForTarget = titleVal || originalFilename;
      }

      const targetFilename = sanitizeStockFilename(
        baseForTarget,
        originalFilename,
        fallbackExt,
        settings.filenameFormat || 'exact_title'
      );

      // Update table row immediately with all tags, title and renamed filename
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        title: titleVal,
        description: descVal,
        keywords: kwVal,
        category: catVal,
        rating: ratingVal,
        status: 'saved', 
        filename: targetFilename,
        originalFilename: f.originalFilename || originalFilename,
        errorMessage: undefined 
      } : f));

      // Synchronize filesRef.current immediately so filename updates everywhere
      const fRefIndex = filesRef.current.findIndex(f => f.id === id);
      if (fRefIndex !== -1) {
        filesRef.current[fRefIndex] = {
          ...filesRef.current[fRefIndex],
          title: titleVal,
          description: descVal,
          keywords: kwVal,
          category: catVal,
          rating: ratingVal,
          status: 'saved', 
          filename: targetFilename,
          originalFilename: filesRef.current[fRefIndex].originalFilename || originalFilename,
          errorMessage: undefined
        };
      }

      // 2. Embed IPTC, EXIF, and XMP directly into the file blob
      let outputBlob: Blob;
      if (actualFile && actualFile.size > 0) {
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
      let renamedOnDisk = false;

      // 3. In-place disk write to Directory handle (TOP PRIORITY for full renaming & in-place replacement)
      if (targetDir && typeof targetDir.getFileHandle === 'function') {
        try {
          // Check and request permission if supported
          if (typeof targetDir.queryPermission === 'function') {
            const p = await targetDir.queryPermission({ mode: 'readwrite' });
            if (p !== 'granted' && typeof targetDir.requestPermission === 'function') {
              await targetDir.requestPermission({ mode: 'readwrite' });
            }
          }

          const existingHandle = metadata.handle || fileMetadata.handle || fileHandlesRef.current[id] || (actualFile as any)?.handle;
          let activeWriteHandle: any = null;

          // Attempt atomic in-place rename with handle.move() if supported by browser (Zero duplicate files!)
          if (existingHandle && typeof existingHandle.move === 'function' && targetFilename !== originalFilename) {
            try {
              await existingHandle.move(targetFilename);
              renamedOnDisk = true;
              activeWriteHandle = existingHandle;
            } catch (moveErr) {
              console.warn("Atomic handle.move fallback to create+delete:", moveErr);
            }
          }

          if (!activeWriteHandle) {
            activeWriteHandle = await targetDir.getFileHandle(targetFilename, { create: true });
          }

          if (activeWriteHandle && typeof activeWriteHandle.createWritable === 'function') {
            const writable = await activeWriteHandle.createWritable({ keepExistingData: false });
            await writable.write(outputBlob);
            await writable.close();
            writtenInPlace = true;
            fileMetadata.handle = activeWriteHandle;
            fileHandlesRef.current[id] = activeWriteHandle;

            // Safe removal of old original files from folder so only the single renamed file exists
            if (targetFilename !== originalFilename) {
              const oldNames = new Set<string>();
              if (originalFilename) oldNames.add(originalFilename);
              if (fileMetadata.originalFilename) oldNames.add(fileMetadata.originalFilename);
              if (fileMetadata.initialDiskFilename) oldNames.add(fileMetadata.initialDiskFilename);
              if ((fileMetadata as any).currentDiskFilename) oldNames.add((fileMetadata as any).currentDiskFilename);

              for (const oldName of oldNames) {
                if (!oldName || oldName === targetFilename) continue;
                try {
                  await targetDir.removeEntry(oldName);
                  renamedOnDisk = true;
                } catch {}
              }

              // Robust case-insensitive sweep across directory entries to eliminate duplicate leftover files
              try {
                for await (const [entryName] of targetDir.entries()) {
                  if (entryName !== targetFilename) {
                    const entryLower = entryName.toLowerCase();
                    for (const oldName of oldNames) {
                      if (oldName && entryLower === oldName.toLowerCase()) {
                        try {
                          await targetDir.removeEntry(entryName);
                          renamedOnDisk = true;
                        } catch {}
                      }
                    }
                  }
                }
              } catch {}
            }

            (fileMetadata as any).currentDiskFilename = targetFilename;
            fileMetadata.filename = targetFilename;
            fileMetadata.initialDiskFilename = targetFilename;
          }
        } catch (dirErr: any) {
          console.warn("DirHandle embed write warning:", dirErr);
        }
      }

      // 4. In-place write: Direct file handle if user selected files with showOpenFilePicker
      const handleToUse = metadata.handle || fileMetadata.handle || fileHandlesRef.current[id] || (actualFile as any)?.handle;
      if (!writtenInPlace && handleToUse && typeof handleToUse.createWritable === 'function') {
        try {
          if (typeof handleToUse.queryPermission === 'function') {
            const p = await handleToUse.queryPermission({ mode: 'readwrite' });
            if (p !== 'granted' && typeof handleToUse.requestPermission === 'function') {
              await handleToUse.requestPermission({ mode: 'readwrite' });
            }
          }
          if (typeof (handleToUse as any).move === 'function' && targetFilename !== originalFilename) {
            try {
              await (handleToUse as any).move(targetFilename);
              renamedOnDisk = true;
            } catch {}
          }
          const writable = await handleToUse.createWritable({ keepExistingData: false });
          await writable.write(outputBlob);
          await writable.close();
          writtenInPlace = true;
          (fileMetadata as any).currentDiskFilename = targetFilename;
          fileMetadata.filename = targetFilename;
        } catch (handleErr) {
          console.warn("Direct file handle write warning:", handleErr);
        }
      }

      // 5. Download only if explicitly requested by an export or download action
      let downloaded = false;
      if (shouldDownload) {
        triggerDirectFileDownload(outputBlob, targetFilename);
        downloaded = true;
      }

      return {
        success: true,
        writtenInPlace,
        renamedOnDisk,
        downloaded,
        blob: outputBlob,
        filename: targetFilename,
        title: titleVal,
        description: descVal,
        keywords: kwVal
      };
    } catch (err: any) {
      console.warn("saveMetadataToLocalFile safe catch:", err);
      return null;
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
      const file = fileObjects[item.id] || fileObjectsRef.current[item.id];
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
      // Micro-yield to prevent browser hang on huge zip batches
      await new Promise(r => setTimeout(r, 10));
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

  const renameAllByTitle = async () => {
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
      if (mode === 'all') return true;
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });

    let inPlaceRenamed = 0;
    let activeDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);

    if (activeDir && typeof activeDir.requestPermission === 'function') {
      try {
        const q = await activeDir.queryPermission({ mode: 'readwrite' });
        if (q !== 'granted') {
          await activeDir.requestPermission({ mode: 'readwrite' });
        }
      } catch {}
    }

    for (const f of targetModeFiles) {
      const titleToUse = (f.title && f.title.trim()) ? f.title.trim() : '';
      if (!titleToUse) {
        // Only rename files that have an AI-generated title
        continue;
      }
      const newName = sanitizeStockFilename(titleToUse, f.originalFilename || f.filename, f.fileType || 'jpg', settings.filenameFormat || 'exact_title');
      if (newName) {
        count++;
        const res = await saveMetadataToLocalFile(f.id, { filename: newName, title: titleToUse }, activeDir, false);
        if (res && res.writtenInPlace) {
          inPlaceRenamed++;
        }
      }
      // Micro-yield to keep UI 60fps responsive during bulk rename
      await new Promise(r => setTimeout(r, 8));
    }

    if (inPlaceRenamed > 0) {
      showNotification(`🎉 ${inPlaceRenamed}টি ফাইলের নাম সরাসরি আপনার ফোল্ডারে রিনেম ও মেটাডাটা আপডেট সম্পন্ন হয়েছে!`, 'success');
    } else if (count > 0) {
      showNotification(`✓ ${count}টি ফাইলের নাম টাইটেল অনুযায়ী রিনেম হয়েছে! সরাসরি ফোল্ডারে সেভ করতে 'SELECT FOLDER' কানেক্ট করুন অথবা 'All Embed' এ ক্লিক করুন। (Undo করতে Ctrl+Z চাপুন)`, 'success');
    } else {
      showNotification("কোনো ফাইলের টাইটেল পাওয়া যায়নি। প্রথমে 'Start' ক্লিক করে টাইটেল তৈরি করুন।", 'info');
    }
  };

  const regenerateSingleFile = async (id: string, customFrameUrl?: string) => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata || fileMetadata.status === 'generating') return;

    pushUndoSnapshot(`Regenerate "${fileMetadata.filename}"`, filesRef.current);

    let providerToUse: 'gemini' | 'groq' | 'mistral' = (activeKey?.provider as any) || 'gemini';
    const activeKeyIdx = (activeKey && typeof activeKey.index === 'number') ? activeKey.index : 0;
    let currentKey = (apiConfig?.[providerToUse]?.[activeKeyIdx] || '').trim();
    if (!currentKey) {
      const inProvider = (apiConfig?.[providerToUse] || []).find((k: string) => k && k.trim());
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
    if (!actualFile && (fileMetadata.handle || fileHandlesRef.current[id])) {
      try {
        const h = fileMetadata.handle || fileHandlesRef.current[id];
        if (typeof h?.getFile === 'function') {
          actualFile = await h.getFile();
          fileObjectsRef.current[id] = actualFile;
        }
      } catch (hErr) {
        console.warn("Could not get file from handle:", hErr);
      }
    }
    if (!actualFile && (customFrameUrl || fileMetadata.previewUrl)) {
      try {
        const res = await fetch(customFrameUrl || fileMetadata.previewUrl!);
        const blob = await res.blob();
        if (blob && blob.size > 100) {
          actualFile = new File([blob], fileMetadata.filename, { type: blob.type || 'image/jpeg' });
          fileObjectsRef.current[id] = actualFile;
        }
      } catch (e) {
        console.warn("Could not reconstruct file from previewUrl:", e);
      }
    }
    if (!actualFile || actualFile.size < 10) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        errorMessage: 'File content unavailable. Please re-select folder or file.' 
      } : f));
      showNotification(`⚠️ "${fileMetadata.filename}" ফাইলের কনটেন্ট লোড করা যায়নি। ফোল্ডারটি আবার সিলেক্ট করুন।`, 'error');
      return;
    }

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'generating', errorMessage: undefined } : f));

    try {
      const frameToAnalyze = customFrameUrl || fileMetadata.previewUrl;
      const result = await generateMetadata(actualFile, settings, apiConfig, providerToUse, frameToAnalyze);
      if (!result || !result.title || !String(result.title).trim()) {
        throw new Error("Could not generate valid metadata for this asset. Original file is kept 100% safe.");
      }

      result.title = enforceStockTitleWordLimits(
        result.title,
        settings?.minTitleWords || 7,
        settings?.maxTitleWords || 15,
        {
          filename: actualFile.name,
          isVector: ['eps', 'ai', 'svg'].includes((fileMetadata.fileType || '').toLowerCase()) || fileMetadata.fileType === 'vector',
          isVideo: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((fileMetadata.fileType || '').toLowerCase()) || fileMetadata.fileType === 'video',
          category: result.category,
          keywords: result.keywords
        }
      );
      const newFilename = sanitizeStockFilename(result.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');

      const updatedMetadata: StockMetadata = { 
        ...fileMetadata, 
        ...result, 
        previewUrl: customFrameUrl || result.previewUrl || fileMetadata.previewUrl,
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
      const activeDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
      await saveMetadataToLocalFile(id, updatedMetadata, activeDir, false);
    } catch (error: any) {
      console.error("Regenerate failed:", error);
      const errMsg = error?.message || 'Vision AI analysis failed. Click Retry.';
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        errorMessage: errMsg 
      } : f));
      const fIndex = filesRef.current.findIndex(f => f.id === id);
      if (fIndex !== -1) {
        filesRef.current[fIndex] = {
          ...filesRef.current[fIndex],
          status: 'error',
          errorMessage: errMsg
        };
      }
      showNotification(`⚠️ "${fileMetadata.filename}" মেটাডাটা তৈরিতে সমস্যা হয়েছে। Retry বাটনে চাপুন।`, 'error');
    }
  };

  const handleCaptureVideoFrame = async (generateAi: boolean = false) => {
    if (!previewModalFile) return;
    const vidEl = previewVideoRef.current || (document.getElementById('active-preview-video') as HTMLVideoElement);
    if (!vidEl || !vidEl.videoWidth) {
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const maxDim = 1280;
      let w = vidEl.videoWidth;
      let h = vidEl.videoHeight;
      if (w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      }
      canvas.width = Math.max(w, 100);
      canvas.height = Math.max(h, 60);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(vidEl, 0, 0, w, h);
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // 1. Update previewUrl in state and ref immediately so table and modal show this frame
      updateFile(previewModalFile.id, { previewUrl: frameDataUrl });
      const targetF = filesRef.current.find(f => f.id === previewModalFile.id);
      if (targetF) targetF.previewUrl = frameDataUrl;

      if (!generateAi) {
        return;
      }

      // 2. Run AI generation using this exact visual frame!
      await regenerateSingleFile(previewModalFile.id, frameDataUrl);
    } catch (e) {
      console.warn("Video frame capture error:", e);
    }
  };

  const startGeneration = async (overrideMode?: 'all' | 'image' | 'vector' | 'video' | any) => {
    if (isGenerating) return;

    const isVector = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
    };
    const isVideo = (f: StockMetadata) => {
      const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
    };

    const effectiveMode = (typeof overrideMode === 'string' && ['all', 'image', 'vector', 'video'].includes(overrideMode))
      ? overrideMode
      : mode;

    const allCurrentFiles = filesRef.current.length > 0 ? filesRef.current : files;
    let targetFiles = allCurrentFiles.filter(f => {
      if (effectiveMode === 'all') return true;
      if (effectiveMode === 'vector') return isVector(f);
      if (effectiveMode === 'video') return isVideo(f);
      if (effectiveMode === 'image') return !isVector(f) && !isVideo(f);
      return true;
    });

    if (targetFiles.length === 0 && allCurrentFiles.length > 0) {
      targetFiles = [...allCurrentFiles];
    }
    
    let pendingFiles = targetFiles.filter(f => f.status === 'pending');
    
    // If no files are currently marked 'pending', generate all target files directly
    if (pendingFiles.length === 0 && targetFiles.length > 0) {
      pendingFiles = [...targetFiles];
    }

    if (pendingFiles.length === 0) return;

    // Proactively acquire folder permission right at the beginning under this click gesture!
    let activeDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
    if (!activeDir && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const pickedDir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (pickedDir) {
          activeDir = pickedDir;
          setDirectoryHandle(pickedDir);
          directoryHandleRef.current = pickedDir;
          if (typeof window !== 'undefined') (window as any).__ss_active_dir = pickedDir;
          setFolderName(pickedDir.name);
          if (typeof pickedDir.requestPermission === 'function') {
            await pickedDir.requestPermission({ mode: 'readwrite' });
          }
        }
      } catch (dErr) {
        console.warn("Folder picker in startGeneration:", dErr);
      }
    }

    if (activeDir && typeof activeDir.requestPermission === 'function') {
      try {
        const q = await activeDir.queryPermission({ mode: 'readwrite' });
        if (q !== 'granted') {
          await activeDir.requestPermission({ mode: 'readwrite' });
        }
      } catch (pErr) {
        console.warn("Permission check in startGeneration:", pErr);
      }
    }

    pushUndoSnapshot(`Bulk Metadata Generation`, allCurrentFiles);

    let providerToUse: 'gemini' | 'groq' | 'mistral' = (activeKey?.provider as any) || 'gemini';
    const activeKeyIdx = (activeKey && typeof activeKey.index === 'number') ? activeKey.index : 0;
    let currentKey = (apiConfig?.[providerToUse]?.[activeKeyIdx] || '').trim();
    if (!currentKey) {
      const inProvider = (apiConfig?.[providerToUse] || []).find((k: string) => k && k.trim());
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
    const abortCtrl = new AbortController();
    generationAbortControllerRef.current = abortCtrl;
    pendingQueueRef.current = [...pendingFiles];
    setProgress({ current: 0, total: pendingFiles.length });
    showNotification(`🚀 মেটাডাটা তৈরি শুরু হয়েছে (${pendingFiles.length}টি ফাইল)...`, 'info');

    // Multi-worker processing with safe rate-limit pacing so Vision AI processes each image cleanly without 429 quota exhaustion
    const userMaxConcurrency = Math.max(1, Math.min(2, Number(settings?.concurrency) || 2));
    const concurrency = Math.min(userMaxConcurrency, pendingFiles.length);
    
    const processNext = async () => {
      while (!stopRef.current && !abortCtrl.signal.aborted && pendingQueueRef.current.length > 0) {
        // If system is paused due to rate limit, wait
        while (isPausedRef.current && !stopRef.current && !abortCtrl.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        if (stopRef.current || abortCtrl.signal.aborted) break;

        const fileMetadata = pendingQueueRef.current.shift();
        if (!fileMetadata) break;
        
        // Check if file still exists in the list (wasn't deleted/cleared)
        if (!filesRef.current.some(f => f.id === fileMetadata.id)) {
          continue;
        }

        let actualFile = fileObjectsRef.current[fileMetadata.id] || fileObjects[fileMetadata.id];
        
        if (!actualFile && (fileMetadata.handle || fileHandlesRef.current[fileMetadata.id])) {
          try {
            const h = fileMetadata.handle || fileHandlesRef.current[fileMetadata.id];
            if (typeof h?.getFile === 'function') {
              actualFile = await h.getFile();
              fileObjectsRef.current[fileMetadata.id] = actualFile;
            }
          } catch (hErr) {
            console.warn("Could not get file from handle:", hErr);
          }
        }

        const currentActiveDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
        if ((!actualFile || actualFile.size === 0) && currentActiveDir) {
          try {
            const h = await currentActiveDir.getFileHandle(fileMetadata.originalFilename || fileMetadata.filename);
            if (h && typeof h.getFile === 'function') {
              const diskFile = await h.getFile();
              if (diskFile && diskFile.size > 0) {
                actualFile = diskFile;
                fileObjectsRef.current[fileMetadata.id] = diskFile;
              }
            }
          } catch {}
        }

        if (!actualFile && fileMetadata.previewUrl) {
          try {
            const res = await fetch(fileMetadata.previewUrl);
            const blob = await res.blob();
            if (blob && blob.size > 100) {
              actualFile = new File([blob], fileMetadata.filename, { type: blob.type || 'image/jpeg' });
              fileObjectsRef.current[fileMetadata.id] = actualFile;
            }
          } catch (e) {
            console.warn("Could not reconstruct file from previewUrl:", e);
          }
        }

        // If actualFile is still missing, create a proxy file with filename and rely on previewUrl
        if (!actualFile) {
          actualFile = new File([], fileMetadata.filename, { type: 'image/jpeg' });
        }

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries && !stopRef.current && !abortCtrl.signal.aborted) {
          try {
            if (stopRef.current || abortCtrl.signal.aborted || !filesRef.current.some(f => f.id === fileMetadata.id)) {
              break;
            }

            setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: 'generating', errorMessage: undefined } : f));
            // Small 30ms yield to let browser paint 'generating' state cleanly
            await new Promise(r => setTimeout(r, 30));

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Vision analysis timed out")), 45000)
            );
            
            // Pass full apiConfig containing all 5 key slots and cancellation signal
            const result = await Promise.race([
              generateMetadata(actualFile, settings, apiConfig, providerToUse, fileMetadata.previewUrl, abortCtrl.signal),
              timeoutPromise
            ]) as any;

            if (stopRef.current || abortCtrl.signal.aborted || !filesRef.current.some(f => f.id === fileMetadata.id)) {
              break;
            }

            if (!result || !result.title || !String(result.title).trim()) {
              throw new Error("Invalid vision analysis result");
            }
            
            result.title = enforceStockTitleWordLimits(
              result.title,
              settings?.minTitleWords || 7,
              settings?.maxTitleWords || 15,
              {
                filename: actualFile.name,
                isVector: isVector(fileMetadata),
                isVideo: isVideo(fileMetadata),
                category: result.category,
                keywords: result.keywords
              }
            );

            const newFilename = sanitizeStockFilename(result.title, fileMetadata.originalFilename || fileMetadata.filename, fileMetadata.fileType || 'jpg', settings.filenameFormat || 'exact_title');
            
            // Strictly enforce comma-separated tags and unpack any run-on sentences without commas
            const activeKwStyle = settings?.keywordStyle || (settings?.singleWordKeywords ? 'single' : 'mixed');
            const sanitizedKwObj = sanitizeStockKeywords(
              result.keywords || '',
              result.title,
              settings?.maxKeywords || 50,
              settings?.singleWordKeywords,
              activeKwStyle
            );
            const cleanKw = sanitizedKwObj.keywords;

            const updatedMetadata = { 
              ...fileMetadata, 
              ...result, 
              keywords: cleanKw,
              originalFilename: fileMetadata.originalFilename || fileMetadata.filename,
              filename: newFilename,
              status: 'completed' as const,
              errorMessage: undefined
            };

            setFiles(prev => prev.map(f => (f.id === fileMetadata.id ? updatedMetadata : f)));

            // Synchronize filesRef.current immediately
            const fIndex = filesRef.current.findIndex(f => f.id === fileMetadata.id);
            if (fIndex !== -1) {
              filesRef.current[fIndex] = updatedMetadata;
            }

            // In-place disk write only if local folder handle or file handle is connected
            const currentDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);
            const hasDirectDiskHandle = Boolean(currentDir || fileMetadata.handle || fileHandlesRef.current[fileMetadata.id]);
            if (hasDirectDiskHandle) {
              try {
                await saveMetadataToLocalFile(fileMetadata.id, updatedMetadata, currentDir, false);
              } catch (saveErr) {
                console.warn("Embed metadata save error:", saveErr);
              }
            }

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));

            // Respectful pacing delay between files (400ms) to stay within API rate limits cleanly
            await new Promise(r => setTimeout(r, 400));
            break; // Success, exit retry loop
          } catch (error: any) {
            if (stopRef.current || abortCtrl.signal.aborted || !filesRef.current.some(f => f.id === fileMetadata.id)) {
              break;
            }
            const errStr = String(error?.message || error || '');
            const isRateLimit = errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('rate');
            if (retryCount < (isRateLimit ? 3 : maxRetries) && !stopRef.current && !abortCtrl.signal.aborted) {
              retryCount++;
              setFiles(prev => prev.map(f => f.id === fileMetadata.id ? { ...f, status: 'generating', errorMessage: undefined } : f));
              await new Promise(r => setTimeout(r, isRateLimit ? 3500 : 1200));
              continue; // Retry AI analysis
            }
            console.error(`Vision AI failed for ${fileMetadata.filename}:`, error?.message || error);
            
            const failedMetadata: StockMetadata = { 
              ...fileMetadata, 
              status: 'error' as const,
              errorMessage: error?.message || "Vision AI generation failed. Click Retry to re-analyze."
            };

            setFiles(prev => prev.map(f => (f.id === fileMetadata.id ? failedMetadata : f)));

            const fIndex = filesRef.current.findIndex(f => f.id === fileMetadata.id);
            if (fIndex !== -1) {
              filesRef.current[fIndex] = failedMetadata;
            }

            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            break;
          }
        }
      }
    };

    try {
      const workers = Array.from({ length: concurrency }, (_, i) => {
        if (i > 0) {
          return new Promise(resolve => setTimeout(resolve, i * 450)).then(() => processNext());
        }
        return processNext();
      });
      await Promise.all(workers);
    } catch (err) {
      console.error("Batch processing error:", err);
    } finally {
      setIsGenerating(false);
      setIsPaused(false);
      generationAbortControllerRef.current = null;
      pendingQueueRef.current = [];
    }

    if (stopRef.current || abortCtrl.signal.aborted) {
      // Stopped or cleared by user - cleanly exit without success banner
      return;
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
    const rawKey = apiConfig[provider]?.[index] || '';
    const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');
    
    setApiStatus(prev => ({ ...prev, [`${provider}-${index}`]: 'testing' }));
    const result = await testApiConnection(provider, cleanKey);
    
    setApiStatus(prev => ({ ...prev, [`${provider}-${index}`]: 'connected' }));
    showNotification(result.message || `✓ ${provider.toUpperCase()} Slot #${index + 1} Connected! Key is active in 5-key pool.`, 'success');
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
      if (mode === 'all') return true;
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

      const getCleanKeywordsList = (raw: string, max: number = 49) => {
        const cleaned = (raw || '')
          .split(',')
          .map(k => k.trim())
          .filter(k => k && k.length > 1 && !['universal', 'marketplace', 'commercial', 'concept'].includes(k.toLowerCase()));
        const unique = Array.from(new Set(cleaned));
        return unique.slice(0, max).join(',');
      };

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
            'Keywords': getCleanKeywordsList(f.keywords || '', 50),
            'Category': f.category || 'Technology',
            'Rating': f.rating || 5,
            'File Type': (f.fileType || '').toUpperCase(),
            'Status': f.status || 'pending'
          }));
          break;

        case 'adobe':
          // Adobe Stock official contributor template (Strict max 49 keywords)
          // Headers: Filename, Title, Keywords, Category
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': (f.title || f.filename.replace(/\.[^/.]+$/, "")).slice(0, 200),
            'Keywords': getCleanKeywordsList(f.keywords || '', 49),
            'Category': f.category || 'Technology'
          }));
          break;

        case 'shutterstock_footage':
        case 'shutterstock':
          // Shutterstock official contributor templates (Footage & Image)
          filenamePrefix = format === 'shutterstock_footage' ? 'Shutterstock_Footage_Metadata' : 'shutterstock_metadata';
          const ssRows: any[] = [];
          for (const f of targetFiles) {
            const ext = (f.fileType || f.filename.split('.').pop() || '').toLowerCase();
            const isVid = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext) || f.fileType === 'video';
            const cat = mapToShutterstockCategory(f.category, f.keywords, isVid);
            
            // Clean description: Shutterstock requires min 5 words, max 200 chars
            let desc = (f.description || f.title || f.filename.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")).trim().replace(/[<>{}\r\n]/g, ' ');
            let descWords = desc.split(/\s+/).filter(Boolean);
            if (descWords.length < 5) {
              desc = `${desc} high quality stock footage clip`.trim();
            }
            if (desc.length > 195) {
              desc = desc.slice(0, 195).trim();
            }

            // Clean keywords: Shutterstock requires min 7, max 50 keywords
            let kwList = getCleanKeywordsList(f.keywords || '', 50);
            let kwArr = kwList.split(',').map(k => k.trim()).filter(Boolean);
            if (kwArr.length < 7) {
              const filler = isVid 
                ? ['footage', 'video', 'cinematic', 'b-roll', 'motion', 'clip', 'scene'] 
                : ['photo', 'image', 'commercial', 'asset', 'detail', 'concept', 'view'];
              for (const tag of filler) {
                if (kwArr.length >= 7) break;
                if (!kwArr.includes(tag)) kwArr.push(tag);
              }
              kwList = kwArr.join(',');
            }

            const isFootage = isVid || format === 'shutterstock_footage';
            const isVector = ['eps', 'ai', 'svg'].includes(ext) || f.fileType === 'vector';
            const primaryItem = {
              'Filename': f.filename,
              'Description': desc,
              'Keywords': kwList,
              'Categories': cat,
              'Illustration': isFootage ? 'no' : (isVector ? 'yes' : 'no'),
              'Mature Content': 'no',
              'Editorial': 'no'
            };
            ssRows.push(primaryItem);

            // Also match original filename if different so Shutterstock matches 100% either way!
            if (f.originalFilename && f.originalFilename.trim().toLowerCase() !== f.filename.trim().toLowerCase()) {
              const altItem = {
                'Filename': f.originalFilename,
                'Description': desc,
                'Keywords': kwList,
                'Categories': cat,
                'Illustration': isFootage ? 'no' : (isVector ? 'yes' : 'no'),
                'Mature Content': 'no',
                'Editorial': 'no'
              };
              ssRows.push(altItem);
            }
          }
          data = ssRows;
          break;

        case 'getty':
          // Getty Images / iStock ESP contributor template
          // Headers: file_name, title, description, keywords
          data = targetFiles.map(f => ({
            'file_name': f.filename,
            'title': f.title || '',
            'description': f.description || f.title || '',
            'keywords': getCleanKeywordsList(f.keywords || '', 50)
          }));
          break;

        case 'freepik':
          // Freepik Contributor CSV template
          // Headers: File name, Title, Tags
          data = targetFiles.map(f => ({
            'File name': f.filename,
            'Title': (f.title || f.filename.replace(/\.[^/.]+$/, "")).slice(0, 100),
            'Tags': getCleanKeywordsList(f.keywords || '', 50)
          }));
          break;

        case 'vecteezy':
          // Vecteezy Contributor CSV template
          // Headers: Filename, Title, Description, Keywords
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || f.title || '',
            'Keywords': getCleanKeywordsList(f.keywords || '', 50)
          }));
          break;

        case 'alamy':
          // Alamy Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Caption': f.description || f.title || '',
            'Tags': getCleanKeywordsList(f.keywords || '', 50)
          }));
          break;

        case 'pond5':
          // Pond5 Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': getCleanKeywordsList(f.keywords || '', 50),
            'Category': f.category || 'Technology'
          }));
          break;

        case 'envato':
          // Envato Elements & GraphicRiver template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Tags': getCleanKeywordsList(f.keywords || '', 50),
            'Category': f.category || 'Graphics'
          }));
          break;

        case 'depositphotos':
          // Depositphotos Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': getCleanKeywordsList(f.keywords || '', 50),
            'Category': f.category || 'Technology'
          }));
          break;

        case '123rf':
          // 123RF Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Description': f.description || '',
            'Keywords': getCleanKeywordsList(f.keywords || '', 50)
          }));
          break;

        case 'canva':
          // Canva Contributor template
          data = targetFiles.map(f => ({
            'Filename': f.filename,
            'Title': f.title || '',
            'Tags': getCleanKeywordsList(f.keywords || '', 50),
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

      const isShutterstockExport = format === 'shutterstock' || format === 'shutterstock_footage';
      if (isShutterstockExport) {
        // Strict Shutterstock Contributor CSV specification:
        // 1. Unquoted header line: Filename,Description,Keywords,Categories,Illustration,Mature Content,Editorial
        // 2. Pure UTF-8 WITHOUT Byte Order Mark (BOM) — Shutterstock's backend parser fails on \uFEFF!
        // 3. Filename MUST NOT have quotes around it (quotes cause string mismatch on Shutterstock's server)
        const headerLine = 'Filename,Description,Keywords,Categories,Illustration,Mature Content,Editorial';

        const lines: string[] = [headerLine];
        const seenFilenames = new Set<string>();

        for (const item of data) {
          const fn = String(item.Filename || '').trim();
          const cleanFn = fn.replace(/["'\r\n]/g, '').trim();
          if (!cleanFn || seenFilenames.has(cleanFn.toLowerCase())) continue;
          seenFilenames.add(cleanFn.toLowerCase());

          // Clean description - escape internal quotes with double quotes
          const rawDesc = String(item.Description || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          const desc = `"${rawDesc.replace(/"/g, '""')}"`;

          // Clean keywords - comma-separated, wrapped in quotes
          const rawKw = String(item.Keywords || '').replace(/[\r\n]+/g, ' ').trim();
          const kw = `"${rawKw.replace(/"/g, '""')}"`;

          // Clean category - official single category name (no quotes needed unless comma)
          const cat = String(item.Categories || 'Backgrounds/Textures').trim();

          const ed = item.Editorial === 'yes' ? 'yes' : 'no';
          const mature = item['Mature Content'] === 'yes' ? 'yes' : 'no';
          const ill = item.Illustration === 'yes' ? 'yes' : 'no';

          lines.push(`${cleanFn},${desc},${kw},${cat},${ill},${mature},${ed}`);
        }
        content = lines.join('\r\n');
      } else {
        // Papa.unparse with smart quoting for other platforms
        content = Papa.unparse(data, {
          quotes: (val) => typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')),
          quoteChar: '"',
          escapeChar: '"',
          delimiter: ",",
          header: true,
          newline: "\r\n"
        });
      }
    }

    // Add UTF-8 BOM (\uFEFF) only for generic CSVs to help Microsoft Excel.
    // CRITICAL: Shutterstock strictly rejects UTF-8 BOM (\uFEFF) because it causes column 1 to be misread as \uFEFFFilename!
    const isShutterstockExport = format === 'shutterstock' || format === 'shutterstock_footage';
    const blobContent = (format === 'json' || format === 'txt' || isShutterstockExport) ? content : `\uFEFF${content}`;
    const blob = new Blob([blobContent], { type: mimeType });
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
    const candidateFiles = targetSingleId 
      ? filesRef.current.filter(f => f.id === targetSingleId)
      : filesRef.current.filter(f => {
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
      const typeLabel = type === 'image' ? 'Image (JPG, PNG, WebP)' : type === 'eps' ? 'Vector (EPS, AI, SVG)' : type === 'video' ? 'Video (MP4, MOV)' : 'files';
      showNotification(`No ${typeLabel} found in workspace to embed. Please add ${typeLabel} first.`, 'info');
      return;
    }

    const typeTitle = targetSingleId ? 'Single File' : (type === 'image' ? 'Image' : type === 'eps' ? 'Vector' : type === 'video' ? 'Video' : 'All');

    let activeDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);

    // 2. EXPLICITLY REQUEST AND ENSURE READWRITE PERMISSION UNDER USER CLICK
    let isPermGranted = false;
    if (activeDir) {
      try {
        if (typeof activeDir.requestPermission === 'function') {
          const perm = await activeDir.requestPermission({ mode: 'readwrite' });
          isPermGranted = (perm === 'granted');
        } else if (typeof activeDir.queryPermission === 'function') {
          const q = await activeDir.queryPermission({ mode: 'readwrite' });
          if (q !== 'granted' && typeof activeDir.requestPermission === 'function') {
            const perm = await activeDir.requestPermission({ mode: 'readwrite' });
            isPermGranted = (perm === 'granted');
          } else {
            isPermGranted = (q === 'granted');
          }
        } else {
          isPermGranted = true;
        }
      } catch (pErr) {
        console.warn("Permission request error:", pErr);
      }

      if (isPermGranted) {
        showNotification(`✓ ফোল্ডার "${activeDir.name}" পারমিশন অনুমোদিত (Allow Granted)! সরাসরি আসল ফাইলে মেটাডাটা ও রিনেম সেভ হচ্ছে...`, 'success');
      } else {
        showNotification("⚠️ ফোল্ডারে আসল ফাইল রিনেম ও সেভ করতে ব্রাউজারের 'Allow' পারমিশন দিন!", 'error');
      }
    }

    setEmbedPopup({
      isOpen: true,
      type: targetSingleId ? 'single' : type,
      total: candidateFiles.length,
      current: 1,
      currentFilename: candidateFiles[0].filename,
      status: 'processing',
      inPlaceCount: 0,
      message: `Embedding IPTC, EXIF & XMP and renaming ${candidateFiles.length} file(s)...`,
    });

    let inPlaceCount = 0;
    let renamedDiskCount = 0;
    const embeddedBlobs: { id: string; filename: string; blob: Blob }[] = [];

    for (let i = 0; i < candidateFiles.length; i++) {
      const file = candidateFiles[i];
      setEmbedPopup(prev => ({
        ...prev,
        current: i + 1,
        currentFilename: file.filename,
        message: `Writing IPTC, EXIF & XMP and renaming ${file.filename}...`,
      }));

      // In-place embed & rename
      const res = await saveMetadataToLocalFile(file.id, {}, activeDir, false);

      const finalFilename = res?.filename || file.filename;
      if (res && res.writtenInPlace) {
        inPlaceCount++;
      }
      if (res && res.renamedOnDisk) {
        renamedDiskCount++;
      }
      if (res && res.blob) {
        embeddedBlobs.push({ id: file.id, filename: finalFilename, blob: res.blob });
      }

      setFiles(prev => prev.map(f => f.id === file.id ? { 
        ...f, 
        status: 'saved', 
        filename: finalFilename,
        title: res?.title || f.title,
        description: res?.description || f.description,
        keywords: res?.keywords || f.keywords,
        errorMessage: undefined 
      } : f));

      // Small delay for fluid progress bar animation
      await new Promise(r => setTimeout(r, 40));
    }

    latestEmbeddedBlobsRef.current = embeddedBlobs;

    const allRenamedOnDisk = (renamedDiskCount === candidateFiles.length && inPlaceCount === candidateFiles.length);

    setEmbedPopup(prev => ({
      ...prev,
      current: candidateFiles.length,
      status: 'completed',
      inPlaceCount,
      renamedDiskCount,
      message: inPlaceCount > 0
        ? `Successfully embedded metadata & saved ${inPlaceCount} file(s) directly into original file(s) on disk!`
        : `Successfully embedded metadata for ${candidateFiles.length} file(s)!`,
    }));

    if (inPlaceCount > 0) {
      showNotification(
        `🎉 সফলভাবে ${inPlaceCount}টি মূল ফাইলের ভেতরে সরাসরি মেটাডাটা ও রিনেম সেভ সম্পন্ন হয়েছে! কোন জিপ ডাউনলোড হবে না।`, 
        'success'
      );
    } else {
      showNotification(
        `✓ ${candidateFiles.length}টি ফাইলের মেটাডাটা সফলভাবে প্রস্তুত হয়েছে। ফাইল সরাসরি সেভ করতে 'Open Folder' দিয়ে ফোল্ডার সিলেক্ট করুন।`,
        'success'
      );
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
    // 1. Instantly abort any active vision AI requests and stop loops
    stopRef.current = true;
    if (generationAbortControllerRef.current) {
      try {
        generationAbortControllerRef.current.abort();
      } catch {}
      generationAbortControllerRef.current = null;
    }
    pendingQueueRef.current = [];
    thumbnailAbortRef.current = true;
    setIsGenerating(false);
    setIsPaused(false);

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
      if (mode === 'all') return true;
      if (mode === 'vector') return isVector(f);
      if (mode === 'video') return isVideo(f);
      return !isVector(f) && !isVideo(f);
    });
    const idsToRemove = targetModeFiles.map(f => f.id);
    const idSet = new Set(idsToRemove);
    filesRef.current = filesRef.current.filter(f => !idSet.has(f.id));
    setFiles(prev => prev.filter(f => !idSet.has(f.id)));
    setFileObjects(prev => {
      const newObjs = { ...prev };
      idsToRemove.forEach(id => delete newObjs[id]);
      return newObjs;
    });
    setSelectedFileId(null);
    setDirectoryHandle(null);
    setFolderName('');
    showNotification(`Cleared ${mode.toUpperCase()} files from workspace. Local files remain 100% safe & untouched.`, "info");
  };

  const exportCsv = () => {
    handleExport(selectedExportSite || 'csv');
  };

  const downloadWithMetadata = async (id: string, _forceDownload: boolean = false) => {
    const fileMetadata = files.find(f => f.id === id);
    if (!fileMetadata) return;

    let activeDir = directoryHandleRef.current || directoryHandle || (typeof window !== 'undefined' ? (window as any).__ss_active_dir : null);

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

    const res = await saveMetadataToLocalFile(id, fileMetadata, activeDir, false);
    const newName = res?.filename || fileMetadata.filename;
    setFiles(prev => prev.map(f => f.id === id ? { 
      ...f, 
      filename: newName,
      title: res?.title || f.title,
      description: res?.description || f.description,
      keywords: res?.keywords || f.keywords,
      status: 'saved', 
      errorMessage: undefined 
    } : f));
    if (res && res.writtenInPlace) {
      showNotification(`✓ ${newName} ফাইলে সরাসরি মেটাডাটা সেভ ও নাম রিনেম হয়েছে!`, 'success');
    } else if (activeDir) {
      showNotification(`✓ ${newName} ফাইলে মেটাডাটা আপডেট সম্পন্ন হয়েছে!`, 'success');
    } else {
      showNotification(`✓ ${newName} ফাইলে মেটাডাটা সেট ও নাম রিনেম সম্পন্ন হয়েছে!`, 'success');
    }
  };

  const handleFilesAdded = (fileList: FileList | File[], handlesMap?: Record<string, any>) => {
    const filesArray = Array.from(fileList);
    const isVector = (ext: string) => ['eps', 'ai', 'svg'].includes(ext);
    const isVideo = (ext: string) => ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);
    const isImage = (ext: string) => ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif'].includes(ext);
    
    let vCount = 0;
    let vidCount = 0;
    let imgCount = 0;
    for (const f of filesArray) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (isVector(ext)) vCount++;
      else if (isVideo(ext)) vidCount++;
      else imgCount++;
    }

    // Auto-detect mode: if multiple types exist, choose 'all' so NO files are hidden in the table!
    const activeTypes = (vCount > 0 ? 1 : 0) + (vidCount > 0 ? 1 : 0) + (imgCount > 0 ? 1 : 0);
    if (activeTypes > 1) {
      setMode('all');
    } else if (vCount > 0) {
      setMode('vector');
    } else if (vidCount > 0) {
      setMode('video');
    } else {
      setMode('image');
    }

    const validFiles = filesArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return isImage(ext) || isVector(ext) || isVideo(ext) || Boolean(file.type);
    });

    const candidateFiles = validFiles.length > 0 ? validFiles : filesArray;
    
    // Strict deduplication: Don't import duplicate items if file with same name already exists in workspace
    const existingFileNames = new Set(
      filesRef.current.map(f => (f.originalFilename || f.filename || '').toLowerCase().trim())
    );

    const nonDuplicateFiles: File[] = [];
    for (const f of candidateFiles) {
      const fn = f.name.toLowerCase().trim();
      if (existingFileNames.has(fn)) {
        // Update handle for existing file if new handle provided
        const existing = filesRef.current.find(e => (e.originalFilename || e.filename).toLowerCase().trim() === fn);
        if (existing) {
          if (handlesMap?.[f.name]) {
            fileHandlesRef.current[existing.id] = handlesMap[f.name];
            existing.handle = handlesMap[f.name];
          }
          fileObjectsRef.current[existing.id] = f;
          setFileObjects(prev => ({ ...prev, [existing.id]: f }));
        }
      } else {
        existingFileNames.add(fn);
        nonDuplicateFiles.push(f);
      }
    }

    if (nonDuplicateFiles.length === 0 && candidateFiles.length > 0) {
      setIsLoadingFiles(false);
      showNotification(`ফাইলগুলো ইতিমধ্যেই ওয়ার্কস্পেসে যুক্ত রয়েছে।`, 'info');
      return;
    }

    const filesToProcess = nonDuplicateFiles;
    const totalCount = filesToProcess.length;
    setIsLoadingFiles(true);

    const buildItem = (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const id = Math.random().toString(36).substr(2, 9);
      const isImg = isImage(ext) || (Boolean(file.type) && file.type.startsWith('image/'));
      const isVid = isVideo(ext) || (Boolean(file.type) && file.type.startsWith('video/'));

      let initialPreviewUrl: string | undefined = undefined;
      if (isImg || isVid || ext === 'svg') {
        try {
          initialPreviewUrl = URL.createObjectURL(file);
        } catch {}
      } else if (['eps', 'ai'].includes(ext)) {
        try {
          initialPreviewUrl = generateVectorArtboardThumbnail(file.name, '');
        } catch {}
      }

      const h = handlesMap?.[file.name] || (file as any).handle || undefined;
      if (h) {
        fileHandlesRef.current[id] = h;
      }

      const item: StockMetadata = {
        id,
        filename: file.name,
        originalFilename: file.name,
        initialDiskFilename: file.name,
        currentDiskFilename: file.name,
        title: '',
        description: '',
        keywords: '',
        rating: 5,
        status: 'pending',
        fileType: ext,
        previewUrl: initialPreviewUrl,
        handle: h
      };

      if (isVid) {
        extractVideoThumbnail(file).then(thumb => {
          if (thumb) {
            setFiles(prev => prev.map(item => item.id === id ? { ...item, previewUrl: thumb } : item));
            const target = filesRef.current.find(item => item.id === id);
            if (target) target.previewUrl = thumb;
          }
        }).catch(() => {});
      }

      return { item, file, id };
    };

    // Fast initial slice: Render first 25 items immediately so UI is NEVER blank!
    const initialSlice = filesToProcess.slice(0, 25);
    const initialObjs: Record<string, File> = {};
    const initialItems: StockMetadata[] = [];

    for (const f of initialSlice) {
      const built = buildItem(f);
      initialObjs[built.id] = built.file;
      initialItems.push(built.item);
    }

    Object.assign(fileObjectsRef.current, initialObjs);
    filesRef.current = [...filesRef.current, ...initialItems];
    setFiles(prev => [...prev, ...initialItems]);
    setFileObjects(prev => ({ ...prev, ...initialObjs }));
    setSelectedFileId(prev => prev || initialItems[0]?.id || null);

    if (totalCount <= 25) {
      setIsLoadingFiles(false);
      showNotification(`✓ ${totalCount.toLocaleString()}টি ফাইল সফলভাবে যুক্ত হয়েছে!`, 'success');
      return;
    }

    // Stream remaining files in non-blocking micro-chunks of 30 to maintain buttery smooth 60fps
    let currentIndex = 25;
    const processRemainingChunks = () => {
      if (currentIndex >= totalCount) {
        setIsLoadingFiles(false);
        showNotification(`✓ ${totalCount.toLocaleString()}টি ফাইল সফলভাবে যুক্ত হয়েছে!`, 'success');
        return;
      }

      const nextBatch = filesToProcess.slice(currentIndex, currentIndex + 30);
      currentIndex += 30;

      const chunkObjs: Record<string, File> = {};
      const chunkItems: StockMetadata[] = [];

      for (const f of nextBatch) {
        const built = buildItem(f);
        chunkObjs[built.id] = built.file;
        chunkItems.push(built.item);
      }

      Object.assign(fileObjectsRef.current, chunkObjs);
      filesRef.current = [...filesRef.current, ...chunkItems];
      setFiles(prev => [...prev, ...chunkItems]);
      setFileObjects(prev => ({ ...prev, ...chunkObjs }));

      if (currentIndex < totalCount) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(processRemainingChunks);
        } else {
          setTimeout(processRemainingChunks, 0);
        }
      } else {
        setIsLoadingFiles(false);
        showNotification(`✓ ${totalCount.toLocaleString()}টি ফাইল সফলভাবে যুক্ত হয়েছে!`, 'success');
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(processRemainingChunks);
    } else {
      setTimeout(processRemainingChunks, 0);
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
        isLoadingFiles={isLoadingFiles}
        startGeneration={startGeneration}
        handleStopGeneration={handleStopGeneration}
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
        folderName={folderName}
        directoryHandle={directoryHandle}
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

      {/* Ultra-Slim & Compact Low-Height In-Place Embed Progress Popup */}
      {embedPopup.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-100 pointer-events-auto">
          <div className="w-full max-w-[340px] bg-[#091524]/95 text-slate-100 border border-emerald-500/60 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.7)] py-2 px-3 flex flex-col gap-1.5 animate-in zoom-in-95 duration-100">
            {/* Header Row: Status Icon, Title, Badge, %, Close */}
            <div className="flex items-center justify-between gap-1.5 h-5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                  {embedPopup.status === 'processing' ? (
                    <RefreshCw size={10} className="animate-spin text-emerald-400" />
                  ) : (
                    <CheckCircle2 size={11} className="text-emerald-400" />
                  )}
                </div>
                <span className="font-bold text-[11px] text-white truncate">
                  {embedPopup.status === 'processing' 
                    ? 'Embedding metadata...' 
                    : ((embedPopup.renamedDiskCount || 0) >= embedPopup.total && embedPopup.inPlaceCount > 0 
                        ? 'Renamed & Embedded In-Place!' 
                        : 'Embedded & Renamed (Ready!)')}
                </span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-mono font-bold tracking-tight shrink-0">
                  {(embedPopup.renamedDiskCount || 0) >= embedPopup.total && embedPopup.inPlaceCount > 0 ? 'DISK RENAMED' : 'RENAMED & EMBEDDED'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono font-bold text-emerald-400 text-[10.5px]">
                  {Math.round(((embedPopup.current) / Math.max(1, embedPopup.total)) * 100)}%
                </span>
                <button 
                  type="button"
                  onClick={() => setEmbedPopup(prev => ({ ...prev, isOpen: false }))}
                  className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Ultra-Slim 3px Progress Bar */}
            <div className="w-full h-1 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                style={{ width: `${Math.round(((embedPopup.current) / Math.max(1, embedPopup.total)) * 100)}%` }}
              />
            </div>

            {/* Slim Status / Filename Row */}
            <div className="flex items-center justify-between text-[9.5px] gap-2 leading-none">
              <span className="text-slate-300 truncate font-mono flex items-center gap-1 min-w-0">
                <span className="text-emerald-400 font-bold shrink-0">[{embedPopup.current}/{embedPopup.total}]</span>
                <span className="text-slate-200 truncate max-w-[200px]" title={embedPopup.currentFilename}>
                  {embedPopup.currentFilename || 'Processing...'}
                </span>
              </span>
              <span className="text-emerald-400 font-semibold shrink-0">
                {embedPopup.status === 'completed' 
                  ? (embedPopup.inPlaceCount > 0
                      ? `✓ In-Place Saved (${embedPopup.inPlaceCount})` 
                      : `✓ Processed (${embedPopup.total})`) 
                  : 'IPTC/EXIF/XMP'}
              </span>
            </div>

            {/* If completed without direct folder handle, provide instant 1-click solutions */}
            {embedPopup.status === 'completed' && embedPopup.inPlaceCount === 0 && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/60 mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmbedPopup(prev => ({ ...prev, isOpen: false }));
                    handleDirectorySelect();
                  }}
                  className="flex-1 py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Connect your working folder to save directly into your files on disk"
                >
                  <FolderCheck size={11} />
                  <span>Connect Folder (In-Place)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const blobs = latestEmbeddedBlobsRef.current;
                    if (blobs && blobs.length > 0) {
                      if (blobs.length === 1) {
                        triggerDirectFileDownload(blobs[0].blob, blobs[0].filename);
                      } else {
                        const zip = new JSZip();
                        for (const b of blobs) {
                          zip.file(b.filename, b.blob);
                        }
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        triggerDirectFileDownload(zipBlob, `SS_SMART_META_Renamed_${Date.now()}.zip`);
                      }
                      showNotification("✓ Renamed files downloaded!", "success");
                    }
                  }}
                  className="py-1 px-2.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                  title="Download all renamed files with embedded metadata"
                >
                  <Download size={11} />
                  <span>Download (.ZIP)</span>
                </button>
              </div>
            )}

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
                {/* Zoom & Scale Controls */}
                <div className="flex items-center gap-1 bg-background/80 rounded border border-border/60 px-1 py-0.5 mr-1">
                  <button
                    onClick={() => setPreviewZoom(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewZoom(1)}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                      previewZoom === 1 ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="100% Scale / Actual View"
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setPreviewZoom(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>

                {['eps', 'ai', 'svg'].includes((previewModalFile.fileType || '').toLowerCase()) && (
                  <button 
                    onClick={async () => {
                      const fObj = fileObjects[previewModalFile.id] || fileObjectsRef.current[previewModalFile.id];
                      if (!fObj) return;
                      showNotification("Rendering high-definition vector preview...", "info");
                      const thumb = await extractEpsThumbnail(fObj, false);
                      if (thumb) {
                        setFiles(prev => prev.map(f => f.id === previewModalFile.id ? { ...f, previewUrl: thumb } : f));
                        const target = filesRef.current.find(f => f.id === previewModalFile.id);
                        if (target) target.previewUrl = thumb;
                        showNotification("✓ Vector preview updated successfully!", "success");
                      }
                    }}
                    className="p-1.5 hover:bg-amber-500/10 rounded text-amber-500 dark:text-amber-400 hover:text-amber-300 transition-all cursor-pointer border border-amber-500/30 flex items-center gap-1 text-[10px] font-bold"
                    title="Re-render high-definition vector preview"
                  >
                    <RefreshCw size={13} />
                    <span className="hidden sm:inline">Render</span>
                  </button>
                )}

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
              <div className="w-full bg-slate-950/95 rounded-md border border-border/80 flex items-center justify-center p-4 min-h-[300px] max-h-[500px] overflow-auto custom-scrollbar relative">
                {(() => {
                  const fObj = fileObjects[previewModalFile.id] || fileObjectsRef.current[previewModalFile.id];
                  const ext = (previewModalFile.fileType || previewModalFile.filename.split('.').pop() || '').toLowerCase();
                  const isVid = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);
                  const isPlayableVid = ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
                  const previewSrc = previewModalFile.previewUrl || (fObj ? URL.createObjectURL(fObj) : undefined);

                  if (!previewSrc && !fObj) {
                    return (
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
                        <FileText size={56} className="stroke-1 text-muted-foreground/60" />
                        <span className="text-xs uppercase tracking-widest font-bold">No visual preview available</span>
                      </div>
                    );
                  }

                  if (isVid) {
                    const isStaticPoster = previewModalFile.previewUrl && previewModalFile.previewUrl.startsWith('data:image/');
                    const videoSrc = fObj ? URL.createObjectURL(fObj) : (isStaticPoster ? undefined : previewModalFile.previewUrl);

                    const formatTime = (secs: number) => {
                      if (isNaN(secs) || secs < 0) return '00:00';
                      const m = Math.floor(secs / 60);
                      const s = Math.floor(secs % 60);
                      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    };

                    if (videoSrc && isPlayableVid) {
                      return (
                        <div className="flex flex-col items-center justify-center max-h-[480px] w-full relative">
                          <video 
                            id="active-preview-video"
                            ref={previewVideoRef}
                            src={videoSrc} 
                            poster={isStaticPoster ? previewModalFile.previewUrl : undefined}
                            controls 
                            autoPlay 
                            muted 
                            playsInline 
                            onTimeUpdate={(e) => {
                              const v = e.currentTarget;
                              setVideoCurrentTime(v.currentTime);
                              if (v.duration && !isNaN(v.duration)) setVideoDuration(v.duration);
                            }}
                            className="max-h-[390px] max-w-full rounded shadow-md object-contain bg-black border border-slate-800"
                          />

                          {/* Live Video Control & Frame Capture Bar */}
                          <div className="w-full mt-2.5 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded border border-purple-500/40 flex items-center justify-between gap-2 flex-wrap shadow-md">
                            <div className="flex items-center gap-2 text-purple-200 text-xs">
                              <Film size={14} className="text-purple-400" />
                              <span className="font-bold text-white text-[11px]">Active Scene:</span>
                              <span className="font-mono text-[10px] bg-black/60 px-2 py-0.5 rounded text-purple-300 border border-purple-500/30">
                                ⏱ {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCaptureVideoFrame(false)}
                                className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/50 rounded text-[10.5px] font-bold cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                                title="এই দৃশ্যটিকে টেবিলে মূল থাম্বনেইল হিসেবে সেট করুন"
                              >
                                <Camera size={12} />
                                <span>Set as Thumbnail</span>
                              </button>

                              <button
                                type="button"
                                disabled={isGenerating || previewModalFile.status === 'generating'}
                                onClick={() => handleCaptureVideoFrame(true)}
                                className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-[10.5px] font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                                title="ভিডিওর বর্তমান দৃশ্য থেকে মেটাডাটা তৈরি করুন (Capture Frame & Generate AI)"
                              >
                                <Sparkles size={12} className="text-amber-300" />
                                <span>Capture Frame & Generate AI</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isStaticPoster) {
                      return (
                        <div className="relative flex flex-col items-center justify-center max-h-[460px] max-w-full overflow-auto">
                          <img 
                            src={previewModalFile.previewUrl} 
                            alt={previewModalFile.filename} 
                            style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                            className="max-h-[440px] max-w-full rounded shadow-md object-contain select-none"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/40 flex items-center gap-1 shadow-md z-10">
                            🎬 Video Keyframe Preview ({ext.toUpperCase()})
                            {previewZoom !== 1 && <span className="text-white/80 font-mono ml-1">({Math.round(previewZoom * 100)}%)</span>}
                          </div>
                        </div>
                      );
                    }

                    if (videoSrc) {
                      return (
                        <video 
                          id="active-preview-video"
                          ref={previewVideoRef}
                          src={videoSrc} 
                          controls 
                          className="max-h-[440px] max-w-full rounded shadow-md object-contain"
                        />
                      );
                    }
                  }

                  if (['eps', 'ai'].includes(ext)) {
                    if (previewModalFile.previewUrl) {
                      return (
                        <div className="relative flex flex-col items-center justify-center max-h-[460px] max-w-full overflow-auto w-full custom-scrollbar">
                          <img 
                            src={previewModalFile.previewUrl} 
                            alt={previewModalFile.filename} 
                            style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                            className="max-h-[440px] max-w-full rounded shadow-md object-contain select-none"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1 shadow-md z-10">
                            ✨ Vector Illustration Preview ({ext.toUpperCase()})
                            {previewZoom !== 1 && <span className="text-white/80 font-mono ml-1">({Math.round(previewZoom * 100)}%)</span>}
                          </div>
                        </div>
                      );
                    }
                    if (fObj) {
                      // Trigger extraction immediately
                      extractEpsThumbnail(fObj, false).then(thumb => {
                        if (thumb) {
                          setFiles(prev => prev.map(f => f.id === previewModalFile.id ? { ...f, previewUrl: thumb } : f));
                          const target = filesRef.current.find(f => f.id === previewModalFile.id);
                          if (target) target.previewUrl = thumb;
                        } else {
                          const art = generateVectorArtboardThumbnail(previewModalFile.filename, '') || '';
                          if (art) {
                            setFiles(prev => prev.map(f => f.id === previewModalFile.id ? { ...f, previewUrl: art } : f));
                            const target = filesRef.current.find(f => f.id === previewModalFile.id);
                            if (target) target.previewUrl = art;
                          }
                        }
                      });
                      return (
                        <div className="flex flex-col items-center justify-center text-cyan-400 gap-3 p-8">
                          <RefreshCw size={36} className="animate-spin text-cyan-400" />
                          <span className="text-xs uppercase tracking-widest font-bold text-cyan-300">Rendering Vector Preview...</span>
                          <span className="text-[10px] text-muted-foreground font-medium">Ghostscript high-definition vector rendering in progress</span>
                        </div>
                      );
                    }
                  }

                  return (
                    <div className="relative flex flex-col items-center justify-center max-h-[460px] max-w-full overflow-auto w-full custom-scrollbar">
                      <img 
                        src={previewSrc} 
                        alt={previewModalFile.filename} 
                        style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                        className="max-h-[440px] max-w-full rounded shadow-md object-contain select-none"
                        referrerPolicy="no-referrer"
                      />
                      {previewZoom !== 1 && (
                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-white/20 shadow-md z-10">
                          {Math.round(previewZoom * 100)}%
                        </div>
                      )}
                    </div>
                  );
                })()}
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

                {/* Shutterstock Quick Contributor Helper */}
                <div className="md:col-span-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-300">Shutterstock Match:</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-black/50 text-amber-200 border border-amber-500/30 font-semibold">
                      Category 1: <strong>{mapToShutterstockCategory(previewModalFile.category, previewModalFile.keywords, ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((previewModalFile.fileType || previewModalFile.filename.split('.').pop() || '').toLowerCase()))}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const isVid = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes((previewModalFile.fileType || previewModalFile.filename.split('.').pop() || '').toLowerCase());
                        const cat = mapToShutterstockCategory(previewModalFile.category, previewModalFile.keywords, isVid);
                        const text = `Description: ${previewModalFile.description || previewModalFile.title}\nCategory 1: ${cat}\nKeywords: ${previewModalFile.keywords}`;
                        navigator.clipboard.writeText(text);
                        showNotification("✓ All Shutterstock fields copied!", "success");
                      }}
                      className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                      title="Copy Description, Category & Keywords for Shutterstock"
                    >
                      <Copy size={11} />
                      <span>Copy for Shutterstock</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[10px] font-medium text-muted-foreground">
                Live metadata editing active. Changes are instantly saved.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ext = (previewModalFile.fileType || previewModalFile.filename.split('.').pop() || '').toLowerCase();
                    const isVid = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext);
                    const vid = previewVideoRef.current || (document.getElementById('active-preview-video') as HTMLVideoElement);
                    if (isVid && vid && vid.videoWidth > 0) {
                      handleCaptureVideoFrame(true);
                    } else {
                      regenerateSingleFile(previewModalFile.id);
                    }
                  }}
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
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="সরাসরি মূল ফাইলে মেটাডাটা সেভ ও নাম রিনেম করুন"
                >
                  <FolderCheck size={13} strokeWidth={2.5} />
                  Save In-Place
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
        accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,.gif,.heic,.avif,.eps,.ai,.svg,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv,*/*"
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
