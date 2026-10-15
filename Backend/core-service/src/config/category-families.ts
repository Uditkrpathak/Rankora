/**
 * Category Families & Equivalences Config
 * 
 * Groups related Google Maps category names into semantic families
 * for relevance probe scoring.
 */

export const CATEGORY_FAMILIES: Record<string, string[]> = {
  computer_store: [
    'computer store',
    'computer shop',
    'computer repair service',
    'computer service',
    'electronics store',
    'computer support and services',
    'computer accessories store',
    'used computer store',
    'laptop repair service',
    'cell phone store',
  ],
  pharmacy: [
    'pharmacy',
    'chemist',
    'drug store',
    'medical supply store',
    'ayurvedic clinic',
    'homeopathic pharmacy',
  ],
  dental_clinic: [
    'dentist',
    'dental clinic',
    'dental hygienist',
    'orthodontist',
    'cosmetic dentist',
    'pediatric dentist',
    'dental radiology',
  ],
  doctor: [
    'doctor',
    'general practitioner',
    'physician',
    'medical clinic',
    'specialized clinic',
    'pediatrician',
    'cardiologist',
    'dermatologist',
    'gynecologist',
    'surgeon',
  ],
  restaurant: [
    'restaurant',
    'fast food restaurant',
    'family restaurant',
    'vegetarian restaurant',
    'north indian restaurant',
    'south indian restaurant',
    'chinese restaurant',
    'dhaba',
    'diner',
    'bistro',
  ],
  car_repair_facility: [
    'car repair and maintenance service',
    'auto repair shop',
    'auto restoration service',
    'car service',
    'brake shop',
    'wheel alignment service',
    'oil change service',
    'car wash',
  ],
  gym: [
    'gym',
    'fitness center',
    'personal trainer',
    'weight loss center',
    'yoga studio',
    'crossfit gym',
  ],
  beauty_salon: [
    'beauty salon',
    'hair salon',
    'nail salon',
    'spa',
    'skin care clinic',
    'make-up artist',
  ],
  corporate_office: [
    'corporate office',
    'headquarters',
    'company',
    'business center',
    'holding company',
    'engineering consultant',
    'office space rental agency',
  ],
};

export function isCategoryInSameFamily(cat1?: string, cat2?: string): boolean {
  if (!cat1 || !cat2) return false;
  const c1 = cat1.toLowerCase().trim();
  const c2 = cat2.toLowerCase().trim();
  if (c1 === c2 || c1.includes(c2) || c2.includes(c1)) return true;

  for (const family of Object.values(CATEGORY_FAMILIES)) {
    const normFamily = family.map((f) => f.toLowerCase().trim());
    const matchesC1 = normFamily.some((f) => c1.includes(f) || f.includes(c1));
    const matchesC2 = normFamily.some((f) => c2.includes(f) || f.includes(c2));
    if (matchesC1 && matchesC2) return true;
  }

  return false;
}

export const GENERIC_BLOCKLIST: string[] = [
  'services',
  'service',
  'business_services',
  'business services',
  'general',
  'professional_services',
  'professional services',
  'local_services',
  'local services',
  'business',
  'local_business',
  'local business',
  'establishment',
  'point_of_interest',
  'premise',
  'subpremise',
  'store',
  'food',
  'health',
  'finance',
  'general_contractor',
  'unspecified',
];
