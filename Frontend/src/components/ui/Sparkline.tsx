import React from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  showPoints?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 60,
  height = 18,
  strokeColor = '#0075F6',
  showPoints = true,
  className = '',
  ariaLabel = 'Historical trend sparkline',
}) => {
  if (!data || data.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 font-mono" aria-label="No historical data">
        —
      </span>
    );
  }

  if (data.length === 1) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`inline-block overflow-visible ${className}`}
        aria-label={ariaLabel}
      >
        <circle cx={width / 2} cy={height / 2} r={2} fill={strokeColor} />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const usableWidth = width - padding * 2;

  // Ranks: lower number is better rank, so smaller value maps to higher Y coordinate unless inverted
  // Here we map data points directly: highest value at top (y=padding), lowest at bottom (y=height-padding)
  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * usableWidth;
    // For rank tracking, rank 1 is top, rank 20 is bottom:
    const normalized = (val - min) / range;
    const y = padding + usableHeight - normalized * usableHeight;
    return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)), val };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block overflow-visible ${className}`}
      aria-label={ariaLabel}
      role="img"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {showPoints &&
        points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={1.25}
            fill={strokeColor}
          />
        ))}
    </svg>
  );
};
