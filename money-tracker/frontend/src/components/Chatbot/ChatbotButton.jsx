import React from 'react';
import { X } from 'lucide-react';
import SpendXAiIcon from './SpendXAiIcon';

function ChatbotButton({ onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close SpendX AI Assistant' : 'Open SpendX AI Assistant'}
      aria-expanded={isOpen}
      className={`
        fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40
        w-12 h-12 sm:w-14 sm:h-14
        rounded-2xl shadow-xl shadow-purple-950/50
        flex items-center justify-center
        transition-all duration-300 ease-out
        border
        focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#060010]
        ${
          isOpen
            ? 'bg-[#151528] border-white/15 hover:bg-[#1e1e36] text-gray-300'
            : 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 border-purple-400/30 hover:from-purple-500 hover:to-indigo-700 hover:scale-[1.04] text-white'
        }
      `}
    >
      {isOpen ? (
        <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" aria-hidden="true" />
      ) : (
        <div className="flex items-center justify-center">
          <SpendXAiIcon className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
      )}
    </button>
  );
}

export default React.memo(ChatbotButton);
