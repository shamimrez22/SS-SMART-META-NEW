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
  Sparkles,
  Tag,
  Layers,
  User,
  KeyRound
} from 'lucide-react';
import {
  validateAndActivateKey,
  getAdminConfig,
  saveAdminConfig,
  verifyAdminCredentials,
  LicenseStatusResult,
  OFFICIAL_PRICING_PLANS,
  PricingPlan
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

  // View state: 'activate' | 'pricing'
  const [activeTab, setActiveTab] = useState<'activate' | 'pricing'>('activate');

  // Admin Login Bypass Drawer
  const [showAdminBypass, setShowAdminBypass] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
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

  // Handle Admin Login / Bypass (Credentials: SHAMIM / 321 or PIN)
  const handleAdminBypass = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const isCredsValid = verifyAdminCredentials(adminUsernameInput, adminPasswordInput);
    const enteredPin = adminPinInput.trim();
    const isPinValid = enteredPin && (enteredPin === adminConfig.adminPin || enteredPin === '321' || enteredPin === 'admin786');

    if (isCredsValid || isPinValid) {
      saveAdminConfig({ isAdmin: true });
      showNotification("✓ Welcome Admin Shamim! Unlimited access activated.", 'success');
      onActivated();
      if (onOpenAdmin) onOpenAdmin();
    } else {
      setPinError("ভুল ইউজারনেম বা পাসওয়ার্ড! (Default: SHAMIM / 321)");
      showNotification("Incorrect Admin credentials", 'error');
    }
  };

  // WhatsApp order URL helper
  const getWhatsAppOrderUrl = (plan: PricingPlan) => {
    const phone = (adminConfig.whatsapp || '+8801700000000').replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(`Hello Shamim, I want to purchase SS SMART META ${plan.name} (${plan.priceTaka} Taka). Please send me payment details.`);
    return `https://wa.me/${phone}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b14]/95 backdrop-blur-md p-3 md:p-6 text-slate-200 overflow-y-auto">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-2xl bg-[#08121f] border-2 border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] p-5 md:p-7 space-y-5 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* App Branding & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-0.5 mx-auto shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#08121f] rounded-[14px] flex items-center justify-center text-cyan-400">
              <Shield size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
              SS SMART META Pro
            </h1>
            <p className="text-xs text-cyan-400 font-mono font-bold tracking-widest uppercase">
              Commercial AI Metadata & SEO Engine • Developed By Shamim
            </p>
          </div>
        </div>

        {/* Tab Switcher: License Key vs Pricing Plans */}
        <div className="flex rounded-xl bg-[#050c17] p-1 border border-[#172c44]">
          <button
            type="button"
            onClick={() => setActiveTab('activate')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all",
              activeTab === 'activate'
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Key size={14} />
            <span>Enter License Key</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all",
              activeTab === 'pricing'
                ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-md"
                : "text-amber-400 hover:text-amber-300"
            )}
          >
            <Tag size={14} />
            <span>Pricing Plans (মূল্য তালিকা ৳)</span>
          </button>
        </div>

        {/* TAB 1: ACTIVATE KEY */}
        {activeTab === 'activate' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Status / Expiration Notification */}
            {licenseStatus.isExpired ? (
              <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500/60 flex items-start gap-3 text-rose-300 shadow-md">
                <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-200 text-sm">
                    লাইসেন্স মেয়াদের সমাপ্তি (License Expired)
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    আপনার লাইসেন্স কী-র নির্ধারিত মেয়াদ শেষ হয়েছে। সফটওয়্যারটি পুনরায় ব্যবহার করতে অনুগ্রহ করে নতুন লাইসেন্স কী দিন অথবা নিচের <strong>Pricing Plans</strong> দেখে নতুন প্ল্যান নিন।
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-3 text-blue-300">
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
          </div>
        )}

        {/* TAB 2: PRICING PLANS TABLE (1 Month: 199, 6 Months: 500, 1 Year: 900, Lifetime: 1500 Taka) */}
        {activeTab === 'pricing' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-center gap-1.5 text-amber-300">
                <Tag size={16} />
                <span>অফিসিয়াল লাইসেন্স প্রাইসিং ও প্ল্যান তালিকা</span>
              </h3>
              <p className="text-xs text-slate-400">
                আপনার পছন্দের প্ল্যানটি বেছে নিয়ে সরাসরি হোয়াটসঅ্যাপে অর্ডার করুন
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OFFICIAL_PRICING_PLANS.map((plan) => {
                const isLifetime = plan.id === 'lifetime';
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "p-4 rounded-xl border-2 flex flex-col justify-between transition-all relative overflow-hidden shadow-md",
                      isLifetime 
                        ? "bg-gradient-to-br from-[#121c2e] via-[#10223b] to-amber-950/40 border-amber-500/70"
                        : "bg-[#091524] border-[#1b3452] hover:border-cyan-500/60"
                    )}
                  >
                    {isLifetime && (
                      <div className="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded-bl uppercase tracking-wider">
                        Best VIP Value
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                          {plan.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {plan.id === 'lifetime' ? 'স্থায়ী লাইফটাইম' : `${plan.durationDays} দিন মেয়াদ`}
                        </span>
                      </div>

                      {/* Price in Taka */}
                      <div className="flex items-baseline gap-1.5 py-1">
                        <span className={cn(
                          "text-2xl font-black font-mono tracking-tight",
                          isLifetime ? "text-amber-300" : "text-cyan-300"
                        )}>
                          ৳ {plan.priceTaka}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">টাকা</span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    {/* Order Button */}
                    <div className="pt-3 mt-2 border-t border-[#162a42]">
                      <a
                        href={getWhatsAppOrderUrl(plan)}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "w-full py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md",
                          isLifetime
                            ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        )}
                      >
                        <MessageSquare size={14} />
                        <span>Order via WhatsApp (৳ {plan.priceTaka})</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method Notice */}
            <div className="p-3 rounded-xl bg-[#050d18] border border-[#162b45] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>পেমেন্ট মাধ্যম: <strong>bKash / Nagad / Rocket / Bank Transfer</strong></span>
              </span>
              <span className="text-cyan-400 font-bold font-mono">
                {adminConfig.whatsapp || '+8801700000000'}
              </span>
            </div>
          </div>
        )}

        {/* Need a License Key? Contact Admin Links */}
        <div className="pt-2 border-t border-[#172942] space-y-3">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              লাইসেন্স কী বা সাপোর্টের জন্য সরাসরি যোগাযোগ করুন:
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
                <span>WhatsApp Admin ({adminConfig.whatsapp.replace('+', '')})</span>
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
                  <span>YouTube Channel</span>
                </div>
                <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
              </a>
            )}
          </div>
        </div>

        {/* Discrete Admin Mode Login Link */}
        <div className="pt-2 border-t border-[#132238] text-center">
          <button
            type="button"
            onClick={() => setShowAdminBypass(!showAdminBypass)}
            className="text-[11px] font-bold text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers size={13} className="text-cyan-400" />
            <span>Are you the Admin Shamim? Login here (অ্যাডমিন লগইন)</span>
            {showAdminBypass ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdminBypass && (
            <form onSubmit={handleAdminBypass} className="mt-3 p-4 rounded-xl bg-[#040a12] border-2 border-cyan-500/40 text-left space-y-3 animate-in fade-in duration-150 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1.5">
                  <User size={13} />
                  <span>Admin Credentials Login</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  SHAMIM / 321
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Username:
                  </label>
                  <input 
                    type="text"
                    value={adminUsernameInput}
                    onChange={(e) => setAdminUsernameInput(e.target.value)}
                    placeholder="SHAMIM"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#091524] border border-[#1b2f48] text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Password:
                  </label>
                  <input 
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="321"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#091524] border border-[#1b2f48] text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {pinError ? (
                  <p className="text-[11px] text-rose-400 font-bold">{pinError}</p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    বা সরাসরি কী ঘরে <code className="text-amber-400 font-mono font-bold">ADMIN-SHAMIM-321</code> দিন
                  </p>
                )}

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md active:scale-95"
                >
                  Admin Login
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

