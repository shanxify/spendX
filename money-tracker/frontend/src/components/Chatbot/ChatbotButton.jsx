import React from 'react';
import { X } from 'lucide-react';
import XSparkLogo from './XSparkLogo';

function ChatbotButton({ onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close SpendX AI Assistant' : 'Open SpendX AI Assistant'}
      aria-expanded={isOpen}
      className={`
        fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40
        w-14 h-14
        rounded-2xl
        flex items-center justify-center
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black
        ${isOpen
          ? 'bg-[#1a1030] border border-white/15 hover:bg-[#22183a] shadow-xl shadow-purple-950/40'
          : 'bg-[#1a0a2e] border border-purple-500/40 hover:border-purple-400/70 hover:scale-[1.06] shadow-2xl shadow-purple-900/50 hover:shadow-purple-800/60'
        }
      `}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-purple-300" aria-hidden="true" />
      ) : (
        <XSparkLogo size={44} className="rounded-xl" />
      )}
    </button>
  );
}

export default React.memo(ChatbotButton);
