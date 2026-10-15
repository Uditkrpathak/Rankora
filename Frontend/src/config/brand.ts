/**
 * Global Brand & Company Configuration
 * Single source of truth for brand naming, legal entities, and company identity.
 */

export const BRAND_CONFIG = {
  productName: 'Rankora',
  companyName: 'Agumentik',
  legalName: 'Agumentik Software Private Limited',
  primaryColor: '#4f46e5',
  supportEmail: 'support@agumentik.com',
  tagline: 'Local SEO & Google Business Profile Growth Platform',
  copyrightYear: 2026,
  copyrightText: '© 2026 Agumentik Software Private Limited',
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
