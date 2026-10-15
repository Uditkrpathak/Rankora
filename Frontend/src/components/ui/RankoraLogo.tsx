import React from 'react';

interface RankoraLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const RankoraLogo: React.FC<RankoraLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-base font-extrabold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-black',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Dynamic Rankora Hexagon & Radar Pin Symbol */}
      <div className={`relative ${iconSizes[size]} rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          {/* Compass / Growth Arrow geometry */}
          <polygon points="12 2 19 21 12 17 5 21 12 2" fill="rgba(255,255,255,0.2)" />
        </svg>
      </div>

      {showText && (
        <span className={`tracking-tight text-slate-900 ${textSizes[size]}`}>
          Rankora<span className="text-brand-500">.</span>
        </span>
      )}
    </div>
  );
};
