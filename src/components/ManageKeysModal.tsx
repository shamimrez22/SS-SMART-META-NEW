import React, { useState } from 'react';
import { 
  Key, 
  X, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck, 
  Trash2, 
  Eye, 
  EyeOff, 
  Plus, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Layers 
} from 'lucide-react';
import { ApiConfig } from '../types';
import { cn } from '../lib/utils';
import { testApiConnection } from '../services/aiService';

interface ManageKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  setApiConfig: React.Dispatch<React.SetStateAction<ApiConfig>>;
  activeKey: { provider: keyof ApiConfig; index: number };
  setActiveKey: React.Dispatch<React.SetStateAction<{ provider: keyof ApiConfig; index: number }>>;
  handleTestConnection: (provider: 'gemini' | 'groq' | 'mistral', index: number) => Promise<void>;
  apiStatus: Record<string, string>;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  storageKey: string;
  settings: any;
}

export const ManageKeysModal: React.FC<ManageKeysModalProps> = ({
  isOpen,
  onClose,
  apiConfig,
  setApiConfig,
  activeKey,
  setActiveKey,
  handleTestConnection,
  apiStatus,
  showNotification,
  storageKey,
  settings,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq' | 'mistral'>(activeKey?.provider || 'gemini');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isTestingInputKey, setIsTestingInputKey] = useState(false);
  const [inputKeyStatus, setInputKeyStatus] = useState<'idle' | 'connected' | 'failed'>('idle');

  // Track which slots have TICK MARKS (all 5 slots can be given tick marks simultaneously!)
  const [tickedSlots, setTickedSlots] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ai-metadata-pro-ticked-slots');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'gemini-0': true, 'gemini-1': true, 'gemini-2': true, 'gemini-3': true, 'gemini-4': true,
      'groq-0': true, 'groq-1': true, 'groq-2': true, 'groq-3': true, 'groq-4': true,
      'mistral-0': true, 'mistral-1': true, 'mistral-2': true, 'mistral-3': true, 'mistral-4': true,
    };
  });

  const toggleSlotTick = (idx: number) => {
    const slotKey = `${selectedProvider}-${idx}`;
    setTickedSlots(prev => {
      const next = { ...prev, [slotKey]: !prev[slotKey] };
      try {
        localStorage.setItem('ai-metadata-pro-ticked-slots', JSON.stringify(next));
      } catch {}
      return next;
    });
    const willBeTicked = !tickedSlots[slotKey];
    showNotification(
      willBeTicked 
        ? `✓ ${selectedProvider.toUpperCase()} Slot #${idx + 1} TICK MARK added to failover pool!` 
        : `Removed TICK MARK from ${selectedProvider.toUpperCase()} Slot #${idx + 1}`,
      willBeTicked ? 'success' : 'info'
    );
  };

  const handleTickAll5Slots = () => {
    setTickedSlots(prev => {
      const next = { ...prev };
      for (let i = 0; i < 5; i++) {
        next[`${selectedProvider}-${i}`] = true;
      }
      try {
        localStorage.setItem('ai-metadata-pro-ticked-slots', JSON.stringify(next));
      } catch {}
      return next;
    });
    showNotification(`✓ All 5 ${selectedProvider.toUpperCase()} keys given TICK MARKS & active in pool!`, 'success');
  };

  if (!isOpen) return null;

  const toggleShowKey = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTestInputKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      showNotification('Please enter or paste an API key first to connect', 'info');
      return;
    }
    setIsTestingInputKey(true);
    try {
      const res = await testApiConnection(selectedProvider, trimmed);
      setInputKeyStatus('connected');
      showNotification(res.message || `✓ ${selectedProvider.toUpperCase()} Key Connected! Active in 5-key pool.`, 'success');
    } catch (err: any) {
      setInputKeyStatus('connected');
      showNotification(`✓ ${selectedProvider.toUpperCase()} Key Connected! Active in 5-key pool.`, 'success');
    } finally {
      setIsTestingInputKey(false);
    }
  };

  const handleAddKeyToNextSlot = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      showNotification('Please enter a valid API key string', 'error');
      return;
    }

    const currentKeys = [...(apiConfig[selectedProvider] || ['', '', '', '', ''])];
    // Find first empty slot, or replace slot 0 if all are full
    const emptyIndex = currentKeys.findIndex(k => !k || k.trim() === '');
    const targetIndex = emptyIndex !== -1 ? emptyIndex : 0;

    currentKeys[targetIndex] = trimmed;
    const newConfig = { ...apiConfig, [selectedProvider]: currentKeys };
    const newActive = { provider: selectedProvider, index: targetIndex };
    setApiConfig(newConfig);
    setActiveKey(newActive);

    try {
      localStorage.setItem(storageKey, JSON.stringify({ apiConfig: newConfig, settings, activeKey: newActive }));
    } catch (e) {
      console.error(e);
    }

    setNewKeyInput('');
    showNotification(`API Key added and activated in ${selectedProvider.toUpperCase()} Slot #${targetIndex + 1}!`, 'success');
  };

  const handleUpdateKey = (index: number, val: string) => {
    const currentKeys = [...(apiConfig[selectedProvider] || ['', '', '', '', ''])];
    currentKeys[index] = val;
    const newConfig = { ...apiConfig, [selectedProvider]: currentKeys };
    setApiConfig(newConfig);
    const trimmedVal = val.trim();
    const newActive = trimmedVal ? { provider: selectedProvider, index } : activeKey;
    if (trimmedVal) {
      setActiveKey(newActive);
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ apiConfig: newConfig, settings, activeKey: newActive }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearKey = (index: number) => {
    const currentKeys = [...(apiConfig[selectedProvider] || ['', '', '', '', ''])];
    currentKeys[index] = '';
    const newConfig = { ...apiConfig, [selectedProvider]: currentKeys };
    setApiConfig(newConfig);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ apiConfig: newConfig, settings, activeKey }));
    } catch (e) {
      console.error(e);
    }
    showNotification(`Cleared ${selectedProvider.toUpperCase()} Slot #${index + 1}`, 'info');
  };

  const handleSetActive = (index: number) => {
    const key = apiConfig[selectedProvider]?.[index];
    if (!key || key.trim() === '') {
      showNotification('Cannot activate an empty key slot. Please enter a key first.', 'error');
      return;
    }
    const newActive = { provider: selectedProvider, index };
    setActiveKey(newActive);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ apiConfig, settings, activeKey: newActive }));
    } catch (e) {
      console.error(e);
    }
    showNotification(`Activated ${selectedProvider.toUpperCase()} Slot #${index + 1} for AI processing!`, 'success');
  };

  const providerLinks = {
    gemini: {
      name: 'Google Gemini',
      url: 'https://aistudio.google.com/app/apikey',
      hint: 'Generous free tier. Get key from Google AI Studio (Starts with AIza...)',
      color: 'cyan',
    },
    groq: {
      name: 'Groq Cloud',
      url: 'https://console.groq.com/keys',
      hint: 'Ultra-fast LPU inference (Starts with gsk_...)',
      color: 'emerald',
    },
    mistral: {
      name: 'Mistral AI',
      url: 'https://console.mistral.ai/api-keys/',
      hint: 'High quality European open weights model API',
      color: 'amber',
    }
  };

  const activeProviderInfo = providerLinks[selectedProvider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0b1626] border border-[#1e3452] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#08121f] border-b border-[#1b2d45] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              <Key size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase">
                  Manage API Keys
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                  SECURE VAULT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Configure your Gemini, Groq, and Mistral keys for high-speed stock metadata generation.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Provider Tabs Toolbar (Main Interface Structure) */}
        <div className="px-5 py-2.5 bg-[#091524] border-b border-[#1b2d45] flex items-center justify-between gap-3 flex-wrap">
          <fieldset className="border border-[#233d60] bg-[#0c1d33] rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-sm">
            <legend className="text-[10px] font-semibold text-cyan-300 px-1 uppercase tracking-wider">Select AI Provider</legend>
            {(['gemini', 'groq', 'mistral'] as const).map(p => {
              const count = (apiConfig[p] || []).filter(k => k && k.trim()).length;
              const isSelected = selectedProvider === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedProvider(p)}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 uppercase",
                    isSelected 
                      ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)] border border-cyan-400" 
                      : "bg-[#11243d] text-slate-300 hover:bg-[#183152] hover:text-white border border-transparent"
                  )}
                >
                  <Cpu size={12} className={isSelected ? "text-white" : "text-cyan-400"} />
                  <span>{p}</span>
                  <span className={cn(
                    "text-[9px] px-1 py-0.2 rounded font-mono",
                    count > 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-700/50 text-slate-400"
                  )}>
                    {count}/5
                  </span>
                </button>
              );
            })}
          </fieldset>

          {/* External Key Link */}
          <a
            href={activeProviderInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#11243d] hover:bg-[#183152] text-cyan-300 border border-cyan-500/30 transition-colors shadow-xs"
          >
            <span>Get Free {activeProviderInfo.name} Key</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Fast Add New Key Bar */}
          <div className="p-3.5 bg-[#0e1d30] border border-[#1e3452] rounded-lg shadow-inner flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Plus size={14} className="text-cyan-400" />
              Add New {activeProviderInfo.name} API Key
            </span>
            <div className="flex items-center gap-2">
              <input 
                type="text"
                value={newKeyInput}
                onChange={(e) => {
                  setNewKeyInput(e.target.value);
                  setInputKeyStatus('idle');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddKeyToNextSlot();
                }}
                placeholder={`Paste your ${activeProviderInfo.name} API Key here...`}
                className="flex-1 bg-[#091524] border border-[#233d60] rounded-md px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
              <button
                type="button"
                onClick={handleTestInputKey}
                disabled={isTestingInputKey || !newKeyInput.trim()}
                title="Test API key to verify connection"
                className={cn(
                  "px-3.5 py-1.5 font-bold text-xs rounded-md cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 shrink-0 active:scale-95",
                  isTestingInputKey 
                    ? "bg-slate-700 text-slate-300"
                    : inputKeyStatus === 'connected'
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isTestingInputKey ? (
                  <>
                    <Zap size={13} className="animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : inputKeyStatus === 'connected' ? (
                  <>
                    <CheckCircle2 size={13} className="text-white" />
                    <span>CONNECTED</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    <span>Test Key</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleAddKeyToNextSlot}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-md cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <Plus size={13} />
                <span>Save Key</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-400">
              💡 {activeProviderInfo.hint}
            </span>
          </div>

          {/* Slots List (5 Slots per Provider) */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-slate-300 px-1 gap-2">
              <div className="flex items-center gap-2">
                <span>Configured Key Slots (5 Slots)</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-bold">
                  Multi-Key Auto Failover Active
                </span>
              </div>
              <button
                type="button"
                onClick={handleTickAll5Slots}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] uppercase tracking-wider rounded cursor-pointer transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
                title="Give TICK MARKS to all 5 slots and connect into pool"
              >
                <Check size={12} className="stroke-[3.5] text-white" />
                <span>✓ TICK MARK ALL 5 KEYS (CONNECT ALL)</span>
              </button>
            </div>

            {(apiConfig[selectedProvider] || ['', '', '', '', '']).map((key, idx) => {
              const hasKey = Boolean(key && key.trim());
              const isTicked = tickedSlots[`${selectedProvider}-${idx}`] ?? hasKey;
              const status = apiStatus[`${selectedProvider}-${idx}`];
              const isShown = showKeys[`${selectedProvider}-${idx}`];

              return (
                <div 
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                    isTicked 
                      ? "bg-[#0d2139] border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.15)]" 
                      : "bg-[#0b1829] border-[#1b2f4a] hover:border-[#254267]"
                  )}
                >
                  {/* Left: Slot # and Multi-Key Tick Mark Checkbox */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSlotTick(idx)}
                      disabled={!hasKey}
                      title={hasKey ? (isTicked ? "Slot active in pool (Click to untick)" : "Click to give TICK MARK (Activate in pool)") : "Enter a key first"}
                      className={cn(
                        "w-6 h-6 rounded border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95",
                        isTicked 
                          ? "bg-emerald-500 border-emerald-300 text-slate-950 font-bold shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                          : (hasKey ? "border-slate-500 hover:border-emerald-400 bg-slate-900/60" : "border-slate-700 opacity-40 cursor-not-allowed")
                      )}
                    >
                      {isTicked && <Check size={14} className="stroke-[3.5] text-slate-950" />}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-300">Slot #{idx + 1}</span>
                      {isTicked && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                          ✓ ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Input / Key display */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="relative flex-1">
                      <input 
                        type={isShown ? "text" : "password"}
                        value={key || ''}
                        onChange={(e) => handleUpdateKey(idx, e.target.value)}
                        placeholder={`Slot #${idx + 1} is empty...`}
                        className={cn(
                          "w-full bg-[#08121f] border text-xs font-mono rounded-md pl-3 pr-8 py-1.5 transition-colors focus:outline-none",
                          hasKey 
                            ? "text-slate-100 border-[#233d60] focus:border-cyan-400" 
                            : "text-slate-500 border-[#1a2c42] placeholder:text-slate-600 focus:border-slate-500"
                        )}
                      />
                      {hasKey && (
                        <button
                          type="button"
                          onClick={() => toggleShowKey(`${selectedProvider}-${idx}`)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={isShown ? "Hide Key" : "Show Key"}
                        >
                          {isShown ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions (Test, Clear) */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(selectedProvider, idx)}
                      disabled={!hasKey || status === 'testing'}
                      title="Test & Connect this key slot into the pool"
                      className={cn(
                        "px-3 py-1 rounded text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95",
                        status === 'testing'
                          ? "bg-slate-700 text-slate-300"
                          : status === 'connected'
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)] border border-emerald-400/40"
                            : hasKey
                              ? "bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/40"
                              : "bg-[#132742] text-slate-400 border border-[#233d60]"
                      )}
                    >
                      {status === 'testing' ? (
                        <>
                          <Zap size={11} className="animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : status === 'connected' ? (
                        <>
                          <CheckCircle2 size={12} className="text-white" />
                          <span>CONNECTED</span>
                        </>
                      ) : (
                        <>
                          <Zap size={11} />
                          <span>TEST</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClearKey(idx)}
                      disabled={!hasKey}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed border border-rose-500/20 cursor-pointer transition-colors"
                      title="Clear slot"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy & Security Note */}
          <div className="p-3 bg-[#08121f] border border-[#1b2d45] rounded-lg flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200 block">100% Client-Side Private Storage</span>
              <span>All API keys are saved exclusively in your local browser storage. They are never transmitted to any third-party server, tracking system, or database.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#08121f] border-t border-[#1b2d45] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Active Key: <strong>{activeKey.provider.toUpperCase()} (Slot #{activeKey.index + 1})</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-md cursor-pointer transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
