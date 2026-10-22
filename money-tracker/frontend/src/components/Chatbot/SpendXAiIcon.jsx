import React from 'react';

/**
 * SpendXAiIcon — Custom AI identity icon for SpendX Finance Assistant.
 * Blends a modern AI dynamic 4-point star with a glowing financial accent sparkle.
 */
export function SpendXAiIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="spendx-ai-main-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d8b4fe" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="spendx-ai-sub-grad" x1="14" y1="2" x2="22" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {/* Primary 4-point dynamic AI spark */}
      <path
        d="M12 2.5C12.35 6.9 15.1 9.65 19.5 10C15.1 10.35 12.35 13.1 12 17.5C11.65 13.1 8.9 10.35 4.5 10C8.9 9.65 11.65 6.9 12 2.5Z"
        fill="url(#spendx-ai-main-grad)"
      />
      {/* Secondary satellite diamond accent */}
      <path
        d="M18.5 13.5C18.7 15.3 19.9 16.5 21.7 16.7C19.9 16.9 18.7 18.1 18.5 19.9C18.3 18.1 17.1 16.9 15.3 16.7C17.1 16.5 18.3 15.3 18.5 13.5Z"
        fill="url(#spendx-ai-sub-grad)"
      />
      {/* Tertiary subtle node */}
      <circle cx="6" cy="18" r="1.5" fill="#c084fc" fillOpacity="0.8" />
    </svg>
  );
}

export default SpendXAiIcon;
