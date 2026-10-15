/**
 * Production-grade Real-World Form Validation Utilities for Localo
 */

// Domain & TLD matching regex (supports standard domains, subdomains, and international TLDs)
const DOMAIN_REGEX = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?$/i;

// Google Maps specific URL patterns
const GMAPS_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|g\.page)\/[-a-zA-Z0-9@:%_\+.~#?&//=]*$/i;

// Phone number: 7 to 15 digits with optional +, parentheses, dashes, dots, spaces
const PHONE_DIGITS_REGEX = /^\+?[0-9\s().-]{7,25}$/;

// Postal code: 3 to 10 characters (US 5/9 digits, UK alphanumeric, Canada alphanumeric, India 6 digits, etc.)
const POSTAL_CODE_REGEX = /^[a-zA-Z0-9\s-]{3,10}$/;

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function validateBusinessName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Business or agency name is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Business name must be at least 2 characters.' };
  }
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Business name cannot exceed 100 characters.' };
  }
  // Must contain at least one letter or number (not just punctuation like '---' or '...')
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid business name containing letters or numbers.' };
  }
  return { isValid: true };
}

export function validateUrl(url: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { isValid: true, normalizedUrl: '' };
  }

  // Check against Google Maps or standard domain regex
  const isGmaps = GMAPS_REGEX.test(trimmed);
  const isStandardDomain = DOMAIN_REGEX.test(trimmed);

  if (!isGmaps && !isStandardDomain) {
    return {
      isValid: false,
      error: 'Please enter a valid website URL (e.g. https://apexsmiles.com or apexsmiles.com) or Google Maps link.',
    };
  }

  // Ensure hostname has a dot and valid ending
  const normalized = normalizeUrl(trimmed);
  try {
    const parsed = new URL(normalized);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length < 2 || hostParts[hostParts.length - 1].length < 2) {
      return { isValid: false, error: 'Please enter a valid website domain with an extension (e.g. .com, .io).' };
    }
  } catch {
    return { isValid: false, error: 'Invalid URL format.' };
  }

  return { isValid: true, normalizedUrl: normalized };
}

export function validatePhone(phone: string): { isValid: boolean; error?: string; normalizedPhone?: string } {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: true, normalizedPhone: '' };
  }

  if (!PHONE_DIGITS_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid phone number (e.g. +1 (512) 555-0199 or 512-555-0199).',
    };
  }

  // Count raw digits
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount < 7 || digitCount > 15) {
    return {
      isValid: false,
      error: 'Phone number must contain between 7 and 15 digits.',
    };
  }

  // Check for unrealistic repetitive digits e.g. "0000000" or "11111111"
  if (/^(\d)\1+$/.test(trimmed.replace(/\D/g, ''))) {
    return {
      isValid: false,
      error: 'Please enter a real business phone number.',
    };
  }

  return { isValid: true, normalizedPhone: trimmed };
}

export function validateCity(city: string): { isValid: boolean; error?: string } {
  const trimmed = city.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Target city or area is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'City name must be at least 2 characters.' };
  }
  if (trimmed.length > 80) {
    return { isValid: false, error: 'City name cannot exceed 80 characters.' };
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid city or metropolitan area (e.g. Austin, Texas).' };
  }
  return { isValid: true };
}

export function validatePostalCode(postalCode: string): { isValid: boolean; error?: string } {
  const trimmed = postalCode.trim();
  if (!trimmed) {
    return { isValid: true };
  }
  if (!POSTAL_CODE_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid ZIP or postal code (e.g. 78701, SW1A 1AA, or 560001).',
    };
  }
  return { isValid: true };
}

export function validateAddress(address: string): { isValid: boolean; error?: string } {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Street address is required.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Street address must be at least 3 characters.' };
  }
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid street address (e.g. 123 Main St).' };
  }
  return { isValid: true };
}

export function validateCustomCategory(category: string): { isValid: boolean; error?: string } {
  const trimmed = category.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please specify your exact business category.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Category name must be at least 3 characters.' };
  }
  if (trimmed.length > 60) {
    return { isValid: false, error: 'Category name cannot exceed 60 characters.' };
  }
  if (!/^[a-zA-Z\s&/'-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Category should only contain letters and standard characters (e.g. Cosmetic Dentist, Yoga Studio).',
    };
  }
  return { isValid: true };
}
