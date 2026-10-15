import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_CONFIG } from '../../config/brand';

export interface BrandLogoProps {
  to?: string;
  variant?: 'full' | 'mark';
  onDark?: boolean;
  className?: string;
  showText?: boolean;
}

const FALLBACK_EXTENSIONS = ['svg', 'png', 'webp'] as const;

export const BrandLogo: React.FC<BrandLogoProps> = ({
  to = '/dashboard',
  variant = 'full',
  onDark = false,
  className = '',
  showText = true,
}) => {
  // Step through fallback hierarchy: 0 = svg, 1 = png, 2 = webp, 3 = plain text
  const [attemptIndex, setAttemptIndex] = useState(0);

  const isTextFallback = attemptIndex >= FALLBACK_EXTENSIONS.length;
  const currentExt = !isTextFallback ? FALLBACK_EXTENSIONS[attemptIndex] : null;

  const logoFile = currentExt
    ? variant === 'mark'
      ? `/src/assets/brand/logo-mark.${currentExt}`
      : `/src/assets/brand/logo.${currentExt}`
    : null;

  const handleImgError = () => {
    setAttemptIndex((prev) => prev + 1);
  };

  const textColor = onDark ? 'text-white' : 'text-slate-900';
  const dotColor = onDark ? 'text-brand-300' : 'text-brand-600';

  const content = (
    <div className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}>
      {!isTextFallback && logoFile ? (
        <img
          src={logoFile}
          alt={BRAND_CONFIG.productName}
          width={variant === 'mark' ? 24 : 110}
          height={variant === 'mark' ? 24 : 28}
          onError={handleImgError}
          className={`h-6 w-auto object-contain ${onDark ? 'brightness-0 invert' : ''}`}
        />
      ) : (
        /* Typographic mark fallback (never inventing an artificial raster/svg graphic) */
        <div
          className={`flex items-center justify-center rounded-lg font-bold text-xs tracking-wider shrink-0 ${
            onDark
              ? 'bg-white/15 text-white border border-white/20'
              : 'bg-brand-50 text-brand-700 border border-brand-200'
          } ${variant === 'mark' ? 'w-7 h-7' : 'w-7 h-7'}`}
          aria-hidden="true"
        >
          {BRAND_CONFIG.productName.charAt(0)}
        </div>
      )}

      {(isTextFallback || showText) && variant !== 'mark' && (
        <span className={`font-bold tracking-tight text-sm ${textColor}`}>
          {BRAND_CONFIG.productName}
          <span className={dotColor}>.</span>
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded"
        aria-label={`${BRAND_CONFIG.productName} home`}
      >
        {content}
      </Link>
    );
  }

  return content;
};
