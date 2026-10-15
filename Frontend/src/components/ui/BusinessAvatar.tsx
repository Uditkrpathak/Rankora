import React, { useState } from 'react';

export interface BusinessAvatarProps {
  name?: string;
  coverPhotoUrl?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  website?: string | null;
  category?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded' | 'circle';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs font-semibold',
  lg: 'w-10 h-10 text-sm font-semibold',
  xl: 'w-12 h-12 text-base font-bold',
};

const sizeDimensions: Record<string, number> = {
  xs: 24,
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
};

/**
 * Derives up to 2 uppercase initials from a name (e.g. "Pandey Telecom" -> "PT", "Udit" -> "U")
 */
function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * BusinessAvatar component
 * Displays authentic Google Places photo if present, otherwise cleanly falls back
 * to a brand-tinted monogram with uppercase initials. No category-guessing icons.
 */
export const BusinessAvatar: React.FC<BusinessAvatarProps> = ({
  name = 'Business',
  coverPhotoUrl,
  logoUrl,
  photoUrl,
  size = 'md',
  shape = 'rounded',
  className = '',
}) => {
  const [photoError, setPhotoError] = useState(false);

  // Check for authentic real Google Places photo or uploaded logo
  const directRealPhoto = logoUrl || coverPhotoUrl || photoUrl;
  const isRealPhotoValid = Boolean(
    directRealPhoto &&
      !directRealPhoto.includes('placeholder') &&
      !directRealPhoto.includes('unsplash')
  );

  const baseSize = sizeClasses[size] || sizeClasses.md;
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const dim = sizeDimensions[size] || 32;
  const initials = getInitials(name);

  // Strategy 1: Real photo from Google Places API
  if (isRealPhotoValid && !photoError) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 flex items-center justify-center shadow-xs ${baseSize} ${radiusClass} ${className}`}
      >
        <img
          src={directRealPhoto!}
          alt={name}
          width={dim}
          height={dim}
          className="w-full h-full object-cover"
          onError={() => setPhotoError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Strategy 2: Authentic Monogram with Initials on Brand Tint (No category guessing)
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center font-bold select-none bg-brand-50 text-brand-700 border border-brand-200/80 shadow-2xs tracking-tight ${baseSize} ${radiusClass} ${className}`}
      aria-label={name}
      title={name}
    >
      <span>{initials}</span>
    </div>
  );
};
