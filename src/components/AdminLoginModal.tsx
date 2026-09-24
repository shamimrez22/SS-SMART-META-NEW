import React, { useState } from 'react';
import {
  Layers,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { verifyAdminCredentials, saveAdminConfig } from '../services/licenseService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showNotification
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const enteredUser = username.trim();
    const enteredPass = password.trim();

    if (!enteredUser || !enteredPass) {
      setErrorMsg("ইউজারনেম এবং পাসওয়ার্ড উভয়ই পূরণ করুন।");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const isValid = verifyAdminCredentials(enteredUser, enteredPass);

      if (isValid) {
        saveAdminConfig({ isAdmin: true });
        showNotification("✓ Welcome Shamim! Admin mode unlocked successfully.", "success");
        onSuccess();
        onClose();
        setUsername('');
        setPassword('');
      } else {
        setErrorMsg("ভুল ইউজারনেম বা পাসওয়ার্ড! ডিফল্ট ইউজার: SHAMIM, পাসওয়ার্ড: 321");
        showNotification("Incorrect Admin credentials", "error");
      }
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#081321] border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow & Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)] shrink-0">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Admin Login Access</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase font-mono">
                  Master Security
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                অ্যাডমিন প্যানেলে প্রবেশ করতে আপনার ক্রেডেনশিয়াল দিন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 pt-2 space-y-4">
          {/* Preset Credentials Hint Banner */}
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 flex items-center justify-between text-xs text-blue-200">
            <div className="space-y-0.5">
              <span className="font-bold text-cyan-300 block">👑 Default Master Credentials:</span>
              <span className="text-[11px] text-slate-300">
                User: <strong className="text-white font-mono">SHAMIM</strong> | Pass: <strong className="text-white font-mono">321</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setUsername('SHAMIM');
                setPassword('321');
                setErrorMsg(null);
              }}
              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase cursor-pointer transition-colors"
            >
              Auto-Fill
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 flex items-center gap-2 text-rose-300 text-xs animate-in shake duration-150">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-cyan-400" />
              <span>User Name (ইউজারনেম):</span>
            </label>
            <div className="relative">
              <input 
                type="text"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Enter admin username (e.g. SHAMIM)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050d18] border-2 border-[#1b3452] focus:border-cyan-400 text-sm font-bold text-white placeholder-slate-500 focus:outline-none tracking-wide shadow-inner"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={13} className="text-cyan-400" />
              <span>Password (পাসওয়ার্ড):</span>
            </label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Enter password (e.g. 321)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050d18] border-2 border-[#1b3452] focus:border-cyan-400 text-sm font-bold text-white placeholder-slate-500 focus:outline-none tracking-wider pr-10 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Login to Admin Panel (প্রবেশ করুন)</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#050b14] border-t border-[#122236] text-[11px] text-slate-400 flex items-center justify-between">
          <span>SS SMART META Studio Security</span>
          <span className="text-cyan-400 font-mono font-semibold">v3.5 Admin Portal</span>
        </div>
      </div>
    </div>
  );
};
