import React from 'react';
import { Link } from 'react-router-dom';
import { RankoraLogo, RankoraLogoProps } from './RankoraLogo';
import { BRAND_CONFIG } from '../../config/brand';

export interface BrandLogoProps {
  to?: string;
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onDark?: boolean;
  className?: string;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  to = '/dashboard',
  variant = 'full',
  size = 'md',
  onDark = false,
  className = '',
  showText = true,
}) => {
  const isMarkOnly = variant === 'mark' || showText === false;

  const content = (
    <RankoraLogo
      size={size}
      showText={!isMarkOnly}
      onDark={onDark}
      className={`group cursor-pointer ${className}`}
    />
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg transition-opacity hover:opacity-95"
        aria-label={`${BRAND_CONFIG.productName} home`}
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default BrandLogo;
