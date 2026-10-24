import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const MAX_LENGTH = 2000;

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (!disabled && textareaRef.current) textareaRef.current.focus();
  }, [disabled]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || trimmed.length > MAX_LENGTH) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const remaining = MAX_LENGTH - text.length;
  const showWarning = remaining < 200 && remaining >= 0;
  const overLimit = remaining < 0;

  return (
    <div className="border-t border-purple-900/40 bg-[#080412] px-3 py-2.5 shrink-0">
      {(showWarning || overLimit) && (
        <div className={`text-[11px] mb-1.5 px-1 text-right font-medium ${overLimit ? 'text-red-400' : 'text-amber-400/80'}`}>
          {overLimit ? `${Math.abs(remaining)} characters over limit` : `${remaining} characters left`}
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
          aria-label="Ask SpendX AI"
          className="flex-1 bg-[#130d24] text-sm text-gray-100 placeholder-purple-400/40 rounded-xl px-3.5 py-2.5 resize-none border border-purple-900/50 focus:border-purple-500/60 focus:bg-[#180f2e] focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          style={{ maxHeight: '110px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || overLimit}
          aria-label="Send message"
          className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 active:scale-95 disabled:from-purple-900/30 disabled:to-violet-900/30 disabled:text-gray-600 disabled:cursor-not-allowed rounded-xl text-white transition-all flex items-center justify-center shadow-md shadow-purple-950/50 border border-purple-400/20 disabled:border-transparent"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatInput);
