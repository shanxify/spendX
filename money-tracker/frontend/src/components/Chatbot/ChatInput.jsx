import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const MAX_LENGTH = 2000;

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea cleanly up to 110px without triggering thick scrollbars
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const newHeight = Math.min(scrollH, 110);
      el.style.height = `${Math.max(newHeight, 24)}px`;
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
    <div className="p-3 sm:p-3.5 bg-[#0b0518] border-t border-purple-500/20 shrink-0">
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

      {/* Styled input pill enclosing textarea and send button */}
      <div className="flex items-center gap-2.5 bg-[#120826]/90 border border-purple-500/30 hover:border-purple-400/50 focus-within:border-purple-400/70 focus-within:ring-1 focus-within:ring-purple-400/30 rounded-2xl p-1.5 pl-3.5 sm:pl-4 transition-all shadow-inner shadow-black/40 min-h-[52px]">
        {/* Textarea: spacious, comfortable left padding, zero native scrollbar chrome */}
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
            flex-1 min-w-0 bg-transparent
            text-[13.5px] sm:text-[14px] text-gray-100 placeholder:text-purple-200/60
            resize-none border-0 outline-none focus:outline-none focus:ring-0
            p-0 leading-relaxed max-h-[110px]
            [scrollbar-width:none] [-ms-overflow-style:none]
            [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0
            [&::-webkit-resizer]:hidden
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ height: '24px', overflowY: 'hidden', scrollbarWidth: 'none' }}
        />

        {/* Send Button: 44px clean purple squircle with paper-plane icon */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || overLimit}
          aria-label="Send message to ArthX"
          className="
            flex-shrink-0 w-11 h-11
            bg-[#5b21b6] hover:bg-[#6d28d9] active:scale-95 active:bg-[#4c1d95]
            disabled:bg-[#28114b]/60 disabled:text-purple-400/30 disabled:border-transparent disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100
            rounded-[14px] text-purple-100 hover:text-white transition-all
            flex items-center justify-center
            shadow-md shadow-purple-950/60 border border-purple-400/25
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#120826]
          "
        >
          <Send className="w-5 h-5 translate-x-[1px] translate-y-[-1px]" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatInput);
