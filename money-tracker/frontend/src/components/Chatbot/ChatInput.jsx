import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';

const MAX_LENGTH = 2000;

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea cleanly up to 110px without triggering scrollbars prematurely
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const newHeight = Math.min(scrollH, 110);
      el.style.height = `${Math.max(newHeight, 24)}px`;
      // Only enable scroll overflow if exceeding maxHeight
      el.style.overflowY = scrollH > 110 ? 'auto' : 'hidden';
    }
  }, [text]);

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
      textareaRef.current.style.height = '24px';
      textareaRef.current.style.overflowY = 'hidden';
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
    <div className="p-3 sm:p-3.5 bg-[#0a0518] border-t border-purple-500/20 shrink-0">
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

      {/* Styled input pill enclosing attachment icon, textarea, and send button */}
      <div className="flex items-center gap-2 bg-[#120826]/90 border border-purple-500/30 hover:border-purple-400/50 focus-within:border-purple-400/70 focus-within:ring-1 focus-within:ring-purple-400/40 rounded-2xl p-1.5 pl-3 transition-all shadow-inner shadow-black/40">
        {/* Attachment paperclip icon */}
        <span
          title="Supports PhonePe, Google Pay, and Paytm statements"
          className="p-1 text-purple-300/50 hover:text-purple-200 transition-colors cursor-default shrink-0 select-none"
          aria-hidden="true"
        >
          <Paperclip className="w-4 h-4" />
        </span>

        {/* Textarea: no border, transparent bg, no thick native scrollbars */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ArthX anything about your spending..."
          disabled={disabled}
          rows={1}
          aria-label="Ask ArthX anything about your spending..."
          className="
            flex-1 bg-transparent
            text-[13.5px] text-gray-100 placeholder:text-purple-300/40
            resize-none border-none outline-none focus:outline-none focus:ring-0
            p-0 leading-relaxed max-h-[110px]
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ height: '24px', overflowY: 'hidden' }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || overLimit}
          aria-label="Send message to ArthX"
          className="
            flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10
            bg-gradient-to-br from-purple-500 via-purple-600 to-violet-600
            hover:from-purple-400 hover:to-violet-500 active:scale-95
            disabled:from-purple-900/30 disabled:to-violet-950/30 disabled:text-purple-500/30 disabled:cursor-not-allowed
            rounded-xl text-white transition-all
            flex items-center justify-center
            shadow-md shadow-purple-950/60 border border-purple-400/20 disabled:border-transparent
            focus:outline-none focus:ring-1 focus:ring-purple-400/50
          "
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatInput);
