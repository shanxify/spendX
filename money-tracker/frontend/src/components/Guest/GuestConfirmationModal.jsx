import React, { useEffect, useRef } from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';

const GuestConfirmationModal = ({ isOpen, onClose, onContinue, onLogin }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Focus primary button when modal opens
    if (modalRef.current) {
      const continueBtn = modalRef.current.querySelector('[data-autofocus]');
      if (continueBtn) {
        continueBtn.focus();
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-modal-title"
      aria-describedby="guest-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#0c0c14] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-left my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Close Button X */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header Icon & Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 tracking-wide uppercase">
            Guest Access
          </span>
        </div>

        {/* Title */}
        <h2
          id="guest-modal-title"
          className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight"
        >
          Continue Without Login
        </h2>

        {/* Description */}
        <p
          id="guest-modal-desc"
          className="text-sm sm:text-base text-gray-300 leading-relaxed mb-4"
        >
          Explore SpendX without creating an account. View the dashboard, sample transactions, categories, and spending insights to see how SpendX works.
        </p>

        {/* Supporting message */}
        <div className="bg-[#12121c] border border-white/5 rounded-xl p-3.5 mb-6 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            You can explore supported features without signing in. Log in to access your personal financial data and account-specific features.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          {/* Secondary Button: Log In for Full Access */}
          <button
            type="button"
            onClick={onLogin}
            className="w-full sm:flex-1 py-3 px-4 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/20 text-center"
          >
            Log In for Full Access
          </button>

          {/* Primary Button: Continue */}
          <button
            type="button"
            data-autofocus
            onClick={onContinue}
            className="w-full sm:flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-sm transition-all shadow-[0_0_20px_rgba(124,58,237,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-400 text-center"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestConfirmationModal;
