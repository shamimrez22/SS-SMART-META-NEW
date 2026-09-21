import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Download, 
  Trash2, 
  Star, 
  Maximize2, 
  Tag, 
  FileText, 
  X, 
  Plus,
  Layers,
  Video,
  FileImage,
  CheckCircle2,
  AlertCircle,
  FolderCheck
} from 'lucide-react';
import { StockMetadata } from '../types';
import { cn } from '../lib/utils';

interface AssetInspectorProps {
  file: StockMetadata | null;
  actualFile?: File;
  updateFile: (id: string, metadata: Partial<StockMetadata>) => void;
  regenerateSingleFile: (id: string) => void;
  downloadWithMetadata: (id: string) => void;
  deleteFile: (id: string) => void;
  openPreviewModal: (file: StockMetadata) => void;
  isGenerating?: boolean;
  onClose?: () => void;
}

const CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts/Entertainment',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food/Drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
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
  'Vectors/Illustrations',
  'Vintage'
];

export const AssetInspector: React.FC<AssetInspectorProps> = ({
  file,
  actualFile,
  updateFile,
  regenerateSingleFile,
  downloadWithMetadata,
  deleteFile,
  openPreviewModal,
  isGenerating,
  onClose
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [isRawKeywords, setIsRawKeywords] = useState(false);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <FileText size={22} className="opacity-40" />
        </div>
        <p className="text-xs font-semibold text-foreground">No Asset Selected</p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
          Click any row in the table to inspect high-resolution preview and edit metadata.
        </p>
      </div>
    );
  }

  const tags = (file.keywords || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const handleRemoveTag = (indexToRemove: number) => {
    const updatedTags = tags.filter((_, idx) => idx !== indexToRemove);
    updateFile(file.id, { keywords: updatedTags.join(', ') });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean) return;
    
    // Split by comma if user pasted multiple
    const newItems = clean.split(',').map(s => s.trim()).filter(Boolean);
    const existingSet = new Set(tags.map(t => t.toLowerCase()));
    const toAdd = newItems.filter(item => !existingSet.has(item.toLowerCase()));
    
    if (toAdd.length > 0) {
      const merged = [...tags, ...toAdd];
      updateFile(file.id, { keywords: merged.join(', ') });
    }
    setNewTagInput('');
  };

  const ext = (file.fileType || file.filename.split('.').pop() || '').toLowerCase();
  const isVideo = ['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(ext);
  const isVector = ['eps', 'ai', 'svg'].includes(ext);

  const wordCount = (file.title || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col bg-card text-card-foreground text-xs overflow-hidden">
      {/* Top Header */}
      <div className="px-3 py-2 bg-muted/60 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase shrink-0 border",
            isVector ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
            isVideo ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" :
            "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
          )}>
            {ext.toUpperCase()}
          </span>
          <span className="font-semibold text-foreground truncate text-[11px]" title={file.filename}>
            {file.filename}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => copyToClipboard(file.filename, 'filename')}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Copy Filename"
          >
            {copiedField === 'filename' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Close Inspector"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
        {/* Preview Canvas Stage */}
        <div className="w-full bg-slate-950 rounded border border-slate-700/60 p-1.5 flex flex-col items-center justify-center relative min-h-[150px] max-h-[175px] overflow-hidden group">
          {file.previewUrl ? (
            isVideo ? (
              <video 
                src={actualFile ? URL.createObjectURL(actualFile) : file.previewUrl} 
                controls 
                className="max-h-[145px] max-w-full rounded object-contain"
              />
            ) : (
              <img 
                src={file.previewUrl} 
                alt={file.filename} 
                className="max-h-[145px] max-w-full rounded object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => openPreviewModal(file)}
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4">
              {isVector ? <Layers size={30} className="opacity-60 text-amber-400" /> :
               isVideo ? <Video size={30} className="opacity-60 text-purple-400" /> :
               <FileImage size={30} className="opacity-60 text-blue-400" />}
              <span className="text-[10px] tracking-wider uppercase font-bold text-slate-300">
                {file.status === 'generating' ? 'Extracting Preview...' : 'Vector Artboard Preview'}
              </span>
            </div>
          )}

          {/* Quick full-screen preview button overlay */}
          <button
            onClick={() => openPreviewModal(file)}
            className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/80 hover:bg-black text-white text-[9px] font-bold rounded flex items-center gap-1 backdrop-blur-xs border border-white/20 transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer"
            title="Open High-Resolution Full Preview Modal"
          >
            <Maximize2 size={10} /> Full Preview
          </button>

          {/* Status Badge */}
          <div className="absolute top-1.5 left-1.5">
            <span className={cn(
              "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border shadow-xs flex items-center gap-1 backdrop-blur-xs",
              (file.status === 'completed' || file.status === 'saved') ? "bg-emerald-600 text-white border-emerald-400" :
              (file.status === 'generating' || file.status === 'retrying') ? "bg-blue-600 text-white border-blue-400 animate-pulse" :
              file.status === 'error' ? "bg-red-600 text-white border-red-400" :
              "bg-slate-800 text-slate-200 border-slate-600"
            )}>
              {(file.status === 'completed' || file.status === 'saved') && <CheckCircle2 size={8} />}
              {(file.status === 'generating' || file.status === 'retrying') && <RefreshCw size={8} className="animate-spin" />}
              {file.status === 'error' && <AlertCircle size={8} />}
              {file.status}
            </span>
          </div>
        </div>

        {/* Filename Field */}
        <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/60">
          <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span>FILENAME (ফাইলের নাম)</span>
            <span className="text-[9px] text-slate-400 font-mono lowercase truncate max-w-[150px]">
              {file.fileType}
            </span>
          </label>
          <input
            type="text"
            value={file.filename}
            onChange={(e) => updateFile(file.id, { filename: e.target.value })}
            placeholder="Filename..."
            className="w-full bg-slate-900/90 text-slate-100 border border-slate-700/80 focus:border-blue-500 rounded px-2 py-1 text-xs outline-none font-medium transition-all"
          />
        </div>

        {/* Title Field */}
        <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>TITLE (শিরোনাম)</span>
              <span className="text-[9px] font-bold text-slate-400">
                ({(file.title || '').length} chars / {wordCount} words)
              </span>
            </label>
            <button
              onClick={() => copyToClipboard(file.title, 'title')}
              disabled={!file.title}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              {copiedField === 'title' ? (
                <>
                  <Check size={10} className="text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={10} /> Copy Title
                </>
              )}
            </button>
          </div>
          <textarea
            value={file.title || ''}
            onChange={(e) => updateFile(file.id, { title: e.target.value })}
            placeholder="Enter title for Adobe Stock / Shutterstock..."
            rows={2}
            className="w-full bg-slate-900/90 text-slate-100 border border-slate-700/80 focus:border-blue-500 rounded px-2 py-1 text-xs resize-y outline-none leading-snug transition-all placeholder:text-slate-500 font-semibold"
          />
        </div>

        {/* Keywords Field */}
        <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">
                KEYWORDS (কীওয়ার্ডস)
              </label>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-500/40">
                {tags.length} tags
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRawKeywords(prev => !prev)}
                className="text-[9px] font-bold text-cyan-400 hover:underline cursor-pointer"
              >
                {isRawKeywords ? "Switch to Tags" : "Edit Raw Text"}
              </button>
              <button
                onClick={() => copyToClipboard(file.keywords, 'keywords')}
                disabled={!file.keywords}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {copiedField === 'keywords' ? (
                  <>
                    <Check size={10} className="text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={10} /> Copy All
                  </>
                )}
              </button>
            </div>
          </div>

          {isRawKeywords ? (
            <textarea
              value={file.keywords || ''}
              onChange={(e) => updateFile(file.id, { keywords: e.target.value })}
              placeholder="comma, separated, keywords, stock, photography..."
              rows={3}
              className="w-full bg-slate-900/90 text-slate-100 border border-slate-700/80 focus:border-blue-500 rounded px-2 py-1 text-xs resize-y outline-none leading-snug transition-all placeholder:text-slate-500 font-medium"
            />
          ) : (
            <div className="bg-slate-950/60 border border-slate-700/80 rounded p-1.5 space-y-1.5">
              {/* Tag Cloud with compact height */}
              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 text-slate-100 border border-slate-600/80 rounded text-[10px] font-semibold hover:border-blue-400 group/tag transition-all"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="text-slate-400 hover:text-red-400 rounded p-0.2 transition-colors cursor-pointer"
                      title={`Remove "${tag}"`}
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="text-slate-400 italic text-[10px] py-0.5">
                    No keywords generated yet. Click "Generate AI" below.
                  </span>
                )}
              </div>

              {/* Add Tag Form */}
              <form onSubmit={handleAddTag} className="flex gap-1 pt-1 border-t border-slate-700/60">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Add keyword(s)..."
                  className="flex-1 bg-slate-900 text-slate-100 border border-slate-700 focus:border-blue-500 rounded px-1.5 py-0.5 text-[11px] outline-none"
                />
                <button
                  type="submit"
                  disabled={!newTagInput.trim()}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase flex items-center gap-0.5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus size={10} /> Add
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>DESCRIPTION (বিবরণ)</span>
              <span className="text-[9px] font-bold text-slate-400">
                ({(file.description || '').length} chars)
              </span>
            </label>
            <button
              onClick={() => copyToClipboard(file.description, 'description')}
              disabled={!file.description}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              {copiedField === 'description' ? (
                <>
                  <Check size={10} className="text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={10} /> Copy Desc
                </>
              )}
            </button>
          </div>
          <textarea
            value={file.description || ''}
            onChange={(e) => updateFile(file.id, { description: e.target.value })}
            placeholder="Detailed description for stock agency search engines..."
            rows={2}
            className="w-full bg-slate-900/90 text-slate-100 border border-slate-700/80 focus:border-blue-500 rounded px-2 py-1 text-xs resize-y outline-none leading-snug transition-all placeholder:text-slate-500 font-medium"
          />
        </div>

        {/* Category & Rating Row */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="space-y-1 bg-slate-900/40 p-1.5 rounded border border-slate-700/60">
            <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">
              CATEGORY
            </label>
            <select
              value={file.category || 'Vectors/Illustrations'}
              onChange={(e) => updateFile(file.id, { category: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-medium rounded px-1.5 py-1 outline-none focus:border-blue-500 cursor-pointer h-[28px]"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 bg-slate-900/40 p-1.5 rounded border border-slate-700/60">
            <label className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">
              RATING
            </label>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1 h-[28px] justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => updateFile(file.id, { rating: star })}
                  className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
                  title={`Set ${star} stars`}
                >
                  <Star 
                    size={13} 
                    className={cn(
                      "transition-all",
                      star <= (file.rating || 5) 
                        ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.6)]" 
                        : "text-slate-600 hover:text-amber-300"
                    )} 
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Fixed Action Bar */}
      <div className="p-2.5 bg-slate-900/80 border-t border-slate-700/60 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={() => regenerateSingleFile(file.id)}
          disabled={file.status === 'generating' || file.status === 'retrying'}
          className="flex-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          title="Generate AI Metadata"
        >
          {file.status === 'generating' || file.status === 'retrying' ? (
            <>
              <RefreshCw size={11} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles size={11} />
              <span>{file.title ? 'Regenerate AI' : 'Generate AI'}</span>
            </>
          )}
        </button>

        <button
          onClick={() => downloadWithMetadata(file.id)}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          title="কোনো ডাউনলোড ছাড়াই সরাসরি এই আসল ফাইলে ৫-স্টার মেটাডাটা সেভ করুন"
        >
          <FolderCheck size={12} strokeWidth={2.5} />
          <span>Embed & Save</span>
        </button>

        <button
          onClick={() => deleteFile(file.id)}
          className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded border border-slate-700 hover:border-red-500/40 transition-all cursor-pointer"
          title="Delete this asset"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};
