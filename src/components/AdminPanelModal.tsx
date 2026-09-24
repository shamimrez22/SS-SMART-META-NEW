import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Key,
  Globe,
  MessageSquare,
  Youtube,
  Mail,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Info,
  Sparkles,
  ExternalLink,
  Lock,
  Unlock,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  RefreshCw,
  Sliders,
  Share2
} from 'lucide-react';
import {
  LicenseDuration,
  LicenseKeyRecord,
  AdminConfig,
  getAdminConfig,
  saveAdminConfig,
  getAllGeneratedKeys,
  generateLicenseKey,
  revokeLicenseKey,
  deleteLicenseKey,
  getDurationDays,
  ADMIN_MASTER_LICENSE_KEY
} from '../services/licenseService';
import { cn } from '../lib/utils';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  onStatusChanged?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  showNotification,
  onStatusChanged
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'admin-mode' | 'generator' | 'contacts' | 'keys-list'>('admin-mode');

  // Admin Config State
  const [config, setConfig] = useState<AdminConfig>(getAdminConfig);
  const [adminUsernameInput, setAdminUsernameInput] = useState('SHAMIM');
  const [adminPasswordInput, setAdminPasswordInput] = useState('321');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(true); // default true when opened from authorized context

  // Key Generator State
  const [selectedDuration, setSelectedDuration] = useState<LicenseDuration>('1m');
  const [customDays, setCustomDays] = useState<number>(33);
  const [clientNote, setClientNote] = useState('');
  const [justGeneratedKey, setJustGeneratedKey] = useState<LicenseKeyRecord | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Generated keys list
  const [keysList, setKeysList] = useState<LicenseKeyRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getAdminConfig();
      setConfig(currentConfig);
      setAdminUsernameInput(currentConfig.adminUsername || 'SHAMIM');
      setAdminPasswordInput(currentConfig.adminPassword || '321');
      setAdminPinInput(currentConfig.adminPin || '321');
      setKeysList(getAllGeneratedKeys());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle Admin Mode checkbox
  const handleToggleAdminMode = (checked: boolean) => {
    const updated = saveAdminConfig({ isAdmin: checked });
    setConfig(updated);
    if (onStatusChanged) onStatusChanged();
    showNotification(
      checked 
        ? "✓ Admin Mode Activated! This computer has unrestricted access without a license." 
        : "Standard Client Mode set. License key will be required.",
      checked ? "success" : "info"
    );
  };

  // Save Contact Links
  const handleSaveContacts = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveAdminConfig({
      website: config.website.trim(),
      whatsapp: config.whatsapp.trim(),
      youtube: config.youtube.trim(),
      email: config.email.trim(),
      developerName: config.developerName.trim(),
      adminPin: adminPinInput.trim() || 'admin786'
    });
    setConfig(updated);
    if (onStatusChanged) onStatusChanged();
    showNotification("✓ Contact channels and admin configuration saved!", "success");
  };

  // Save Admin Login Credentials
  const handleSaveAdminCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsernameInput.trim() || !adminPasswordInput.trim()) {
      showNotification("Username and Password cannot be empty!", "error");
      return;
    }
    const updated = saveAdminConfig({
      adminUsername: adminUsernameInput.trim(),
      adminPassword: adminPasswordInput.trim()
    });
    setConfig(updated);
    if (onStatusChanged) onStatusChanged();
    showNotification("✓ Admin Login credentials updated successfully!", "success");
  };

  // Generate Key
  const handleGenerateKey = () => {
    const customDaysNum = selectedDuration === 'custom' ? Math.max(1, Number(customDays) || 33) : undefined;
    const newRecord = generateLicenseKey(selectedDuration, clientNote, customDaysNum);
    setJustGeneratedKey(newRecord);
    setKeysList(getAllGeneratedKeys());
    if (onStatusChanged) onStatusChanged();
    showNotification(
      `✓ Generated unique ${selectedDuration === 'custom' ? `${customDaysNum} Days` : selectedDuration.toUpperCase()} license key!`,
      "success"
    );
  };

  // Copy Key
  const handleCopyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    showNotification("License key copied to clipboard!", "success");
    setTimeout(() => {
      setCopiedKeyId(null);
    }, 2000);
  };

  // Revoke Key
  const handleRevokeKey = (keyId: string) => {
    revokeLicenseKey(keyId);
    setKeysList(getAllGeneratedKeys());
    if (onStatusChanged) onStatusChanged();
    showNotification("License key revoked successfully!", "info");
  };

  // Delete Key (Permanently terminates and clears from database)
  const handleDeleteKey = (keyId: string) => {
    deleteLicenseKey(keyId);
    setKeysList(getAllGeneratedKeys());
    if (justGeneratedKey && justGeneratedKey.id === keyId) {
      setJustGeneratedKey(null);
    }
    if (onStatusChanged) onStatusChanged();
    showNotification("✓ Expired license key permanently deleted and terminated!", "info");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#08121f] border-2 border-blue-500/40 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.25)] flex flex-col text-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0a1727] border-b border-[#1b2d45] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white uppercase tracking-wider">
                  Admin Control Center
                </h3>
                <span className={cn(
                  "text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full border",
                  config.isAdmin 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                    : "bg-blue-500/20 text-blue-400 border-blue-500/40"
                )}>
                  {config.isAdmin ? "👑 ADMIN BYPASS ON" : "STANDARD CLIENT"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Admin mode toggle • License generator (1M, 6M, 1Y, Lifetime) • Support channels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
            title="Close Admin Panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-5 py-2 bg-[#060e18] border-b border-[#17273a] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('admin-mode')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'admin-mode'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            )}
          >
            <Shield size={14} className={activeTab === 'admin-mode' ? "text-amber-400" : ""} />
            <span>Admin Mode (টিক বক্স)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'generator'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            )}
          >
            <Key size={14} />
            <span>License Generator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'contacts'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            )}
          >
            <Share2 size={14} />
            <span>Contact Links (WhatsApp, YouTube)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keys-list')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'keys-list'
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            )}
          >
            <Clock size={14} />
            <span>Generated Keys Database ({keysList.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-5 md:p-6 overflow-y-auto custom-scrollbar space-y-5 bg-[#08121f]">
          
          {/* TAB 1: ADMIN MODE TICKBOX & STATUS */}
          {activeTab === 'admin-mode' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Big Admin Mode Card with interactive tickbox */}
              <div className="p-5 rounded-xl bg-[#0b1828] border-2 border-amber-500/40 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                      <Shield size={26} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white uppercase tracking-wider">
                        Admin Mode Authorization (অ্যাডমিন মোড টিক বক্স)
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        নিচের টিক বক্সে টিক মার্ক দেওয়া থাকলে এই সফটওয়্যারটি বুঝবে <strong>আপনি স্বয়ং অ্যাডমিন</strong>।
                        আপনার জন্য <strong>কোনো লাইসেন্স কী লাগবে না</strong>, অ্যাপ সরাসরি ওপেন হবে।
                      </p>
                    </div>
                  </div>

                  {/* The Critical Tick Box as requested */}
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-[#07111d] border-2 border-amber-400/50 hover:border-amber-400 cursor-pointer transition-all self-start sm:self-auto shrink-0 shadow-md">
                    <input 
                      type="checkbox"
                      checked={config.isAdmin}
                      onChange={(e) => handleToggleAdminMode(e.target.checked)}
                      className="w-5 h-5 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-amber-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                        ADMIN (আই এম অ্যাডমিন)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {config.isAdmin ? "✓ আনলিমিটেড লাইসেন্স বাইপাস চালু" : "টিক দিয়ে অ্যাডমিন মোড চালু করুন"}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Status Notice Banner */}
                <div className={cn(
                  "p-3 rounded-lg border text-xs flex items-center gap-3",
                  config.isAdmin 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                )}>
                  {config.isAdmin ? (
                    <>
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                      <div>
                        <strong>অ্যাডমিন মোড সক্রিয় আছে:</strong> সাধারণ ব্যবহারকারীদের যখন লাইসেন্স কী দেওয়া হবে কেবল তাদের জন্যই লাইসেন্স কী প্রযোজ্য হবে এবং নির্দিষ্ট মেয়াদে এক্সপায়ার হবে। আপনার কম্পিউটারে এটি সবসময় আনলকড থাকবে।
                      </div>
                    </>
                  ) : (
                    <>
                      <Info size={18} className="text-cyan-400 shrink-0" />
                      <div>
                        <strong>স্ট্যান্ডার্ড মোড সক্রিয়:</strong> এই মুহূর্তে এই কম্পিউটারটি সাধারণ ক্লায়েন্ট হিসেবে কাজ করছে, তাই ভ্যালিড লাইসেন্স কি প্রয়োজন। অ্যাডমিন হিসেবে কাজ করতে উপরের বক্সে টিক দিন।
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Permanent Master Admin License Key Card (ADMIN-SHAMIM-321) */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-amber-950/40 via-[#0e1f36] to-amber-950/30 border-2 border-amber-400/60 space-y-3 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Permanent Master Admin Key (স্থায়ী লাইফটাইম অ্যাডমিন কী)
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/50 uppercase">
                    Only For Admin Shamim
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="w-full flex-1 p-3 rounded-xl bg-[#050b14] border border-amber-500/50 flex items-center justify-between font-mono text-sm sm:text-base font-black text-amber-300 select-all tracking-wider shadow-inner">
                    <span className="text-amber-200">{ADMIN_MASTER_LICENSE_KEY}</span>
                    <span className="text-[10px] uppercase font-sans text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                      Permanent Lifetime
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(ADMIN_MASTER_LICENSE_KEY);
                      showNotification(`✓ Master Admin Key '${ADMIN_MASTER_LICENSE_KEY}' copied to clipboard!`, "success");
                    }}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Copy size={15} />
                    <span>Copy Master Key</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[#07111d] border border-amber-500/20 text-xs text-slate-300 space-y-1">
                  <p>
                    ⚡ এই কী-টি (<strong className="text-amber-300 font-mono font-bold">{ADMIN_MASTER_LICENSE_KEY}</strong>) শুধুমাত্র আপনার (অ্যাডমিন শামীম) ব্যবহারের জন্য স্থায়ীভাবে তৈরি।
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    যেকোনো ডিভাইস বা ব্রাউজারে অ্যাপ ওপেন করে লাইসেন্স ঘরে এই কী দিলে স্বয়ংক্রিয়ভাবে লাইফটাইম অ্যাডমিন মোড অন হয়ে যাবে এবং কোনোদিন মেয়াদ শেষ হবে না।
                  </p>
                </div>
              </div>

              {/* Admin Master Login Credentials (Username & Password) */}
              <div className="p-5 rounded-xl bg-[#091524] border-2 border-cyan-500/40 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-cyan-400" />
                    <span className="text-xs font-black uppercase text-white tracking-wider">
                      Admin Login Credentials (ইউজারনেম ও পাসওয়ার্ড সেটিংস)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                    Logo Click Security
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  টপ হেডার বা এক্সটেনশনের লগোতে ক্লিক করলে এই ইউজারনেম এবং পাসওয়ার্ড চাওয়া হবে। এখান থেকে যেকোনো সময় তা পরিবর্তন করে আপডেট করতে পারেন।
                </p>
                <form onSubmit={handleSaveAdminCredentials} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Admin Username:
                      </label>
                      <input 
                        type="text"
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                        placeholder="SHAMIM"
                        className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1d334e] text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Admin Password:
                      </label>
                      <input 
                        type="text"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="321"
                        className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1d334e] text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      Default: <strong className="text-cyan-300 font-mono">SHAMIM</strong> / <strong className="text-cyan-300 font-mono">321</strong>
                    </span>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      Update Credentials
                    </button>
                  </div>
                </form>
              </div>

              {/* Admin Emergency Passcode Settings */}
              <div className="p-4 rounded-xl bg-[#091524] border border-[#1b2f48] space-y-3">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-cyan-400" />
                  <span className="text-xs font-black uppercase text-white tracking-wider">
                    Admin Emergency PIN (লক স্ক্রিন থেকে বাইপাস করার পাসকোড)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  যদি কখনো অন্য ব্রাউজার বা ডিভাইসে অ্যাপ ওপেন করেন এবং লক স্ক্রিন দেখায়, তখন এই পিনটি দিয়ে যেকোনো সময় অ্যাডমিন হিসেবে আনলক করতে পারবেন।
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 max-w-md">
                  <input 
                    type="text"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    placeholder="Set admin PIN (e.g. admin786)..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#060e19] border border-[#1d334e] text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!adminPinInput.trim()) {
                        showNotification("Admin PIN cannot be empty!", "error");
                        return;
                      }
                      const updated = saveAdminConfig({ adminPin: adminPinInput.trim() });
                      setConfig(updated);
                      showNotification("✓ Admin Emergency PIN updated!", "success");
                    }}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LICENSE KEY GENERATOR */}
          {activeTab === 'generator' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-5 rounded-xl bg-[#0a1727] border-2 border-blue-500/40 space-y-4 shadow-sm">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Key size={16} className="text-blue-400" />
                    <span>Cryptographic License Key Generator (ইউনিক লাইসেন্স কি তৈরি)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    প্রতিটি লাইসেন্স কি সম্পূর্ণ ভিন্ন ও ইউনিক হবে। নির্দিষ্ট মেয়াদ শেষে কি-র কার্যকারিতা স্বয়ংক্রিয়ভাবে শেষ হয়ে যাবে।
                  </p>
                </div>

                {/* Duration Picker: 1 Month, 6 Months, 1 Year, Lifetime */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Select License Validity Period (মেয়াদ নির্বাচন করুন):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { id: '1m', label: '1 Month', days: '30 Days', desc: 'Monthly Plan', color: 'border-blue-500 text-blue-300' },
                      { id: '6m', label: '6 Months', days: '180 Days', desc: 'Semi-Annual', color: 'border-cyan-500 text-cyan-300' },
                      { id: '1y', label: '1 Year', days: '365 Days', desc: 'Annual Pro', color: 'border-emerald-500 text-emerald-300' },
                      { id: 'lifetime', label: 'Lifetime', days: 'Permanent', desc: 'Never Expires', color: 'border-amber-500 text-amber-300' },
                      { id: 'custom', label: 'Custom Days', days: `${customDays} Days`, desc: 'ম্যানুয়াল দিন সেট', color: 'border-purple-500 text-purple-300' },
                    ].map(dur => (
                      <button
                        key={dur.id}
                        type="button"
                        onClick={() => setSelectedDuration(dur.id as LicenseDuration)}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between",
                          selectedDuration === dur.id
                            ? "bg-blue-600/20 border-cyan-400 shadow-md ring-1 ring-cyan-400/50"
                            : "bg-[#060f1c] border-[#182d47] hover:border-slate-600 opacity-80 hover:opacity-100"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-white uppercase">{dur.label}</span>
                            {selectedDuration === dur.id && <CheckCircle2 size={14} className="text-cyan-400" />}
                          </div>
                          <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">{dur.days}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 block">{dur.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Days Input if selected */}
                {selectedDuration === 'custom' && (
                  <div className="p-4 rounded-xl bg-[#091729] border-2 border-cyan-500/60 space-y-2 animate-in fade-in duration-150 shadow-inner">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>Enter Custom Validity Days (ম্যানুয়াল দিন সংখ্যা):</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {customDays} Days Active
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <input 
                        type="number"
                        min="1"
                        max="36500"
                        value={customDays}
                        onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="33"
                        className="w-32 px-3 py-2 rounded-lg bg-[#040b14] border-2 border-cyan-500/70 text-sm font-mono font-black text-cyan-300 focus:outline-none focus:border-cyan-400 shadow-inner"
                      />
                      <span className="text-xs text-slate-300">
                        দিন মেয়াদ হবে (যেমন <strong className="text-cyan-400 font-bold">৩৩ দিন</strong> দিলে ঠিক ৩৩ দিন পর এই লাইসেন্স কি-র মেয়াদ শেষ হবে)।
                      </span>
                    </div>
                  </div>
                )}

                {/* Client Reference / Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Client Name / Order Note (ঐচ্ছিক নাম বা নোট):
                  </label>
                  <input 
                    type="text"
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    placeholder="e.g. Buyer: Jahidul Islam (WhatsApp order #502)"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Sparkles size={16} />
                  <span>Generate Unique License Key Now</span>
                </button>

                {/* Generated Key Result Card */}
                {justGeneratedKey && (
                  <div className="p-4 rounded-xl bg-[#04101d] border-2 border-emerald-500/50 space-y-3 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={15} />
                        <span>License Key Generated Successfully!</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase">
                        {justGeneratedKey.duration === 'lifetime' ? 'Lifetime Access' : `${justGeneratedKey.durationDays} Days`}
                      </span>
                    </div>

                    {/* Key String Box */}
                    <div className="p-3 rounded-lg bg-[#020810] border border-emerald-500/30 flex items-center justify-between gap-3">
                      <span className="font-mono font-black text-sm text-cyan-300 tracking-wider select-all break-all">
                        {justGeneratedKey.key}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(justGeneratedKey.key, justGeneratedKey.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm transition-all"
                      >
                        {copiedKeyId === justGeneratedKey.id ? (
                          <>
                            <Check size={14} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy Key</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Client: <strong className="text-white">{justGeneratedKey.clientName}</strong></span>
                      <span>Created: {new Date(justGeneratedKey.createdAt).toLocaleDateString()}</span>
                      <span>
                        Expires: {justGeneratedKey.duration === 'lifetime' ? 'Never (Lifetime)' : new Date(justGeneratedKey.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT LINKS (WEBSITE, WHATSAPP, YOUTUBE) */}
          {activeTab === 'contacts' && (
            <form onSubmit={handleSaveContacts} className="space-y-4 animate-in fade-in duration-150">
              <div className="p-5 rounded-xl bg-[#0a1727] border-2 border-blue-500/40 space-y-4 shadow-sm">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Share2 size={16} className="text-cyan-400" />
                    <span>Official Support & Contact Channels (কন্টাক্ট লিংকসমূহ)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    এখানে যে লিংক ও নম্বর দেবেন, সেগুলো ক্লায়েন্টদের লক স্ক্রিন ও Contact মডালে সরাসরি প্রদর্শিত হবে।
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WhatsApp Number / Chat Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={14} />
                      <span>WhatsApp Number / Direct Link:</span>
                    </label>
                    <input 
                      type="text"
                      value={config.whatsapp}
                      onChange={(e) => setConfig(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="+8801700000000 or https://wa.me/..."
                      className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      ব্যবহারকারীরা লাইসেন্স কী কিনতে বা রিনিউ করতে এই হোয়াটসঅ্যাপে নক করবে।
                    </span>
                  </div>

                  {/* Website Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe size={14} />
                      <span>Website Link:</span>
                    </label>
                    <input 
                      type="url"
                      value={config.website}
                      onChange={(e) => setConfig(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      আপনার অফিশিয়াল পোর্টাল বা ল্যান্ডিং পেজ লিংক।
                    </span>
                  </div>

                  {/* YouTube Channel / Tutorial Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Youtube size={14} />
                      <span>YouTube Channel / Tutorial Link:</span>
                    </label>
                    <input 
                      type="url"
                      value={config.youtube}
                      onChange={(e) => setConfig(prev => ({ ...prev, youtube: e.target.value }))}
                      placeholder="https://youtube.com/@channel"
                      className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      সফটওয়্যার ব্যবহার ও টিউটোরিয়াল দেখার ইউটিউব লিংক।
                    </span>
                  </div>

                  {/* Official Support Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail size={14} />
                      <span>Support Email:</span>
                    </label>
                    <input 
                      type="email"
                      value={config.email}
                      onChange={(e) => setConfig(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contact@metamaster.app"
                      className="w-full px-3 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      অফিশিয়াল সাপোর্ট মেইল অ্যাড্রেস।
                    </span>
                  </div>
                </div>

                {/* Developer Name */}
                <div className="space-y-1.5 pt-2 border-t border-[#172b44]">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} />
                    <span>Developer / Creator Name:</span>
                  </label>
                  <input 
                    type="text"
                    value={config.developerName}
                    onChange={(e) => setConfig(prev => ({ ...prev, developerName: e.target.value }))}
                    placeholder="Shamim (Developer & Creator)"
                    className="w-full max-w-md px-3 py-2 rounded-lg bg-[#060e19] border border-[#1b314d] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md active:scale-95"
                  >
                    Save Contact Links
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 4: GENERATED KEYS DATABASE */}
          {activeTab === 'keys-list' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    All Generated License Keys ({keysList.length})
                  </h4>
                  <p className="text-xs text-slate-400">
                    এখানে তৈরি হওয়া সমস্ত লাইসেন্স কী ও তাদের মেয়াদ সংরক্ষিত থাকে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(keysList, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ss_meta_licenses_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotification("Exported all license keys!", "success");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0f2138] hover:bg-[#152e4d] border border-[#234267] text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Export JSON Backup
                </button>
              </div>

              {keysList.length === 0 ? (
                <div className="p-8 text-center bg-[#07111d] rounded-xl border border-[#172b43] text-slate-400 space-y-2">
                  <Key size={32} className="mx-auto text-slate-600" />
                  <p className="text-xs">No license keys generated yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('generator')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Generate First Key
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {keysList.map(record => {
                    const isMasterAdmin = record.key === ADMIN_MASTER_LICENSE_KEY;
                    const isExpired = (Date.now() > record.expiresAt && record.duration !== 'lifetime') || record.status === 'revoked';
                    return (
                      <div
                        key={record.id}
                        className={cn(
                          "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                          isMasterAdmin
                            ? "bg-gradient-to-r from-amber-950/40 to-[#0b1726] border-amber-500/60 shadow-md"
                            : isExpired
                            ? "bg-rose-950/50 border-2 border-rose-500/80 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.25)]"
                            : "bg-[#07121e] border-[#182c44] hover:border-blue-500/40"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-mono font-black text-xs select-all",
                              isMasterAdmin ? "text-amber-300 text-sm tracking-wider" : isExpired ? "text-rose-300 tracking-wider" : "text-white"
                            )}>
                              {record.key}
                            </span>
                            {isMasterAdmin ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-xs flex items-center gap-1">
                                👑 MASTER ADMIN (SHAMIM)
                              </span>
                            ) : isExpired ? (
                              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded border bg-rose-600/30 text-rose-200 border-rose-500/80 shadow-xs flex items-center gap-1">
                                ✕ EXPIRED (মেয়াদ শেষ)
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-black uppercase px-2 py-0.2 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                                ✓ ACTIVE
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase",
                              isMasterAdmin
                                ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
                                : isExpired
                                ? "text-rose-300 bg-rose-500/20 border-rose-500/40"
                                : "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                            )}>
                              {record.duration === 'lifetime' ? 'Permanent Lifetime' : `${record.durationDays} Days`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span>Note: <strong className={isMasterAdmin ? "text-amber-200" : isExpired ? "text-rose-200 font-semibold" : "text-slate-300"}>{record.clientName || 'General'}</strong></span>
                            <span>Created: {new Date(record.createdAt).toLocaleDateString()}</span>
                            <span className={isExpired ? "text-rose-400 font-bold" : ""}>
                              {isExpired ? "Expired On: " : "Valid Till: "}
                              {record.duration === 'lifetime' ? 'Permanent Lifetime' : new Date(record.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyKey(record.key, record.id)}
                            className={cn(
                              "p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors",
                              isMasterAdmin
                                ? "bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white border border-amber-500/40"
                                : isExpired
                                ? "bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40"
                                : "bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30"
                            )}
                            title="Copy Key"
                          >
                            {copiedKeyId === record.id ? <Check size={13} /> : <Copy size={13} />}
                            <span className="text-[11px]">Copy</span>
                          </button>

                          {!isMasterAdmin && !isExpired && record.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeKey(record.id)}
                              className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Revoke Key"
                            >
                              <Lock size={13} />
                              <span className="text-[11px]">Revoke</span>
                            </button>
                          )}

                          {isExpired && !isMasterAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(record.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                              title="মেয়াদোত্তীর্ণ কী চিরতরে মুছে দিন (Delete & Terminate)"
                            >
                              <Trash2 size={13} />
                              <span>Delete (মুছে ফেলুন)</span>
                            </button>
                          ) : !isMasterAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(record.id)}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Delete Key"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0a1727] border-t border-[#1b2d45] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>SS SMART META Enterprise License Core v3.5</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase tracking-wider text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
