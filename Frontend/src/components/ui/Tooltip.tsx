import React, { useState, useRef, useEffect, ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side,
  position,
  className = '',
}) => {
  const activeSide = side || position || 'top';
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).substring(2, 7)}`);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span aria-describedby={isVisible ? tooltipId.current : undefined}>
        {children}
      </span>

      {isVisible && content && (
        <span
          id={tooltipId.current}
          role="tooltip"
          className={`absolute z-40 px-2 py-1 text-[11px] leading-tight font-normal text-white bg-slate-900 rounded shadow-xs pointer-events-none whitespace-normal max-w-xs text-center border border-slate-800 animate-in fade-in duration-100 ${sideClasses[activeSide]} ${className}`}
        >
          {content}
        </span>
      )}
    </span>
  );
};
