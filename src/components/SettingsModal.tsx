import React, { useState, useCallback } from 'react';
import {
  Settings,
  X,
  FileText,
  FileImage,
  Database,
  Check,
  Tag,
  Zap,
  RefreshCw,
  Globe,
  Cpu,
  SlidersHorizontal,
  Bookmark,
  Minus,
  Plus,
  Key,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { GeneratorSettings } from '../types';
import { cn, sanitizeStockFilename } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  setIsManageKeysOpen: (open: boolean) => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  renameAllByTitle: () => void;
  handleApplyAffixesToAllFiles: () => void;
  newKeyword: string;
  setNewKeyword: React.Dispatch<React.SetStateAction<string>>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  setIsManageKeysOpen,
  showNotification,
  renameAllByTitle,
  handleApplyAffixesToAllFiles,
  newKeyword,
  setNewKeyword,
}) => {
  // Dropdown / Accordion state for secondary items
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    marketplace: false,
    aiModel: false,
    imagerRules: false,
    affixes: false,
    autoSync: false,
    savedKeywords: false,
    customPrompt: false,
  });

  const toggleDropdown = useCallback((key: string) => {
    setOpenDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const expandAll = useCallback(() => {
    setOpenDropdowns({
      marketplace: true,
      aiModel: true,
      imagerRules: true,
      affixes: true,
      autoSync: true,
      savedKeywords: true,
      customPrompt: true,
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpenDropdowns({
      marketplace: false,
      aiModel: false,
      imagerRules: false,
      affixes: false,
      autoSync: false,
      savedKeywords: false,
      customPrompt: false,
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full h-full flex flex-col bg-background overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base uppercase tracking-wider text-foreground">
                Application Settings
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Keyword, title & description limits • Modular dropdown configurations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsManageKeysOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Key size={13} />
              <span>Manage Keys</span>
            </button>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-md text-muted-foreground transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider cursor-pointer"
              title="Close settings"
            >
              <X size={18} />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-background">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Quick Vault Access Strip (No bulky API keys inside Settings) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#091527] border border-blue-500/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <Database size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">Multi-Provider API Key Vault</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-500/20 font-mono font-bold">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Google Gemini, Groq Cloud, and Mistral AI keys are managed in the dedicated vault.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageKeysOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-cyan-500/20 cursor-pointer active:scale-95 transition-all self-start sm:self-auto shrink-0"
              >
                <Key size={13} />
                <span>Open Manage Keys Vault</span>
              </button>
            </div>

            {/* PRIMARY CONTROLS (ALWAYS VISIBLE & CLEAN): TITLE, KEYWORDS, DESCRIPTION, CONCURRENCY */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
                    Metadata Generation Word & Tag Limits
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettings(prev => ({
                      ...prev,
                      minTitleWords: 7,
                      maxTitleWords: 15,
                      minDescriptionWords: 20,
                      maxDescriptionWords: 45,
                      minKeywords: 35,
                      maxKeywords: 50,
                      concurrency: 3
                    }));
                    showNotification("Reset word limits to recommended stock defaults!", "info");
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-secondary hover:bg-accent text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Defaults</span>
                </button>
              </div>

              {/* 1. TITLE WORD LENGTH (FULL WIDTH WIDE ROW) */}
              <div className="p-4 rounded-xl bg-[#091527] border-2 border-blue-500/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-500/20 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                      <FileText size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">Title Word Length (টাইটেল শব্দ সংখ্যা)</span>
                        <span className="text-[10px] text-blue-300 font-bold bg-blue-500/10 px-2 py-0.2 rounded border border-blue-400/30">7 - 15 Recommended</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Ensures full titles display without truncation in Adobe Stock and Shutterstock.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-blue-950/80 border border-blue-400/60 text-blue-300 font-mono font-black text-xs self-start sm:self-auto">
                    {settings.minTitleWords} - {settings.maxTitleWords} Words
                  </div>
                </div>

                {/* Range Bar */}
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative flex items-center border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all"
                    style={{
                      marginLeft: `${Math.min(100, ((settings.minTitleWords - 1) / 59) * 100)}%`,
                      width: `${Math.max(4, Math.min(100, ((settings.maxTitleWords - settings.minTitleWords) / 59) * 100))}%`
                    }}
                  />
                </div>

                {/* Long Sliders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Min Title Words */}
                  <div className="p-3 rounded-lg bg-[#060e1a] border border-[#172e4b] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-300 uppercase">Min Words:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minTitleWords: Math.max(1, prev.minTitleWords - 1) }))}
                          className="w-5 h-5 rounded bg-[#132742] hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-[#1e3b63]"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#0a1626] py-0.5 rounded border border-[#1e3b63]">
                          {settings.minTitleWords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minTitleWords: Math.min(prev.maxTitleWords, prev.minTitleWords + 1) }))}
                          className="w-5 h-5 rounded bg-[#132742] hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-[#1e3b63]"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      value={settings.minTitleWords}
                      onChange={(e) => setSettings(prev => ({ ...prev, minTitleWords: Math.min(parseInt(e.target.value), prev.maxTitleWords) }))}
                      className="modern-slider slider-blue w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Max Title Words */}
                  <div className="p-3 rounded-lg bg-[#060e1a] border border-[#172e4b] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-300 uppercase">Max Words:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxTitleWords: Math.max(prev.minTitleWords, prev.maxTitleWords - 1) }))}
                          className="w-5 h-5 rounded bg-[#132742] hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-[#1e3b63]"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#0a1626] py-0.5 rounded border border-[#1e3b63]">
                          {settings.maxTitleWords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxTitleWords: Math.min(60, prev.maxTitleWords + 1) }))}
                          className="w-5 h-5 rounded bg-[#132742] hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-[#1e3b63]"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      value={settings.maxTitleWords}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxTitleWords: Math.max(parseInt(e.target.value), prev.minTitleWords) }))}
                      className="modern-slider slider-blue w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-blue-500/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                  {[
                    { label: '5-10', min: 5, max: 10 },
                    { label: '7-14 (Adobe)', min: 7, max: 14 },
                    { label: '10-18 (Shutterstock)', min: 10, max: 18 },
                    { label: '15-25 (Long)', min: 15, max: 25 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, minTitleWords: p.min, maxTitleWords: p.max }))}
                      className={cn(
                        "text-[10px] font-bold py-0.5 px-2 rounded border cursor-pointer font-mono transition-all",
                        settings.minTitleWords === p.min && settings.maxTitleWords === p.max
                          ? "bg-blue-600 text-white border-blue-400"
                          : "bg-[#081321] text-slate-300 hover:text-white border-[#193354]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. KEYWORD COUNT & DENSITY (FULL WIDTH WIDE ROW) */}
              <div className="p-4 rounded-xl bg-[#06181b] border-2 border-emerald-500/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Tag size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">Keyword Count & Density (কিওয়ার্ড ট্যাগ সংখ্যা - কতটি)</span>
                        <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-400/30">Up to 50 Max</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Microstock engines index up to 50 tags. 40 to 50 tags maximize search traffic.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-400/60 text-emerald-300 font-mono font-black text-xs self-start sm:self-auto">
                    {settings.minKeywords} - {settings.maxKeywords} Tags ({Math.round((settings.maxKeywords / 50) * 100)}% Fill)
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative flex items-center border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${(settings.maxKeywords / 50) * 100}%` }}
                  />
                </div>

                {/* Long Sliders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Min Tags */}
                  <div className="p-3 rounded-lg bg-[#041013] border border-[#0d2d2a] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-300 uppercase">Min Tags:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minKeywords: Math.max(5, prev.minKeywords - 1) }))}
                          className="w-5 h-5 rounded bg-[#092222] hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-emerald-500/30"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#051717] py-0.5 rounded border border-emerald-500/30">
                          {settings.minKeywords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minKeywords: Math.min(prev.maxKeywords, prev.minKeywords + 1) }))}
                          className="w-5 h-5 rounded bg-[#092222] hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-emerald-500/30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="50" 
                      value={settings.minKeywords}
                      onChange={(e) => setSettings(prev => ({ ...prev, minKeywords: Math.min(parseInt(e.target.value), prev.maxKeywords) }))}
                      className="modern-slider slider-emerald w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Max Tags */}
                  <div className="p-3 rounded-lg bg-[#041013] border border-[#0d2d2a] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-300 uppercase">Max Tags:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxKeywords: Math.max(prev.minKeywords, prev.maxKeywords - 1) }))}
                          className="w-5 h-5 rounded bg-[#092222] hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-emerald-500/30"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#051717] py-0.5 rounded border border-emerald-500/30">
                          {settings.maxKeywords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxKeywords: Math.min(50, prev.maxKeywords + 1) }))}
                          className="w-5 h-5 rounded bg-[#092222] hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-emerald-500/30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="50" 
                      value={settings.maxKeywords}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxKeywords: Math.max(parseInt(e.target.value), prev.minKeywords) }))}
                      className="modern-slider slider-emerald w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                  {[
                    { label: '25-35', min: 25, max: 35 },
                    { label: '35-45', min: 35, max: 45 },
                    { label: '40-50 (Adobe Pro)', min: 40, max: 50 },
                    { label: '50-50 (100% Full)', min: 50, max: 50 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, minKeywords: p.min, maxKeywords: p.max }))}
                      className={cn(
                        "text-[10px] font-bold py-0.5 px-2 rounded border cursor-pointer font-mono transition-all",
                        settings.minKeywords === p.min && settings.maxKeywords === p.max
                          ? "bg-emerald-600 text-white border-emerald-400"
                          : "bg-[#061517] text-slate-300 hover:text-white border-[#123e3c]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. DESCRIPTION WORD RANGE (FULL WIDTH WIDE ROW) */}
              <div className="p-4 rounded-xl bg-[#091724] border-2 border-cyan-500/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                      <Layers size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">Description Word Range (বর্ণনা শব্দ সংখ্যা)</span>
                        <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.2 rounded border border-cyan-400/30">Context Depth</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Controls summary and caption depth for agencies indexing descriptions.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/60 text-cyan-300 font-mono font-black text-xs self-start sm:self-auto">
                    {settings.minDescriptionWords} - {settings.maxDescriptionWords} Words
                  </div>
                </div>

                {/* Sliders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-[#05101a] border border-[#12283e] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-cyan-300 uppercase">Min Words:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minDescriptionWords: Math.max(5, prev.minDescriptionWords - 1) }))}
                          className="w-5 h-5 rounded bg-[#0e2439] hover:bg-cyan-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-cyan-500/30"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#071725] py-0.5 rounded border border-cyan-500/30">
                          {settings.minDescriptionWords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, minDescriptionWords: Math.min(prev.maxDescriptionWords, prev.minDescriptionWords + 1) }))}
                          className="w-5 h-5 rounded bg-[#0e2439] hover:bg-cyan-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-cyan-500/30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="150" 
                      value={settings.minDescriptionWords}
                      onChange={(e) => setSettings(prev => ({ ...prev, minDescriptionWords: Math.min(parseInt(e.target.value), prev.maxDescriptionWords) }))}
                      className="modern-slider slider-cyan w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-[#05101a] border border-[#12283e] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-cyan-300 uppercase">Max Words:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxDescriptionWords: Math.max(prev.minDescriptionWords, prev.maxDescriptionWords - 1) }))}
                          className="w-5 h-5 rounded bg-[#0e2439] hover:bg-cyan-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-cyan-500/30"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-9 text-center font-mono font-black text-xs text-white bg-[#071725] py-0.5 rounded border border-cyan-500/30">
                          {settings.maxDescriptionWords}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, maxDescriptionWords: Math.min(150, prev.maxDescriptionWords + 1) }))}
                          className="w-5 h-5 rounded bg-[#0e2439] hover:bg-cyan-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer border border-cyan-500/30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="150" 
                      value={settings.maxDescriptionWords}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxDescriptionWords: Math.max(parseInt(e.target.value), prev.minDescriptionWords) }))}
                      className="modern-slider slider-cyan w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 4. CONCURRENCY WORKERS (FULL WIDTH WIDE ROW - "KOTOTI") */}
              <div className="p-4 rounded-xl bg-[#140e26] border-2 border-purple-500/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
                      <Cpu size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">Parallel Batch Concurrency (একসাথে কতটি ফাইল প্রসেস হবে - "কতটি")</span>
                        <span className="text-[10px] text-purple-300 font-bold bg-purple-500/10 px-2 py-0.2 rounded border border-purple-400/30">Workers</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        1 to 3 workers prevent 429 quota limits; 5 to 10 accelerate bulk batches.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-purple-950/80 border border-purple-400/60 text-purple-300 font-mono font-black text-xs self-start sm:self-auto">
                    {settings.concurrency} {settings.concurrency === 1 ? 'Worker' : 'Parallel Files'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0d091a] border border-[#23153f] space-y-2">
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={settings.concurrency}
                    onChange={(e) => setSettings(prev => ({ ...prev, concurrency: parseInt(e.target.value) || 1 }))}
                    className="modern-slider slider-purple w-full cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Speed:</span>
                    {[
                      { val: 1, label: '1 (Safe Mode)' },
                      { val: 3, label: '3 (Recommended)' },
                      { val: 5, label: '5 (Fast)' },
                      { val: 10, label: '10 (Turbo)' },
                    ].map(speed => (
                      <button
                        key={speed.val}
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, concurrency: speed.val }))}
                        className={cn(
                          "text-[10px] font-bold py-0.5 px-2 rounded border cursor-pointer font-mono transition-all",
                          settings.concurrency === speed.val
                            ? "bg-purple-600 text-white border-purple-400"
                            : "bg-[#140b29] text-slate-300 hover:text-white border-[#271549]"
                        )}
                      >
                        {speed.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* DROPDOWN / ACCORDION SYSTEM FOR ALL OTHER SETTINGS */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-primary" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
                    Advanced Settings (Dropdown System)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground bg-secondary px-2 py-0.5 rounded border border-border transition-colors cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground bg-secondary px-2 py-0.5 rounded border border-border transition-colors cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* DROPDOWN 1: TARGET STOCK AGENCY & PRESETS */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('marketplace')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-blue-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Target Stock Agency & Marketplace Presets
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Calibrate keywords & formatting to Adobe Stock, Shutterstock, Freepik, etc.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                      {settings.marketplace || 'universal'}
                    </span>
                    {openDropdowns.marketplace ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.marketplace && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-4 animate-in slide-in-from-top-1 duration-150">
                    {/* Marketplaces Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {[
                        { id: 'universal', label: 'Universal (All)' },
                        { id: 'adobe', label: 'Adobe Stock' },
                        { id: 'shutterstock', label: 'Shutterstock' },
                        { id: 'freepik', label: 'Freepik / Flaticon' },
                        { id: 'getty', label: 'Getty / iStock' },
                        { id: 'vecteezy', label: 'Vecteezy' },
                        { id: 'pond5', label: 'Pond5' },
                        { id: 'envato', label: 'Envato Elements' },
                        { id: 'depositphotos', label: 'Depositphotos' },
                        { id: '123rf', label: '123RF' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSettings(prev => ({ ...prev, marketplace: m.id as any }));
                            showNotification(`Target agency set to ${m.label}!`, 'success');
                          }}
                          className={cn(
                            "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                            settings.marketplace === m.id
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-secondary/70 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs">{m.label}</span>
                            {settings.marketplace === m.id && <Check size={12} />}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Presets Horizontal Strip */}
                    <div className="pt-2 border-t border-border">
                      <span className="text-[10px] font-black uppercase text-muted-foreground block mb-2">
                        1-Click SEO Version Presets:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { id: 'default', label: 'Universal SEO v2.5', minT: 7, maxT: 15, minD: 20, maxD: 45, minK: 35, maxK: 50 },
                          { id: 'adobe', label: 'Adobe Stock Pro', minT: 7, maxT: 14, minD: 20, maxD: 40, minK: 40, maxK: 50 },
                          { id: 'shutterstock', label: 'Shutterstock Ultra', minT: 10, maxT: 18, minD: 25, maxD: 50, minK: 45, maxK: 50 },
                          { id: 'freepik', label: 'Freepik & Vecteezy Pro', minT: 8, maxT: 16, minD: 20, maxD: 40, minK: 30, maxK: 50 },
                        ].map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setSettings(prev => ({
                                ...prev,
                                promptMode: preset.id as any,
                                minTitleWords: preset.minT,
                                maxTitleWords: preset.maxT,
                                minDescriptionWords: preset.minD,
                                maxDescriptionWords: preset.maxD,
                                minKeywords: preset.minK,
                                maxKeywords: preset.maxK,
                              }));
                              showNotification(`Applied ${preset.label} limits!`, 'success');
                            }}
                            className={cn(
                              "p-2 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer",
                              settings.promptMode === preset.id
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-secondary hover:bg-accent border-border text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span>{preset.label}</span>
                              {settings.promptMode === preset.id && <CheckCircle2 size={12} />}
                            </div>
                            <span className="text-[10px] block font-normal opacity-80 mt-0.5">
                              {preset.minT}-{preset.maxT} words • {preset.minK}-{preset.maxK} tags
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DROPDOWN 2: AI VISION MODEL SELECTION */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('aiModel')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Cpu size={18} className="text-purple-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        AI Vision Model Architecture
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Choose model processing speed, deep visual reasoning, and multimodal pipeline.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {settings.aiModel || 'gemini-2.5-flash'}
                    </span>
                    {openDropdowns.aiModel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.aiModel && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-2 animate-in slide-in-from-top-1 duration-150">
                    {[
                      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'RECOMMENDED', speed: '⚡ Fast (1.2s)', desc: 'Best overall performance, generous quota, and surgical stock accuracy.' },
                      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', tag: 'HIGH QUOTA', speed: '🚀 Ultra Fast (0.8s)', desc: 'Lightweight model ideal for massive batches and rapid processing.' },
                      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', tag: 'NEXT-GEN', speed: '🌟 Balanced (1.5s)', desc: 'Modern multimodal vision pipeline with excellent visual nuances.' },
                      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'DEEP REASONING', speed: '🧠 Thorough (2.1s)', desc: 'Maximum depth for complex conceptual themes, numbers, and signs.' }
                    ].map(model => (
                      <div
                        key={model.id}
                        onClick={() => {
                          setSettings(prev => ({ ...prev, aiModel: model.id as any }));
                          showNotification(`Switched to ${model.name}`, 'info');
                        }}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all",
                          settings.aiModel === model.id
                            ? "bg-purple-600/15 border-purple-500 text-foreground ring-1 ring-purple-500/30 font-bold"
                            : "bg-secondary/60 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{model.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                              {model.tag}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-[10px] font-mono text-muted-foreground">{model.speed}</span>
                          {settings.aiModel === model.id && (
                            <span className="block text-[10px] font-black text-purple-400">ACTIVE</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DROPDOWN 3: AI IMAGER RULES & FILTERS */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('imagerRules')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <FileImage size={18} className="text-emerald-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        AI Imager Rules & Compliance Filters
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Single-token keywords, silhouette mode, transparent backgrounds, prohibited words.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Toggles
                    </span>
                    {openDropdowns.imagerRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.imagerRules && (
                  <div className="p-4 border-t border-border bg-background/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 animate-in slide-in-from-top-1 duration-150">
                    {[
                      { id: 'singleWordKeywords', label: 'Single Word Keywords', desc: 'Output single-token tags only' },
                      { id: 'autoGenerateOnAdd', label: 'Auto-Generate on Add', desc: 'Process immediately when uploaded' },
                      { id: 'silhouette', label: 'Silhouette Mode', desc: 'Optimized for vector shapes' },
                      { id: 'transparentBackground', label: 'Transparent BG', desc: 'Isolate subject metadata' },
                      { id: 'prohibitedWords', label: 'Filter Prohibited', desc: 'Strip trademarked terms' }
                    ].map(option => (
                      <div key={option.id} className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg border border-border">
                        <div className="flex flex-col pr-2">
                          <span className="text-xs font-bold text-foreground">{option.label}</span>
                          <span className="text-[10px] text-muted-foreground">{option.desc}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, [option.id]: !prev[option.id as keyof GeneratorSettings] }))}
                          className={cn(
                            "w-9 h-5 rounded-full transition-all relative border border-border shrink-0 cursor-pointer",
                            settings[option.id as keyof GeneratorSettings] ? "bg-primary border-primary" : "bg-muted"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
                            settings[option.id as keyof GeneratorSettings] ? "left-4.5" : "left-0.5"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DROPDOWN 4: TITLE & KEYWORDS PREFIX / SUFFIX ENGINE */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('affixes')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal size={18} className="text-amber-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Title & Keywords Custom Affixes (Prefix / Suffix Engine)
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Auto-append or prepend custom text or tags to titles and keywords across all files.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {settings.titlePrefix || settings.titleSuffix ? 'Custom Affixes Set' : 'None'}
                    </span>
                    {openDropdowns.affixes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.affixes && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Title Prefix & Suffix */}
                      <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
                        <span className="text-xs font-bold text-foreground">Title Affixes</span>
                        <input
                          type="text"
                          value={settings.titlePrefix || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, titlePrefix: e.target.value }))}
                          placeholder="Prefix (e.g., Aerial view of...)"
                          className="w-full bg-background border border-border text-xs h-8 rounded px-2.5 outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={settings.titleSuffix || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, titleSuffix: e.target.value }))}
                          placeholder="Suffix (e.g., with copy space, 4k...)"
                          className="w-full bg-background border border-border text-xs h-8 rounded px-2.5 outline-none focus:border-primary"
                        />
                      </div>

                      {/* Keywords Prefix & Suffix */}
                      <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
                        <span className="text-xs font-bold text-foreground">Keywords Affixes</span>
                        <input
                          type="text"
                          value={settings.keywordsPrefix || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, keywordsPrefix: e.target.value }))}
                          placeholder="Prefix tags (comma-separated)..."
                          className="w-full bg-background border border-border text-xs h-8 rounded px-2.5 outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={settings.keywordsSuffix || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, keywordsSuffix: e.target.value }))}
                          placeholder="Suffix tags (comma-separated)..."
                          className="w-full bg-background border border-border text-xs h-8 rounded px-2.5 outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-muted-foreground italic">
                        Tip: Affixes are applied automatically during generation or with the button below.
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyAffixesToAllFiles}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-xs"
                      >
                        Apply Affixes to Current Files
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* DROPDOWN 5: AUTOMATIC FILENAME & TITLE SYNCHRONIZATION */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('autoSync')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw size={18} className="text-cyan-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Automatic Filename & Title Synchronization
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Auto-sync filenames with title, select formatting style (Title Case, Hyphenated, Underscore).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {settings.autoSyncFilenameWithTitle !== false ? 'Active' : 'Paused'}
                    </span>
                    {openDropdowns.autoSync ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.autoSync && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
                      <div>
                        <span className="text-xs font-bold text-foreground">Auto-Sync Filename with Title</span>
                        <p className="text-[11px] text-muted-foreground">Updates physical filename when metadata title changes</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, autoSyncFilenameWithTitle: prev.autoSyncFilenameWithTitle === false ? true : false }))}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative border border-border shrink-0 cursor-pointer",
                          settings.autoSyncFilenameWithTitle !== false ? "bg-primary border-primary" : "bg-muted"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
                          settings.autoSyncFilenameWithTitle !== false ? "left-5" : "left-0.5"
                        )} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'exact_title', label: 'Exact Title Case', preview: 'Forest Road.jpg' },
                        { id: 'kebab_case', label: 'Hyphenated (SEO)', preview: 'forest-road.jpg' },
                        { id: 'snake_case', label: 'Underscore', preview: 'forest_road.jpg' },
                      ].map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, filenameFormat: fmt.id as any }))}
                          className={cn(
                            "p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                            (settings.filenameFormat || 'exact_title') === fmt.id
                              ? "bg-primary/10 border-primary text-foreground font-bold shadow-xs"
                              : "bg-secondary/60 hover:bg-secondary border-border text-muted-foreground"
                          )}
                        >
                          <div className="text-xs font-bold">{fmt.label}</div>
                          <span className="text-[10px] font-mono opacity-80 mt-0.5 block">{fmt.preview}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={renameAllByTitle}
                        className="px-3 py-1.5 bg-secondary hover:bg-accent border border-border text-xs font-bold uppercase rounded cursor-pointer transition-all"
                      >
                        Rename All Files by Title Now
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* DROPDOWN 6: SAVED KEYWORDS TAG POOL */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('savedKeywords')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Bookmark size={18} className="text-rose-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Saved Keywords (Persistent Tag Pool)
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Preset tags automatically included in every batch generation.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {settings.savedKeywords?.length || 0} Tags
                    </span>
                    {openDropdowns.savedKeywords ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.savedKeywords && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newKeyword.trim()) {
                            setSettings(prev => ({ ...prev, savedKeywords: [...(prev.savedKeywords || []), newKeyword.trim()] }));
                            setNewKeyword('');
                          }
                        }}
                        placeholder="Add permanent tag (e.g. 2026, 4k background, vector)..."
                        className="flex-1 bg-secondary border border-border text-xs h-9 rounded px-3 outline-none focus:border-primary"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (newKeyword.trim()) {
                            setSettings(prev => ({ ...prev, savedKeywords: [...(prev.savedKeywords || []), newKeyword.trim()] }));
                            setNewKeyword('');
                          }
                        }}
                        className="px-3.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase rounded cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2.5 bg-muted/40 rounded-lg border border-border">
                      {(!settings.savedKeywords || settings.savedKeywords.length === 0) ? (
                        <span className="text-xs text-muted-foreground italic">No saved tags in pool.</span>
                      ) : (
                        settings.savedKeywords.map((kw, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-primary/10 border border-primary/30 px-2 py-0.5 rounded text-xs">
                            <span className="font-semibold text-foreground">{kw}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                setSettings(prev => ({
                                  ...prev,
                                  savedKeywords: (prev.savedKeywords || []).filter((_, i) => i !== idx)
                                }));
                              }}
                              className="text-muted-foreground hover:text-destructive ml-1 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* DROPDOWN 7: CUSTOM GLOBAL AI PROMPT INSTRUCTIONS */}
              <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => toggleDropdown('customPrompt')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Zap size={18} className="text-indigo-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Custom Global AI Prompt Instructions
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Inject custom directives (e.g. emphasize lighting, focus on specific road numbers/years).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                      settings.customPromptEnabled 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    )}>
                      {settings.customPromptEnabled ? 'Active' : 'Disabled'}
                    </span>
                    {openDropdowns.customPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {openDropdowns.customPrompt && (
                  <div className="p-4 border-t border-border bg-background/50 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Enable Custom Instructions</span>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, customPromptEnabled: !prev.customPromptEnabled }))}
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded transition-colors cursor-pointer",
                          settings.customPromptEnabled 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                        )}
                      >
                        {settings.customPromptEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    <textarea 
                      value={settings.customPrompt || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                      placeholder="Add custom prompt instructions here (e.g., 'If visible numbers like 2027 appear, strictly feature them in title and tags')..."
                      className="w-full bg-secondary border border-border text-xs p-3 rounded h-24 outline-none focus:border-primary text-foreground resize-none leading-relaxed"
                    />
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:px-8 bg-muted border-t border-border flex items-center justify-between shrink-0 shadow-inner">
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
            All limits and settings automatically persist in local browser storage
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button 
              onClick={onClose}
              className="px-5 py-2 rounded-md text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all border border-border cursor-pointer"
            >
              Close
            </button>
            <button 
              onClick={() => {
                showNotification("Settings saved successfully!", "success");
                onClose();
              }}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider rounded-md shadow-md cursor-pointer transition-all active:scale-95"
            >
              Done & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
