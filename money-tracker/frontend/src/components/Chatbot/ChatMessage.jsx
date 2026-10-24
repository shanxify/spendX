import React from 'react';
import ReactMarkdown from 'react-markdown';
import XSparkLogo from './XSparkLogo';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const timeStr = formatTime(message.timestamp);

  return (
    <div
      className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      role="article"
      aria-label={isUser ? 'Your message' : 'ArthX response'}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-xl overflow-hidden border border-purple-500/30 bg-[#160a2c] shadow-sm shadow-purple-950/50"
          aria-hidden="true"
        >
          <XSparkLogo size={28} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Bubble + Timestamp */}
      <div className={`flex flex-col max-w-[84%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words overflow-hidden ${
            isUser
              ? 'bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-2xl rounded-tr-sm shadow-md shadow-purple-950/40 border border-purple-400/20'
              : 'bg-[#130d24] text-gray-200 rounded-2xl rounded-tl-sm border border-purple-900/40 shadow-md shadow-black/30'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed text-gray-200">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-purple-200">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-gray-300">{children}</em>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5 text-gray-200">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5 text-gray-200">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  code: ({ children }) => (
                    <code className="bg-purple-950/60 border border-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded text-xs font-mono break-all">
                      {children}
                    </code>
                  ),
                  h1: ({ children }) => (
                    <h3 className="text-sm font-bold text-white mb-1.5 mt-2 first:mt-0">{children}</h3>
                  ),
                  h2: ({ children }) => (
                    <h4 className="text-[13px] font-semibold text-purple-200 mb-1 mt-2 first:mt-0">{children}</h4>
                  ),
                  h3: ({ children }) => (
                    <h5 className="text-xs font-semibold text-purple-300 mb-1 mt-1.5 first:mt-0">{children}</h5>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-purple-500/40 pl-2.5 my-2 text-gray-400 italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {timeStr && (
          <span className={`text-[10px] text-gray-500 mt-1 px-1 select-none ${isUser ? 'text-right' : 'text-left'}`}>
            {timeStr}
          </span>
        )}
      </div>
    </div>
  );
}

export default React.memo(ChatMessage);
