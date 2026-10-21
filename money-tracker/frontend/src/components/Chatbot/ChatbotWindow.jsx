import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

const SUGGESTED_PROMPTS = [
  'How do I upload a PhonePe PDF?',
  'How does SpendX categorize transactions?',
  'Explain the dashboard',
  'Give me budgeting tips',
];

function ChatbotWindow({ isOpen, onClose, messages, isLoading, error, onSend, onRetry, onClearError }) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom on new messages
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

  // Only show suggested prompts if we have just the welcome message
  const showSuggestions = messages.length === 1 && messages[0].id === 'welcome';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-label="SpendX AI Assistant"
          className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[min(560px,calc(100vh-7rem))] flex flex-col bg-[#0e0e1a] border border-white/10 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden"
          style={{ maxHeight: 'calc(100dvh - 7rem)' }}
        >
          {/* ── Header ────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/20 to-purple-800/10 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white leading-tight">SpendX AI Assistant</h2>
                <p className="text-[11px] text-gray-400 leading-tight">Your personal finance companion</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close assistant"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Messages ──────────────────────────────────── */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Suggested prompts */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => onSend(prompt)}
                    className="text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-full transition-colors whitespace-nowrap"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="bg-[#1a1a2e] border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-300 text-xs">{error}</p>
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-1 mt-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Try again
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ─────────────────────────────────────── */}
          <ChatInput onSend={onSend} disabled={isLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default React.memo(ChatbotWindow);
