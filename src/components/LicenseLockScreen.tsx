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
  Tag,
  Layers,
  User,
  KeyRound,
  Sparkles,
  Zap,
  Check
} from 'lucide-react';
import {
  validateAndActivateKeyAsync,
  getAdminConfig,
  saveAdminConfig,
  verifyAdminCredentials,
  activateDeviceLifetimeLicense,
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

  // View state: 'activate' | 'admin-login' | 'pricing'
  const [activeTab, setActiveTab] = useState<'activate' | 'admin-login' | 'pricing'>('activate');

  // Admin Login Inputs
  const [adminUsernameInput, setAdminUsernameInput] = useState('SHAMIM');
  const [adminPasswordInput, setAdminPasswordInput] = useState('321');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const adminConfig = getAdminConfig();

  // Handle License Key submission
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedKey = keyInput.trim().toUpperCase();
    if (!trimmedKey) {
      setErrorMessage("অনুগ্রহ করে একটি বৈধ লাইসেন্স কী (License Key) প্রবেশ করান।");
      return;
    }

    setIsVerifying(true);
    try {
      const result = await validateAndActivateKeyAsync(trimmedKey);
      setIsVerifying(false);
      if (result.success) {
        showNotification(result.message, 'success');
        onActivated();
      } else {
        setErrorMessage(result.message);
        showNotification(result.message, 'error');
      }
    } catch (err: any) {
      setIsVerifying(false);
      const msg = err?.message || 'Verification error';
      setErrorMessage(msg);
      showNotification(msg, 'error');
    }
  };

  // Handle Admin Login with Username & Password
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);

    const isCredsValid = verifyAdminCredentials(adminUsernameInput, adminPasswordInput);

    if (isCredsValid) {
      saveAdminConfig({ isAdmin: true });
      setIsAdminLoggedIn(true);
      showNotification("✓ Admin access verified! You can now make this app Lifetime or enter.", 'success');
    } else {
      setAdminLoginError("ভুল ইউজারনেম বা পাসওয়ার্ড! (Default Admin: SHAMIM / Password: 321)");
      showNotification("Incorrect Admin credentials", 'error');
    }
  };

  // Handle Admin 1-Click "Make Lifetime Activated"
  const handleMakeLifetime = () => {
    try {
      activateDeviceLifetimeLicense('Master Lifetime Activated Desktop PC');
      saveAdminConfig({ isAdmin: true });
      showNotification("✓ অভিনন্দন! এই কম্পিউটারটিতে পার্মানেন্ট লাইফটাইম অ্যাক্টিভেশন সম্পন্ন হয়েছে।", 'success');
      onActivated();
      if (onOpenAdmin) onOpenAdmin();
    } catch (err: any) {
      showNotification("Activation error: " + (err?.message || 'Failed'), 'error');
    }
  };

  // WhatsApp order URL helper
  const getWhatsAppOrderUrl = (plan: PricingPlan) => {
    const phone = (adminConfig.whatsapp || '+8801700000000').replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(`Hello Shamim, I want to purchase SS SMART META ${plan.name} (${plan.priceTaka} Taka). Please send me payment details.`);
    return `https://wa.me/${phone}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071317]/95 backdrop-blur-md p-3 md:p-6 text-slate-200 overflow-y-auto">
      {/* Background glow effects with #31AAA9 theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#31AAA9]/15 rounded-none blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#31AAA9]/10 rounded-none blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-2xl bg-[#0b1c22] border-2 border-[#31AAA9]/60 rounded-none shadow-[0_0_40px_rgba(49,170,169,0.25)] p-5 md:p-7 space-y-5 animate-in zoom-in-95 duration-150 my-auto">
        
        {/* App Branding & Header */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 bg-[#31AAA9] p-0.5 mx-auto shadow-md flex items-center justify-center rounded-none">
            <div className="w-full h-full bg-[#0b1c22] flex items-center justify-center text-[#31AAA9]">
              <Shield size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
              SS SMART META <span className="text-[#31AAA9]">PRO</span>
            </h1>
            <p className="text-xs text-[#31AAA9] font-mono font-bold tracking-widest uppercase mt-0.5">
              DEVELOPED BY MD.SHAMIM REZA
            </p>
          </div>
        </div>

        {/* Tab Switcher: License Key | Admin Login | Pricing Plans (All strictly SQUARE) */}
        <div className="flex bg-[#061216] p-1 border border-[#1b3c45] rounded-none">
          <button
            type="button"
            onClick={() => setActiveTab('activate')}
            className={cn(
              "flex-1 py-2 rounded-none text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all",
              activeTab === 'activate'
                ? "bg-[#31AAA9] text-black shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Key size={14} />
            <span>Enter License Key</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('admin-login')}
            className={cn(
              "flex-1 py-2 rounded-none text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all",
              activeTab === 'admin-login'
                ? "bg-[#31AAA9] text-black shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            )}
          >
            <User size={14} />
            <span>Admin Login</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={cn(
              "flex-1 py-2 rounded-none text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all",
              activeTab === 'pricing'
                ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-md font-extrabold"
                : "text-amber-400 hover:text-amber-300"
            )}
          >
            <Tag size={14} />
            <span>Pricing Plans (৳)</span>
          </button>
        </div>

        {/* TAB 1: ACTIVATE KEY */}
        {activeTab === 'activate' && (
          <div className="space-y-4 animate-in fade-in duration-100">
            {licenseStatus.isExpired ? (
              <div className="p-3.5 bg-rose-950/40 border-2 border-rose-500/60 flex items-start gap-3 text-rose-300 shadow-md rounded-none">
                <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-200 text-sm">
                    লাইসেন্স মেয়াদের সমাপ্তি (License Expired)
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    আপনার লাইসেন্স কী-র নির্ধারিত মেয়াদ শেষ হয়েছে। পুনরায় ব্যবহার করতে নতুন লাইসেন্স কী প্রবেশ করান অথবা অ্যাডমিনের সাথে যোগাযোগ করুন।
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#0d262e] border border-[#31AAA9]/40 flex items-start gap-3 text-slate-300 rounded-none">
                <Key size={18} className="shrink-0 mt-0.5 text-[#31AAA9]" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-white">লাইসেন্স কী অ্যাক্টিভেশন আবশ্যক (Desktop App)</p>
                  <p className="text-slate-300">
                    এই সফটওয়্যারটি চালু করতে আপনার অনুমোদিত লাইসেন্স কী দিন অথবা অ্যাডমিন লগইন ব্যবহার করুন।
                  </p>
                </div>
              </div>
            )}

            {/* License Key Form */}
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
                    placeholder="SSM-1M-XXXX-XXXX-XXXX or ADMIN KEY"
                    className="w-full px-4 py-3 bg-[#061217] border-2 border-[#31AAA9]/50 focus:border-[#31AAA9] text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none tracking-wider rounded-none"
                  />
                  <Key size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{errorMessage}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 bg-[#31AAA9] hover:bg-[#288e8d] disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer rounded-none active:scale-98"
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

        {/* TAB 2: ADMIN LOGIN (Username & Password with 1-Click Lifetime Activation) */}
        {activeTab === 'admin-login' && (
          <div className="space-y-4 animate-in fade-in duration-100">
            <div className="p-3 bg-[#0d262e] border border-[#31AAA9]/40 flex items-start gap-3 text-slate-300 rounded-none">
              <User size={18} className="shrink-0 mt-0.5 text-[#31AAA9]" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-white">অ্যাডমিন অ্যাক্সেস ও লাইফটাইম আনলকার</p>
                <p className="text-slate-300">
                  অ্যাডমিন ইউজারনেম ও পাসওয়ার্ড দিয়ে ভেতরে প্রবেশ করতে পারেন অথবা এক ক্লিকেই এই কম্পিউটারটিতে সারাজীবনের জন্য লাইফটাইম ফ্রি করে দিতে পারেন।
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Admin Username:
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={adminUsernameInput}
                      onChange={(e) => {
                        setAdminUsernameInput(e.target.value);
                        setAdminLoginError(null);
                      }}
                      placeholder="SHAMIM"
                      className="w-full px-3 py-2 bg-[#061217] border-2 border-[#1b3c45] focus:border-[#31AAA9] text-xs font-mono font-bold text-white placeholder-slate-600 focus:outline-none rounded-none"
                    />
                    <User size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Admin Password:
                  </label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={adminPasswordInput}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setAdminLoginError(null);
                      }}
                      placeholder="321"
                      className="w-full px-3 py-2 bg-[#061217] border-2 border-[#1b3c45] focus:border-[#31AAA9] text-xs font-mono font-bold text-white placeholder-slate-600 focus:outline-none rounded-none"
                    />
                    <KeyRound size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>

              {adminLoginError && (
                <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{adminLoginError}</span>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-[#1b3c45] hover:bg-[#25525e] text-white font-black text-xs uppercase tracking-wider border border-[#31AAA9]/40 flex items-center justify-center gap-1.5 cursor-pointer rounded-none active:scale-98"
                >
                  <Lock size={14} />
                  <span>Verify Credentials</span>
                </button>

                {/* THE LIFETIME ACTIVATOR BUTTON REQUESTED BY USER */}
                <button
                  type="button"
                  onClick={() => {
                    const isCredsValid = verifyAdminCredentials(adminUsernameInput, adminPasswordInput);
                    if (isCredsValid || isAdminLoggedIn) {
                      handleMakeLifetime();
                    } else {
                      setAdminLoginError("ভুল ইউজারনেম বা পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন (Default: SHAMIM / 321)");
                    }
                  }}
                  className="py-2.5 px-4 bg-[#31AAA9] hover:bg-[#288e8d] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer rounded-none active:scale-98 shadow-md"
                >
                  <Sparkles size={14} />
                  <span>Make Lifetime Active (লাইফটাইম করুন)</span>
                </button>
              </div>

              {isAdminLoggedIn && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between gap-3 text-xs text-emerald-300 rounded-none">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>অ্যাডমিন ভেরিফাইড! আনলিমিটেড অ্যাক্সেস রেডি।</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onActivated();
                      if (onOpenAdmin) onOpenAdmin();
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-none uppercase text-[10px]"
                  >
                    Open Workspace
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 3: PRICING PLANS */}
        {activeTab === 'pricing' && (
          <div className="space-y-4 animate-in fade-in duration-100">
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
                      "p-3.5 border-2 flex flex-col justify-between transition-all relative rounded-none shadow-md",
                      isLifetime 
                        ? "bg-[#0f2329] border-amber-500/70"
                        : "bg-[#0b1c22] border-[#1b3c45] hover:border-[#31AAA9]/60"
                    )}
                  >
                    {isLifetime && (
                      <div className="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 uppercase tracking-wider rounded-none">
                        VIP Value
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                          {plan.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-[#31AAA9]/15 text-[#31AAA9] border border-[#31AAA9]/30 rounded-none">
                          {plan.durationLabel}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5 py-0.5">
                        <span className={cn(
                          "text-2xl font-black font-mono tracking-tight",
                          isLifetime ? "text-amber-300" : "text-[#31AAA9]"
                        )}>
                          ৳ {plan.priceTaka}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">টাকা</span>
                        {plan.originalPrice && (
                          <span className="text-xs text-slate-500 line-through ml-1">
                            ৳ {plan.originalPrice}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-300 space-y-0.5">
                        <div className="font-bold text-slate-200">{plan.nameBangla}</div>
                        {plan.features?.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-1.5 text-slate-400 text-[10.5px]">
                            <span className="text-[#31AAA9]">✓</span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 mt-2 border-t border-[#1b3c45]">
                      <a
                        href={getWhatsAppOrderUrl(plan)}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "w-full py-2 px-3 rounded-none text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md",
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

            <div className="p-2.5 bg-[#061217] border border-[#1b3c45] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300 rounded-none">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-none bg-emerald-400 animate-pulse"></span>
                <span>পেমেন্ট মাধ্যম: <strong>bKash / Nagad / Rocket / Bank Transfer</strong></span>
              </span>
              <span className="text-[#31AAA9] font-bold font-mono">
                {adminConfig.whatsapp || '+8801700000000'}
              </span>
            </div>
          </div>
        )}

        {/* Contact Links Strip */}
        <div className="pt-2 border-t border-[#1b3c45] space-y-2">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              লাইসেন্স কী বা সাপোর্টের জন্য সরাসরি যোগাযোগ করুন:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <a 
              href={adminConfig.whatsapp.startsWith('http') ? adminConfig.whatsapp : `https://wa.me/${adminConfig.whatsapp.replace(/[^0-9+]/g, '')}?text=Hello%20Shamim,%20I%20need%20a%20license%20key%20for%20SS%20SMART%20META.`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-2 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 font-bold transition-all cursor-pointer group rounded-none"
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-emerald-400" />
                <span>WhatsApp Admin ({adminConfig.whatsapp.replace('+', '')})</span>
              </div>
              <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
            </a>

            {adminConfig.youtube && (
              <a 
                href={adminConfig.youtube}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-bold transition-all cursor-pointer group rounded-none"
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

        {/* Developer Credit */}
        <div className="pt-1.5 text-center border-t border-[#1b3c45]">
          <span className="text-[11px] font-mono font-black text-[#31AAA9] tracking-widest uppercase">
            DEVELOPED BY MD.SHAMIM REZA
          </span>
        </div>
      </div>
    </div>
  );
};
