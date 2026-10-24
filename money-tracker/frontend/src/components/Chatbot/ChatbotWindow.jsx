import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import XSparkLogo from './XSparkLogo';

const SUGGESTED_PROMPTS = [
  'What was my biggest expense?',
  'Show spending by category',
  'Compare this month vs last month',
  'How do I upload a statement?',
];

function ChatbotWindow({ isOpen, onClose, messages, isLoading, error, onSend, onRetry, onClearError }) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, error]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const showSuggestions = messages.length === 1 && messages[0].id === 'welcome';

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
          aria-label="SpendX AI Assistant"
          className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[410px] h-[min(590px,calc(100dvh-6.5rem))] flex flex-col bg-[#0a0614] border border-purple-900/50 rounded-2xl shadow-2xl shadow-purple-950/60 overflow-hidden"
        >
          {/* ── Header ─────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#130a22] to-[#0e0818] border-b border-purple-900/40 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* X-Spark logo in header — small rounded square */}
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-purple-500/30 shadow-md shadow-purple-950/60">
                <XSparkLogo size={36} className="w-full h-full" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white tracking-tight truncate leading-tight">
                  SpendX AI Assistant
                </h2>
                <p className="text-[11px] text-purple-300/70 truncate leading-tight">
                  Your personal finance companion
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close SpendX AI Assistant"
              className="p-1.5 text-purple-300/60 hover:text-white hover:bg-purple-500/15 active:bg-purple-500/25 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-purple-400/50 ml-2 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Messages ───────────────────────────────── */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3.5 scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent"
            role="log"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Suggested quick prompts */}
            {showSuggestions && (
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-wider text-purple-400/50 font-semibold mb-2 px-1">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onSend(prompt)}
                      className="text-xs px-3 py-1.5 bg-purple-500/[0.08] hover:bg-purple-500/[0.18] active:bg-purple-500/[0.25] text-purple-200 border border-purple-500/20 hover:border-purple-400/40 rounded-full transition-all text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2.5" role="status" aria-label="SpendX AI is thinking">
                <div className="flex-shrink-0 w-7 h-7 rounded-xl overflow-hidden border border-purple-500/30 shadow-sm">
                  <XSparkLogo size={28} className="w-full h-full" />
                </div>
                <div className="bg-[#130d24] border border-purple-900/40 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md shadow-black/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                    style={{ animationDuration: '0.9s', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                    style={{ animationDuration: '0.9s', animationDelay: '180ms' }} />
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full motion-safe:animate-bounce"
                    style={{ animationDuration: '0.9s', animationDelay: '360ms' }} />
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/20 border border-red-500/30 rounded-xl p-3 text-sm" role="alert">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {onRetry && (
                      <button onClick={onRetry}
                        className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-medium transition-colors">
                        <RefreshCw className="w-3 h-3" /> Try again
                      </button>
                    )}
                    {onClearError && (
                      <button onClick={onClearError} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ──────────────────────────────────── */}
          <ChatInput onSend={onSend} disabled={isLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default React.memo(ChatbotWindow);
