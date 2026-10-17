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
        showNotification("✓ Admin access verified successfully.", "success");
        onSuccess();
        onClose();
        setUsername('');
        setPassword('');
      } else {
        setErrorMsg("ভুল ইউজারনেম বা পাসওয়ার্ড! পুনরায় চেষ্টা করুন।");
        showNotification("Incorrect Admin credentials", "error");
      }
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#08171c] border-2 border-[#31AAA9]/60 rounded-none shadow-[0_0_40px_rgba(49,170,169,0.3)] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow & Accent Bar */}
        <div className="h-1.5 w-full bg-[#31AAA9]" />

        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-none bg-[#31AAA9]/20 border-2 border-[#31AAA9]/50 flex items-center justify-center text-[#31AAA9] shrink-0">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Admin Login Access</span>
                <span className="text-[10px] px-2 py-0.5 rounded-none bg-[#31AAA9]/20 text-[#31AAA9] border border-[#31AAA9]/40 uppercase font-mono">
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
            className="p-1.5 rounded-none text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 pt-2 space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-none bg-rose-950/40 border border-rose-500/50 flex items-center gap-2 text-rose-300 text-xs animate-in shake duration-150">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-[#31AAA9]" />
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
                placeholder="Enter admin username"
                className="w-full px-3.5 py-2.5 rounded-none bg-[#051115] border-2 border-[#1b3c45] focus:border-[#31AAA9] text-sm font-bold text-white placeholder-slate-500 focus:outline-none tracking-wide shadow-inner"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={13} className="text-[#31AAA9]" />
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
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 rounded-none bg-[#051115] border-2 border-[#1b3c45] focus:border-[#31AAA9] text-sm font-bold text-white placeholder-slate-500 focus:outline-none tracking-wider pr-10 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-none"
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
            className="w-full py-3 rounded-none bg-[#31AAA9] hover:bg-[#288e8d] text-black font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
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
        <div className="px-5 py-3 bg-[#051014] border-t border-[#122b32] text-[11px] text-slate-400 flex items-center justify-between">
          <span>SS SMART META Studio Security</span>
          <span className="text-[#31AAA9] font-mono font-semibold">Admin Portal</span>
        </div>
      </div>
    </div>
  );
};
