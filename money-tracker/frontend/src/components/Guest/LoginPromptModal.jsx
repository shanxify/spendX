import React, { useEffect, useRef } from 'react';
import { X, Lock } from 'lucide-react';

const LoginPromptModal = ({ isOpen, onClose, onLogin, featureName }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
      aria-describedby="login-prompt-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#0c0c14] border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl text-left my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Close Button X */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
          <Lock className="w-6 h-6" />
        </div>

        {/* Title */}
        <h3
          id="login-prompt-title"
          className="text-lg sm:text-xl font-bold text-white mb-2"
        >
          Log in to use this feature
        </h3>

        {/* Feature subtitle if provided */}
        {featureName && (
          <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
            Action: {featureName}
          </p>
        )}

        {/* Body Message */}
        <p
          id="login-prompt-desc"
          className="text-sm text-gray-300 leading-relaxed mb-6"
        >
          Create or access your SpendX account to upload your own statements and manage your personal financial data.
        </p>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 px-4 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border border-white/10 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/20 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLogin || (() => { window.location.href = '/'; })}
            className="w-full sm:flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(124,58,237,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-400 text-center"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPromptModal;
