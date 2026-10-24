import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertCircle,
  RefreshCw,
  FileText,
  BarChart2,
  TrendingUp,
  UploadCloud,
  ChevronRight,
} from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import XSparkLogo from './XSparkLogo';

// Exactly the 4 specified suggested questions in order
const DEFAULT_SUGGESTIONS = [
  {
    id: 'biggest-expense',
    text: 'What was my biggest expense?',
    icon: FileText,
  },
  {
    id: 'spending-category',
    text: 'Show spending by category',
    icon: BarChart2,
  },
  {
    id: 'compare-months',
    text: 'Compare this month vs last month',
    icon: TrendingUp,
  },
  {
    id: 'upload-statement',
    text: 'How do I upload a statement?',
    icon: UploadCloud,
  },
];

function ChatbotWindow({
  isOpen,
  onClose,
  messages,
  isLoading,
  error,
  onSend,
  onRetry,
  onClearError,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll on new messages or typing indicator
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, error]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Initial empty-chat state: only the welcome message exists
  const isInitialState = messages.length === 1 && messages[0].id === 'welcome';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="ArthX AI Assistant"
          className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] max-w-[440px] h-[min(620px,calc(100dvh-2.5rem))] flex flex-col bg-[#0b0518] border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/80 overflow-hidden"
        >
          {/* ── 1. Chatbot Header ────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#140a2a] via-[#100722] to-[#0c051a] border-b border-purple-500/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* ArthX X-Spark logo in header */}
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-purple-400/30 shadow-md shadow-purple-950/60 bg-[#160a2c]">
                <XSparkLogo size={40} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-white tracking-tight leading-tight truncate">
                  ArthX
                </h2>
                <p className="text-xs text-purple-300/85 font-normal leading-tight truncate">
                  Intelligence for Every Rupee
                </p>
              </div>
            </div>

            {/* Single close button in header */}
            <button
              onClick={onClose}
              aria-label="Close ArthX"
              className="p-1.5 text-purple-300/60 hover:text-white hover:bg-purple-500/20 active:bg-purple-500/30 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-purple-400/50 flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── 2. Chat Content (Welcome Screen OR Message History) ─────── */}
          {isInitialState ? (
            /* Welcome Screen Layout (Matching Reference Mockup) */
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-5 py-4 overflow-y-auto [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-purple-900/40 scrollbar-track-transparent">
              <div className="flex flex-col items-center text-center my-auto">
                {/* ArthX Logo with soft purple backlight glow */}
                <div className="relative mb-3.5 sm:mb-4">
                  <div className="absolute -inset-2 bg-gradient-to-tr from-purple-600/30 to-violet-500/30 rounded-3xl blur-lg pointer-events-none" />
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-purple-400/30 shadow-xl shadow-purple-950/80 bg-[#140828]">
                    <XSparkLogo size={80} className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* Welcome Heading */}
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Meet Your{' '}
                  <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-purple-400 bg-clip-text text-transparent">
                    Money Mentor.
                  </span>
                </h3>

                {/* Welcome Message */}
                <p className="text-xs sm:text-[13px] text-purple-200/75 mt-2 max-w-[320px] leading-relaxed">
                  Hi! I'm ArthX, your personal AI assistant. Ask me about your spending, transactions, and savings.
                </p>

                {/* 4 Default Suggested Questions (2x2 Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 mt-5 sm:mt-6 w-full">
                  {DEFAULT_SUGGESTIONS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSend(item.text)}
                        className="flex items-center gap-2.5 p-3 rounded-xl sm:rounded-2xl bg-[#140a2a]/80 hover:bg-[#1f0f3e] active:bg-[#291453] border border-purple-500/20 hover:border-purple-400/40 text-left transition-all duration-200 group shadow-sm hover:shadow-md hover:shadow-purple-950/40 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                      >
                        <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-300 group-hover:text-purple-200 group-hover:bg-purple-500/25 transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[12px] sm:text-[12.5px] font-medium text-white/90 group-hover:text-white leading-snug flex-1">
                          {item.text}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-purple-400/40 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversation History View */
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent"
              role="log"
              aria-live="polite"
            >
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div
                  className="flex items-end gap-2.5"
                  role="status"
                  aria-label="ArthX is thinking"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-xl overflow-hidden border border-purple-500/30 bg-[#160a2c] shadow-sm">
                    <XSparkLogo size={28} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#130d24] border border-purple-900/40 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md shadow-black/20 flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                      style={{ animationDuration: '0.9s', animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                      style={{ animationDuration: '0.9s', animationDelay: '180ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                      style={{ animationDuration: '0.9s', animationDelay: '360ms' }}
                    />
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div
                  className="flex items-start gap-2.5 bg-red-950/20 border border-red-500/30 rounded-xl p-3 text-sm"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {onRetry && (
                        <button
                          onClick={onRetry}
                          className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-medium transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Try again
                        </button>
                      )}
                      {onClearError && (
                        <button
                          onClick={onClearError}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* ── 3. Chat Input ─────────────────────────────────────────── */}
          <ChatInput onSend={onSend} disabled={isLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default React.memo(ChatbotWindow);
