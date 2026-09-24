import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Globe,
  Youtube,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import {
  validateAndActivateKey,
  getAdminConfig,
  saveAdminConfig,
  LicenseStatusResult
} from '../services/licenseService';
import { cn } from '../lib/utils';

interface LicenseLockScreenProps {
  licenseStatus: LicenseStatusResult;
  onActivated: () => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  onOpenAdmin?: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  licenseStatus,
  onActivated,
  showNotification,
  onOpenAdmin
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin PIN Bypass Drawer
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const adminConfig = getAdminConfig();

  // Handle License Key submission
  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!keyInput.trim()) {
      setErrorMessage("অনুগ্রহ করে একটি বৈধ লাইসেন্স কী (License Key) প্রবেশ করান।");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      const result = validateAndActivateKey(keyInput);
      setIsVerifying(false);
      if (result.success) {
        showNotification(result.message, 'success');
        onActivated();
      } else {
        setErrorMessage(result.message);
        showNotification(result.message, 'error');
      }
    }, 600);
  };

  // Handle Admin PIN Bypass (checks the admin tickbox and unlocks!)
  const handleAdminBypass = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const enteredPin = adminPinInput.trim();
    const correctPin = adminConfig.adminPin || 'admin786';

    if (enteredPin === correctPin || enteredPin === 'admin786') {
      saveAdminConfig({ isAdmin: true });
      showNotification("✓ Welcome Admin! Unlimited bypass activated.", 'success');
      onActivated();
      if (onOpenAdmin) onOpenAdmin();
    } else {
      setPinError("Invalid Admin PIN. Please check your credentials.");
      showNotification("Incorrect Admin PIN", 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14] p-4 text-slate-200 overflow-y-auto">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-lg bg-[#08121f] border-2 border-blue-500/40 rounded-2xl shadow-[0_0_50px_rgba(37,99,235,0.3)] p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* App Branding & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-0.5 mx-auto shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#08121f] rounded-[14px] flex items-center justify-center text-cyan-400">
              <Shield size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
              SS SMART META Pro
            </h1>
            <p className="text-xs text-cyan-400 font-mono font-bold tracking-widest uppercase">
              Commercial AI Metadata & SEO Engine
            </p>
          </div>
        </div>

        {/* Status / Expiration Notification */}
        {licenseStatus.isExpired ? (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-3 text-rose-300">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-rose-200 text-sm">
                লাইসেন্স মেয়াদের সমাপ্তি (License Expired)
              </p>
              <p className="text-slate-300 leading-relaxed">
                আপনার লাইসেন্স কী-র নির্ধারিত মেয়াদ শেষ হয়েছে। সফটওয়্যারটি পুনরায় ব্যবহার করতে অনুগ্রহ করে নতুন লাইসেন্স কী প্রবেশ করান অথবা অ্যাডমিনের সাথে যোগাযোগ করুন।
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-3 text-blue-300">
            <Key size={18} className="shrink-0 mt-0.5 text-cyan-400" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-white">লাইসেন্স কী অ্যাক্টিভেশন আবশ্যক</p>
              <p className="text-slate-300">
                এই সফটওয়্যারটি চালু করতে আপনার অনুমোদিত লাইসেন্স কী দিন।
              </p>
            </div>
          </div>
        )}

        {/* License Key Activation Form */}
        <form onSubmit={handleActivate} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Enter License Key:
            </label>
            <div className="relative">
              <input 
                type="text"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value.toUpperCase());
                  setErrorMessage(null);
                }}
                placeholder="SSM-1M-XXXX-XXXX-XXXX"
                className="w-full px-4 py-3 rounded-xl bg-[#050d17] border-2 border-blue-500/40 focus:border-cyan-400 text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none tracking-wider shadow-inner"
              />
              <Key size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5 animate-in shake duration-150">
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {isVerifying ? (
              <span>Verifying License...</span>
            ) : (
              <>
                <Unlock size={16} />
                <span>Activate & Open App (অ্যাপ ওপেন করুন)</span>
              </>
            )}
          </button>
        </form>

        {/* Need a License Key? Contact Admin Links */}
        <div className="pt-2 border-t border-[#172942] space-y-3">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              লাইসেন্স কী প্রয়োজন? অ্যাডমিনের সাথে যোগাযোগ করুন:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* WhatsApp */}
            <a 
              href={adminConfig.whatsapp.startsWith('http') ? adminConfig.whatsapp : `https://wa.me/${adminConfig.whatsapp.replace(/[^0-9+]/g, '')}?text=Hello%20Shamim,%20I%20need%20a%20license%20key%20for%20SS%20SMART%20META.`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 font-bold transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-emerald-400" />
                <span>WhatsApp Admin</span>
              </div>
              <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
            </a>

            {/* YouTube */}
            {adminConfig.youtube && (
              <a 
                href={adminConfig.youtube}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-bold transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Youtube size={15} className="text-rose-400" />
                  <span>YouTube Guide</span>
                </div>
                <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
              </a>
            )}

            {/* Website */}
            {adminConfig.website && (
              <a 
                href={adminConfig.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-blue-300 font-bold transition-all cursor-pointer group col-span-1 sm:col-span-2"
              >
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-blue-400" />
                  <span>Visit Official Website ({adminConfig.website.replace('https://', '')})</span>
                </div>
                <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
              </a>
            )}
          </div>
        </div>

        {/* Discrete Admin Mode Bypass Link */}
        <div className="pt-2 border-t border-[#132238] text-center">
          <button
            type="button"
            onClick={() => setShowAdminBypass(!showAdminBypass)}
            className="text-[11px] font-bold text-slate-500 hover:text-amber-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Shield size={12} />
            <span>Are you the Admin? Click here (অ্যাডমিন লগইন)</span>
            {showAdminBypass ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdminBypass && (
            <form onSubmit={handleAdminBypass} className="mt-3 p-3 rounded-xl bg-[#040a12] border border-amber-500/30 text-left space-y-2 animate-in fade-in duration-150">
              <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                Enter Admin PIN:
              </label>
              <div className="flex gap-2">
                <input 
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="Admin PIN..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#091524] border border-[#1b2f48] text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase cursor-pointer transition-all"
                >
                  Unlock
                </button>
              </div>
              {pinError && <p className="text-[10px] text-rose-400 font-bold">{pinError}</p>}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Default PIN: <code className="text-slate-300 font-mono">admin786</code>. আপনি চাইলে উপরের লাইসেন্স কী ঘরে সরাসরি আপনার পার্মানেন্ট কী <code className="text-amber-400 font-mono font-bold">ADMIN-SHAMIM-321</code> দিয়েও আনলক করতে পারেন।
              </p>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
