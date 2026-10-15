/**
 * Rankora Chart Theme & Design Tokens
 * Centralized design tokens consumed by Recharts and SVG visualizations.
 */

export const CHART_THEME = {
  colors: {
    primary: '#0075F6',
    primaryLight: '#60a5fa',
    primaryDark: '#004ea7',
    primaryBg: 'rgba(0, 117, 246, 0.08)',
    primaryGradientStart: 'rgba(0, 117, 246, 0.28)',
    primaryGradientEnd: 'rgba(0, 117, 246, 0.0)',
    
    // Status colors for ranks and distributions
    success: '#10b981', // Top 1-3
    warning: '#f59e0b', // Top 4-10
    danger: '#ef4444',  // 11+
    neutral: '#94a3b8',
    
    // Grid & Axis styling
    grid: '#f1f5f9',
    axis: '#64748b',
    tooltipBg: '#0f172a',
    tooltipText: '#ffffff',
    tooltipBorder: '#1e293b',
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSizeSmall: 11,
    fontSizeRegular: 12,
    fontSizeMedium: 13,
    fontWeightBold: 600,
  },
  animation: {
    duration: 800,
    easing: 'ease-out' as const,
  }
};

/**
 * Standardized Custom Tooltip styling for Recharts
 */
export const tooltipStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderColor: '#1e293b',
  borderRadius: '8px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  color: '#ffffff',
  fontSize: '12px',
  padding: '8px 12px',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};
