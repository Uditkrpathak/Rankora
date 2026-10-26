import React, { useId } from 'react';

export interface RankoraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  onDark?: boolean;
  className?: string;
}

export const RankoraLogo: React.FC<RankoraLogoProps> = ({
  size = 'md',
  showText = true,
  onDark = false,
  className = '',
}) => {
  const rawId = useId();
  const gradId = `rankoraGrad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
  const pinId = `pinGlow-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;

  const iconDimensions = {
    sm: { width: 30, height: 30, container: 'w-7.5 h-7.5' },
    md: { width: 38, height: 38, container: 'w-9.5 h-9.5' },
    lg: { width: 44, height: 44, container: 'w-11 h-11' },
    xl: { width: 52, height: 52, container: 'w-13 h-13' },
  };

  const textStyles = {
    sm: 'text-base font-bold tracking-tight',
    md: 'text-[20px] font-extrabold tracking-tight',
    lg: 'text-2xl font-extrabold tracking-tight',
    xl: 'text-3xl font-black tracking-tight',
  };

  const currentDim = iconDimensions[size] || iconDimensions.md;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Rankora Monogram & Local SEO Radar Emblem */}
      <div className={`relative ${currentDim.container} shrink-0 transition-transform duration-200`}>
        <svg
          width={currentDim.width}
          height={currentDim.height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2E3192" />
              <stop offset="100%" stopColor="#1CB5D6" />
            </linearGradient>
            <linearGradient id={pinId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1CB5D6" />
              <stop offset="100%" stopColor="#1FA971" />
            </linearGradient>
          </defs>

          {/* Base Rounded Squircle with Brand Gradient */}
          <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${gradId})`} />

          {/* Subtle Inner Highlight */}
          <rect x="2" y="2" width="44" height="22" rx="12" fill="white" fillOpacity="0.1" />

          {/* Radar Wave Pulse (Local Map Signals) */}
          <path
            d="M30 8C35.5 10 39.5 14.5 40 20"
            stroke="white"
            strokeOpacity="0.55"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M33 11C36.5 12.8 39 16 39.5 19.5"
            stroke="white"
            strokeOpacity="0.85"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* The Rankora 'R' & Location Pin Monogram */}
          {/* Left Vertical Spine */}
          <rect x="12" y="12" width="5.5" height="24" rx="2.75" fill="white" />

          {/* Upper Loop / Map Pin Head */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15 12H26.5C31.7467 12 36 16.2533 36 21.5C36 26.7467 31.7467 31 26.5 31H15V26.5H26.5C29.2614 26.5 31.5 24.2614 31.5 21.5C31.5 18.7386 29.2614 16.5 26.5 16.5H15V12Z"
            fill="white"
          />

          {/* Center Pin Aperture / Eye */}
          <circle cx="26.5" cy="21.5" r="3.2" fill={`url(#${pinId})`} />

          {/* Ascending Ranking Kick (Upward Momentum Vector) */}
          <path
            d="M23.5 27.5L32.2 35.8C33.1 36.6 34.5 36.5 35.3 35.6C36.1 34.7 36 33.3 35.1 32.5L27 25L23.5 27.5Z"
            fill="white"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex items-center leading-none">
          <span className={`font-heading font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-[#0E1230]'} ${textStyles[size]}`}>
            Rankora
          </span>
          <span className="text-[#1CB5D6] font-black text-xl ml-0.5 leading-none">.</span>
        </div>
      )}
    </div>
  );
};

export default RankoraLogo;
