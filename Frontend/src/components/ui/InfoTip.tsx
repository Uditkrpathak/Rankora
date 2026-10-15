import React, { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface InfoTipProps {
  content: ReactNode;
  label?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const InfoTip: React.FC<InfoTipProps> = ({
  content,
  label = 'More information',
  side = 'top',
  className = '',
}) => {
  return (
    <Tooltip content={content} side={side} className={className}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-help shrink-0 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <Info className="w-3 h-3" />
      </button>
    </Tooltip>
  );
};
