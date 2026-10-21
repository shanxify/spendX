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
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
    // Reset height
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
    <div className="border-t border-white/10 bg-[#0c0c18] px-3 py-2.5">
      {(showWarning || overLimit) && (
        <div className={`text-xs mb-1.5 text-right ${overLimit ? 'text-red-400' : 'text-yellow-400/70'}`}>
          {overLimit ? `${Math.abs(remaining)} characters over limit` : `${remaining} characters remaining`}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about SpendX..."
          disabled={disabled}
          rows={1}
          className="flex-1 bg-[#16162a] text-sm text-gray-200 placeholder-gray-500 rounded-xl px-3.5 py-2.5 resize-none border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || overLimit}
          aria-label="Send message"
          className="flex-shrink-0 p-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/30 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatInput);
