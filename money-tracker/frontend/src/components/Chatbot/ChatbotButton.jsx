import React from 'react';
import { MessageCircle, X } from 'lucide-react';

function ChatbotButton({ onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      className={`
        fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40
        w-12 h-12 sm:w-14 sm:h-14
        rounded-full shadow-lg shadow-purple-900/30
        flex items-center justify-center
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#060010]
        ${isOpen
          ? 'bg-[#1a1a2e] border border-white/10 hover:bg-[#22223a] rotate-0'
          : 'bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 hover:scale-105'
        }
      `}
    >
      {isOpen ? (
        <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
      ) : (
        <>
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          {/* Pulse ring on first load — respects prefers-reduced-motion */}
          <span
            className="absolute inset-0 rounded-full bg-purple-500/30 motion-safe:animate-ping"
            style={{ animationIterationCount: 3, animationDuration: '1.5s' }}
          />
        </>
      )}
    </button>
  );
}

export default React.memo(ChatbotButton);
