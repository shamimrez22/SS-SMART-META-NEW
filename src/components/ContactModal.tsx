import React from 'react';
import { X, MessageSquare, Phone, Mail, Globe, Send, User, ExternalLink } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  showNotification: (msg: string, type: 'info' | 'error' | 'success') => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  showNotification
}) => {
  if (!isOpen) return null;

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
          <div className="p-3 bg-[#1a293c] border border-[#273a50] rounded-lg flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-cyan-600/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-base">
              SR
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">Shamim</span>
              <span className="text-[11px] text-cyan-400">Developer & Creator of SS SMART META</span>
              <span className="text-[10px] text-slate-400">Dhaka, Bangladesh</span>
            </div>
          </div>

          {/* Quick Channels */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Direct Channels</span>
            
            {/* WhatsApp */}
            <a 
              href="https://wa.me/+8801700000000" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-emerald-500/40 text-emerald-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">💬</span>
                <div>
                  <div className="font-bold text-white">WhatsApp Direct Chat</div>
                  <div className="text-[10px] text-slate-400">Instant answers, feature requests & support</div>
                </div>
              </div>
              <ExternalLink size={14} className="opacity-60 group-hover:opacity-100" />
            </a>

            {/* Email */}
            <div 
              onClick={() => {
                navigator.clipboard.writeText("contact@metamaster.app");
                showNotification("Email copied to clipboard!", "success");
              }}
              className="flex items-center justify-between p-2.5 rounded bg-[#1e2f44] hover:bg-[#253b56] border border-[#2f435c] text-slate-200 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-cyan-400" />
                <div>
                  <div className="font-bold text-white">Official Email</div>
                  <div className="text-[10px] text-slate-400">contact@metamaster.app</div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400">Copy</span>
            </div>

            {/* YouTube */}
            <a 
              href="https://youtube.com" 
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
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-500 border-t border-[#24354a]">
            Meta Master Desktop v3.5 • All Rights Reserved © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};
