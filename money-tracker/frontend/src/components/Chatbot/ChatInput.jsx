import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const MAX_LENGTH = 2000;

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
    }
  }, [text]);

  // Focus input when enabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || trimmed.length > MAX_LENGTH) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remaining = MAX_LENGTH - text.length;
  const showWarning = remaining < 200 && remaining >= 0;
  const overLimit = remaining < 0;

  return (
    <div className="border-t border-white/[0.08] bg-[#0c0c18] px-3 py-2.5 shrink-0">
      {(showWarning || overLimit) && (
        <div
          className={`text-[11px] mb-1.5 px-1 text-right font-medium ${
            overLimit ? 'text-red-400' : 'text-amber-400/80'
          }`}
        >
          {overLimit
            ? `${Math.abs(remaining)} characters over limit`
            : `${remaining} characters left`}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your spending..."
          disabled={disabled}
          rows={1}
          aria-label="Ask SpendX Assistant"
          className="flex-1 bg-[#151528] text-sm text-gray-100 placeholder-gray-500 rounded-xl px-3.5 py-2.5 resize-none border border-white/[0.08] focus:border-purple-500/60 focus:bg-[#1a1a32] focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          style={{ maxHeight: '110px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || overLimit}
          aria-label="Send question"
          className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 disabled:from-purple-900/30 disabled:to-indigo-900/30 disabled:text-gray-500 disabled:cursor-not-allowed rounded-xl text-white transition-all flex items-center justify-center shadow-md shadow-purple-950/40 border border-purple-400/20 disabled:border-transparent"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatInput);
