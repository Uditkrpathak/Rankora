import React, { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`p-6 sm:p-8 text-center max-w-sm mx-auto flex flex-col items-center justify-center gap-2 ${className}`}
    >
      {icon && (
        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center mb-1 shrink-0 border border-slate-200">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
