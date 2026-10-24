import React from 'react';

/**
 * XSparkLogo — Official ArthX AI assistant logo for SpendX.
 * Renders the ArthX X-Spark image asset (/arthx-logo.png) with consistent sizing.
 * Falls back gracefully to SVG X-Spark if the asset fails to load.
 */
function XSparkLogo({ size = 28, className = '', showFallback = false }) {
  const [imgError, setImgError] = React.useState(false);

  if (imgError || showFallback) {
    // Fallback: SVG X-Spark when image unavailable
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="xspark-fb-grad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e0c3fc" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M6 6L18 18M18 6L6 18"
          stroke="url(#xspark-fb-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M17.5 5.5C17.7 6.7 18.5 7.5 19.7 7.7C18.5 7.9 17.7 8.7 17.5 9.9C17.3 8.7 16.5 7.9 15.3 7.7C16.5 7.5 17.3 6.7 17.5 5.5Z"
          fill="#e0c3fc"
        />
      </svg>
    );
  }

  return (
    <img
      src="/arthx-logo.png"
      alt="ArthX"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'cover', display: 'block' }}
      onError={() => setImgError(true)}
      draggable={false}
    />
  );
}

export default React.memo(XSparkLogo);
