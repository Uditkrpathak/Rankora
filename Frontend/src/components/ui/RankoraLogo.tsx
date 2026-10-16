import React from 'react';

interface RankoraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const RankoraLogo: React.FC<RankoraLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: { width: 32, height: 32, container: 'w-8 h-8' },
    md: { width: 40, height: 40, container: 'w-10 h-10' },
    lg: { width: 48, height: 48, container: 'w-12 h-12' },
    xl: { width: 56, height: 56, container: 'w-14 h-14' },
  };

  const textStyles = {
    sm: 'text-base font-bold',
    md: 'text-[22px] font-extrabold',
    lg: 'text-2xl font-extrabold',
    xl: 'text-3xl font-black',
  };

  const subtitleStyles = {
    sm: 'text-[8.5px]',
    md: 'text-[9.5px]',
    lg: 'text-[11px]',
    xl: 'text-[12px]',
  };

  const currentDim = iconDimensions[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Dynamic Rankora Monogram & Local SEO Radar Emblem */}
      <div className={`relative ${currentDim.container} shrink-0 group-hover:scale-105 transition-transform duration-200`}>
        <svg
          width={currentDim.width}
          height={currentDim.height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            <linearGradient id={`rankoraGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2E3192" />
              <stop offset="100%" stopColor="#1CB5D6" />
            </linearGradient>
            <linearGradient id={`pinGlow-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1CB5D6" />
              <stop offset="100%" stopColor="#1FA971" />
            </linearGradient>
          </defs>

          {/* Base Rounded Squircle with Brand Gradient */}
          <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#rankoraGrad-${size})`} />

          {/* Subtle Inner Highlight */}
          <rect x="2" y="2" width="44" height="22" rx="12" fill="white" fillOpacity="0.08" />

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
          <circle cx="26.5" cy="21.5" r="3.2" fill={`url(#pinGlow-${size})`} />

          {/* Ascending Ranking Kick (Upward Momentum Vector) */}
          <path
            d="M23.5 27.5L32.2 35.8C33.1 36.6 34.5 36.5 35.3 35.6C36.1 34.7 36 33.3 35.1 32.5L27 25L23.5 27.5Z"
            fill="white"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left justify-center">
          <span className={`font-heading tracking-tight text-[#141833] leading-none ${textStyles[size]}`}>
            Rankora
          </span>

        </div>
      )}
    </div>
  );
};
export default RankoraLogo;
