import React from 'react';
import XSparkLogo from './XSparkLogo';

/**
 * ChatbotButton — Floating launcher for ArthX AI Assistant.
 * Visible ONLY when the chatbot window is closed.
 * Adheres to 60-64 CSS px on desktop with a comfortable mobile touch target.
 */
function ChatbotButton({ onClick, isOpen }) {
  // Hide launcher completely when the chatbot window is open
  // (per spec: "Show the launcher only while the chatbot is closed"
  //  and "Do not display an additional floating close button outside the open chat window")
  if (isOpen) return null;

  return (
    <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 group">
      {/* Floating launcher tooltip */}
      <div
        role="tooltip"
        id="arthx-launcher-tooltip"
        className="pointer-events-none absolute bottom-full mb-2.5 right-0 sm:right-1/2 sm:translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-50"
      >
        <div className="bg-[#190a32] text-purple-200 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-500/30 shadow-xl shadow-black/60 whitespace-nowrap">
          Ask ArthX
        </div>
      </div>

      <button
        onClick={onClick}
        aria-label="Ask ArthX"
        aria-describedby="arthx-launcher-tooltip"
        className="
          w-14 h-14 sm:w-[62px] sm:h-[62px]
          rounded-2xl
          bg-[#130728]
          border border-purple-500/35 hover:border-purple-400/70
          p-2.5 sm:p-3
          flex items-center justify-center
          transition-all duration-300 ease-out
          hover:scale-[1.05] active:scale-95
          shadow-xl shadow-purple-950/60 hover:shadow-2xl hover:shadow-purple-900/70
          focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black
        "
      >
        <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center pointer-events-none">
          <XSparkLogo size={42} className="w-full h-full object-cover" />
        </div>
      </button>
    </div>
  );
}

export default React.memo(ChatbotButton);
