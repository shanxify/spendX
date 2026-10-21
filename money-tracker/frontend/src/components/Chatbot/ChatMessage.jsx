import React from 'react';
import { Sparkles } from 'lucide-react';

function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-purple-600 text-white rounded-br-md'
            : 'bg-[#1a1a2e] text-gray-200 rounded-bl-md border border-white/5'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

export default React.memo(ChatMessage);
