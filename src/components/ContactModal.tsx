import React from 'react';
import { X, MessageSquare, Phone, Mail, Globe, Send, User, ExternalLink, Shield } from 'lucide-react';
import { getAdminConfig } from '../services/licenseService';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
  onOpenAdmin?: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  showNotification,
  onOpenAdmin
}) => {
  if (!isOpen) return null;

  const adminConfig = getAdminConfig();
  const whatsappUrl = adminConfig.whatsapp.startsWith('http') 
    ? adminConfig.whatsapp 
    : `https://wa.me/${adminConfig.whatsapp.replace(/[^0-9+]/g, '')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#162232] border border-[#24354a] rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#15202c] border-b border-[#24354a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Contact & Support</h3>
              <p className="text-[11px] text-slate-400">SS SMART META Developer Support</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Developer Card */}
          <div className="p-3 bg-[#1a293c] border border-[#273a50] rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-cyan-600/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-base">
                SR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm">{adminConfig.developerName || "Shamim"}</span>
                <span className="text-[11px] text-cyan-400">Creator & Lead Engineer</span>
                <span className="text-[10px] text-slate-400">SS SMART META Studio</span>
              </div>
            </div>
            {onOpenAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer"
                title="Admin Control"
              >
                <Shield size={11} />
                <span>Admin</span>
              </button>
            )}
          </div>

          {/* Quick Channels */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Direct Channels</span>
            
            {/* WhatsApp */}
            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-emerald-500/40 text-emerald-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">💬</span>
                <div>
                  <div className="font-bold text-white">WhatsApp Direct Chat</div>
                  <div className="text-[10px] text-slate-400">{adminConfig.whatsapp || "Instant answers, feature requests & license keys"}</div>
                </div>
              </div>
              <ExternalLink size={14} className="opacity-60 group-hover:opacity-100" />
            </a>

            {/* Website */}
            {adminConfig.website && (
              <a 
                href={adminConfig.website} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-blue-500/40 text-blue-300 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Globe size={16} className="text-blue-400" />
                  <div>
                    <div className="font-bold text-white">Official Website</div>
                    <div className="text-[10px] text-slate-400">{adminConfig.website}</div>
                  </div>
                </div>
                <ExternalLink size={14} className="opacity-60 group-hover:opacity-100" />
              </a>
            )}

            {/* Email */}
            <div 
              onClick={() => {
                navigator.clipboard.writeText(adminConfig.email || "contact@metamaster.app");
                showNotification("Email copied to clipboard!", "success");
              }}
              className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-[#2f435c] text-slate-200 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-cyan-400" />
                <div>
                  <div className="font-bold text-white">Official Email</div>
                  <div className="text-[10px] text-slate-400">{adminConfig.email || "contact@metamaster.app"}</div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400">Copy</span>
            </div>

            {/* YouTube */}
            {adminConfig.youtube && (
              <a 
                href={adminConfig.youtube} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-rose-500/30 text-rose-300 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-rose-500">▶</span>
                  <div>
                    <div className="font-bold text-white">YouTube Tutorials</div>
                    <div className="text-[10px] text-slate-400">Watch tutorials & metadata workflow guides</div>
                  </div>
                </div>
                <ExternalLink size={14} className="opacity-60 group-hover:opacity-100" />
              </a>
            )}
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-500 border-t border-[#24354a]">
            SS SMART META Desktop v3.5 • All Rights Reserved © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};
