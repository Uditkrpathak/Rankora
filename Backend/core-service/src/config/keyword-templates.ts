/**
 * Curated Keyword Templates Config (Editable Data)
 * 
 * Maps normalized Google Places / GBP category keys to high-intent local search patterns
 * (English and common Hinglish phrasing, without hardcoded city names).
 */

export interface CategoryTemplate {
  primaryCategory: string;
  categoryDisplayName: string;
  seedTemplates: string[];
  hinglishTemplates?: string[];
  serviceNouns?: string[];
}

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  computer_store: {
    primaryCategory: 'computer_store',
    categoryDisplayName: 'Computer Store',
    seedTemplates: [
      'computer store',
      'computer shop',
      'laptop store',
      'laptop shop',
      'computer repair',
      'laptop repair',
      'computer accessories shop',
      'pc repair service',
    ],
    hinglishTemplates: [
      'computer ki dukan',
      'laptop repair dukan',
      'computer dukan',
    ],
    serviceNouns: ['laptop repair', 'pc repair', 'computer repair', 'screen replacement', 'ssd upgrade', 'virus removal'],
  },
  computer_repair_service: {
    primaryCategory: 'computer_repair_service',
    categoryDisplayName: 'Computer Repair Service',
    seedTemplates: [
      'computer repair service',
      'laptop repair service',
      'pc repair service',
      'macbook repair',
      'computer repair near me',
      'laptop repair near me',
    ],
    hinglishTemplates: [
      'computer repairing dukan',
      'laptop thik karne ki dukan',
    ],
    serviceNouns: ['data recovery', 'motherboard repair', 'laptop servicing', 'windows installation'],
  },
  pharmacy: {
    primaryCategory: 'pharmacy',
    categoryDisplayName: 'Pharmacy / Medical Store',
    seedTemplates: [
      'pharmacy',
      'medical store',
      'chemist',
      'chemist shop',
      '24 hour pharmacy',
      'medicine shop',
    ],
    hinglishTemplates: [
      'medical store near me',
      'dawakhana',
      'dawa ki dukan',
    ],
    serviceNouns: ['home delivery medicine', 'emergency medicine', 'ayurvedic medicine'],
  },
  dental_clinic: {
    primaryCategory: 'dental_clinic',
    categoryDisplayName: 'Dental Clinic / Dentist',
    seedTemplates: [
      'dentist',
      'dental clinic',
      'dental hospital',
      'teeth cleaning',
      'root canal treatment',
      'dental braces',
    ],
    hinglishTemplates: [
      'dant ke doctor',
      'dant ka hospital',
    ],
    serviceNouns: ['root canal', 'teeth whitening', 'dental implants', 'teeth extraction'],
  },
  doctor: {
    primaryCategory: 'doctor',
    categoryDisplayName: 'Doctor / General Physician',
    seedTemplates: [
      'doctor',
      'physician',
      'general physician',
      'clinic',
      'family doctor',
      'medical clinic',
    ],
    hinglishTemplates: [
      'doctor clinic',
      'dawa clinic',
    ],
    serviceNouns: ['general consultation', 'fever treatment', 'health checkup'],
  },
  restaurant: {
    primaryCategory: 'restaurant',
    categoryDisplayName: 'Restaurant',
    seedTemplates: [
      'restaurant',
      'family restaurant',
      'veg restaurant',
      'fine dining',
      'best restaurant',
    ],
    hinglishTemplates: [
      'dhaba',
      'khana',
      'family dhaba',
    ],
    serviceNouns: ['home delivery', 'dine in', 'buffet', 'takeaway'],
  },
  cafe: {
    primaryCategory: 'cafe',
    categoryDisplayName: 'Cafe / Coffee Shop',
    seedTemplates: [
      'cafe',
      'coffee shop',
      'bakery and cafe',
      'coffee house',
    ],
    serviceNouns: ['cold coffee', 'specialty coffee', 'breakfast cafe'],
  },
  car_repair_facility: {
    primaryCategory: 'car_repair_facility',
    categoryDisplayName: 'Car Repair / Auto Workshop',
    seedTemplates: [
      'car repair',
      'car service center',
      'car workshop',
      'car mechanic',
      'wheel alignment',
      'car denting painting',
    ],
    hinglishTemplates: [
      'car mechanic near me',
      'gaadi service centre',
    ],
    serviceNouns: ['car wash', 'oil change', 'car ac service', 'clutch repair'],
  },
  gym: {
    primaryCategory: 'gym',
    categoryDisplayName: 'Gym / Fitness Centre',
    seedTemplates: [
      'gym',
      'fitness center',
      'fitness gym',
      'unisex gym',
      'weight loss center',
    ],
    serviceNouns: ['personal trainer', 'crossfit', 'cardio workout', 'zumba classes'],
  },
  beauty_salon: {
    primaryCategory: 'beauty_salon',
    categoryDisplayName: 'Beauty Salon / Parlour',
    seedTemplates: [
      'beauty parlour',
      'beauty salon',
      'hair salon',
      'women beauty salon',
      'bridal makeup artist',
    ],
    hinglishTemplates: [
      'ladies parlour',
      'beauty parlour near me',
    ],
    serviceNouns: ['hair spa', 'facial treatment', 'waxing', 'bridal makeup'],
  },
  hair_salon: {
    primaryCategory: 'hair_salon',
    categoryDisplayName: 'Hair Salon / Barber',
    seedTemplates: [
      'hair salon',
      'men salon',
      'barber shop',
      'haircut salon',
    ],
    serviceNouns: ['haircut', 'beard styling', 'hair coloring'],
  },
  accounting_firm: {
    primaryCategory: 'accounting_firm',
    categoryDisplayName: 'Chartered Accountant / Tax Consultant',
    seedTemplates: [
      'chartered accountant',
      'ca firm',
      'tax consultant',
      'gst consultant',
      'income tax filing',
      'accounting services',
    ],
    serviceNouns: ['gst registration', 'itr filing', 'company audit', 'tax filing'],
  },
  law_firm: {
    primaryCategory: 'law_firm',
    categoryDisplayName: 'Lawyer / Law Firm',
    seedTemplates: [
      'lawyer',
      'advocate',
      'law firm',
      'legal consultant',
      'property lawyer',
      'divorce lawyer',
    ],
    serviceNouns: ['legal advice', 'court case advocate', 'property verification'],
  },
  real_estate_agency: {
    primaryCategory: 'real_estate_agency',
    categoryDisplayName: 'Real Estate Agent / Property Dealer',
    seedTemplates: [
      'property dealer',
      'real estate agent',
      'property consultant',
      'flats for rent',
      'commercial property dealer',
    ],
    hinglishTemplates: [
      'property dealer near me',
      'makaan kiraye pe',
    ],
    serviceNouns: ['buy flat', 'rent apartment', 'commercial office space'],
  },
  plumber: {
    primaryCategory: 'plumber',
    categoryDisplayName: 'Plumber / Plumbing Services',
    seedTemplates: [
      'plumber',
      'plumbing services',
      'emergency plumber',
      'sanitary repair',
    ],
    hinglishTemplates: [
      'plumber dukan',
      'plumber near me',
    ],
    serviceNouns: ['pipe leakage repair', 'bathroom fitting', 'water tank cleaning'],
  },
  electrician: {
    primaryCategory: 'electrician',
    categoryDisplayName: 'Electrician / Electrical Contractor',
    seedTemplates: [
      'electrician',
      'electrical repair',
      'electrical contractor',
      'wiring electrician',
    ],
    hinglishTemplates: [
      'electrician near me',
      'bijli mistri',
    ],
    serviceNouns: ['fan repair', 'switchboard wiring', 'inverter installation'],
  },
  coaching_center: {
    primaryCategory: 'coaching_center',
    categoryDisplayName: 'Coaching Institute / Tuition',
    seedTemplates: [
      'coaching institute',
      'tuition classes',
      'iit jee coaching',
      'neet coaching',
      'competitive exam coaching',
    ],
    serviceNouns: ['maths tuition', 'science coaching', 'board exam preparation'],
  },
  school: {
    primaryCategory: 'school',
    categoryDisplayName: 'School',
    seedTemplates: [
      'cbse school',
      'icse school',
      'play school',
      'international school',
      'high school',
    ],
    serviceNouns: ['admissions open', 'nursery admission', 'pre school'],
  },
  hotel: {
    primaryCategory: 'hotel',
    categoryDisplayName: 'Hotel / Lodging',
    seedTemplates: [
      'hotel',
      'budget hotel',
      'luxury hotel',
      'guest house',
      'rooms for stay',
    ],
    serviceNouns: ['room booking', 'banquet hall', 'conference room'],
  },
  hospital: {
    primaryCategory: 'hospital',
    categoryDisplayName: 'Hospital / Multispeciality Hospital',
    seedTemplates: [
      'hospital',
      'multispeciality hospital',
      'emergency hospital',
      'maternity hospital',
      'eye hospital',
    ],
    serviceNouns: ['24x7 emergency', 'icu hospital', 'opd consultation'],
  },
  grocery_store: {
    primaryCategory: 'grocery_store',
    categoryDisplayName: 'Grocery Store / Kirana Store',
    seedTemplates: ['grocery store', 'kirana store', 'grocery shop', 'daily needs store'],
    hinglishTemplates: ['kirana dukan', 'ration ki dukan'],
    serviceNouns: [],
  },
  supermarket: {
    primaryCategory: 'supermarket',
    categoryDisplayName: 'Supermarket / Grocery Store',
    seedTemplates: [
      'supermarket',
      'grocery store',
      'departmental store',
      'daily needs store',
    ],
    hinglishTemplates: [
      'kirana store',
      'kirana dukan',
      'ration ki dukan',
    ],
    serviceNouns: ['home delivery grocery', 'packaged food', 'fresh vegetables'],
  },
  optician: {
    primaryCategory: 'optician',
    categoryDisplayName: 'Optician / Eye Wear',
    seedTemplates: [
      'optician',
      'optical shop',
      'eye glasses shop',
      'spectacles shop',
      'sunglasses store',
    ],
    serviceNouns: ['eye testing', 'contact lenses', 'frame repair'],
  },
  jeweler: {
    primaryCategory: 'jeweler',
    categoryDisplayName: 'Jewellery Store / Jeweller',
    seedTemplates: [
      'jeweller',
      'jewellery store',
      'gold jewellery shop',
      'diamond showroom',
    ],
    hinglishTemplates: [
      'sunar ki dukan',
      'jewellery showroom',
    ],
    serviceNouns: ['hallmark gold', 'custom jewellery', 'silver ornaments'],
  },
  clothing_store: {
    primaryCategory: 'clothing_store',
    categoryDisplayName: 'Clothing Store / Garments Shop',
    seedTemplates: [
      'clothing store',
      'garments shop',
      'men clothing store',
      'women apparel store',
      'ethnic wear shop',
    ],
    hinglishTemplates: [
      'kapde ki dukan',
    ],
    serviceNouns: ['readymade garments', 'designer suits', 'saree showroom'],
  },
  dry_cleaner: {
    primaryCategory: 'dry_cleaner',
    categoryDisplayName: 'Dry Cleaner / Laundry',
    seedTemplates: [
      'dry cleaner',
      'laundry service',
      'steam press service',
      'dry cleaning shop',
    ],
    serviceNouns: ['saree dry clean', 'suit dry clean', 'carpet dry cleaning'],
  },
  pet_store: {
    primaryCategory: 'pet_store',
    categoryDisplayName: 'Pet Shop / Vet Clinic',
    seedTemplates: [
      'pet shop',
      'veterinary clinic',
      'dog clinic',
      'pet food store',
      'pet grooming',
    ],
    serviceNouns: ['dog vaccination', 'vet doctor', 'pet food delivery'],
  },
  courier_service: {
    primaryCategory: 'courier_service',
    categoryDisplayName: 'Courier Service / Parcel Delivery',
    seedTemplates: [
      'courier service',
      'parcel delivery',
      'domestic courier',
      'international courier',
    ],
    serviceNouns: ['speed post', 'document courier', 'cargo delivery'],
  },
  furniture_store: {
    primaryCategory: 'furniture_store',
    categoryDisplayName: 'Furniture Store / Showroom',
    seedTemplates: [
      'furniture store',
      'furniture shop',
      'wooden furniture showroom',
      'office furniture',
      'sofa manufacturer',
    ],
    serviceNouns: ['custom furniture', 'sofa repair', 'modular kitchen'],
  },
  florist: {
    primaryCategory: 'florist',
    categoryDisplayName: 'Florist / Flower Shop',
    seedTemplates: [
      'florist',
      'flower shop',
      'bouquet delivery',
      'fresh flowers shop',
    ],
    serviceNouns: ['flower decoration', 'birthday bouquet', 'wedding garlands'],
  },
  bakery: {
    primaryCategory: 'bakery',
    categoryDisplayName: 'Bakery / Cake Shop',
    seedTemplates: [
      'bakery',
      'cake shop',
      'pastry shop',
      'custom cake bakery',
    ],
    serviceNouns: ['birthday cake delivery', 'eggless cakes', 'fresh cookies'],
  },
  corporate_office: {
    primaryCategory: 'corporate_office',
    categoryDisplayName: 'Corporate Office / Business Enterprise',
    seedTemplates: [
      'corporate office',
      'head office',
      'regional office',
      'company office',
      'business enterprise',
    ],
    serviceNouns: ['corporate headquarters', 'branch office'],
  },
  engineering_consultant: {
    primaryCategory: 'engineering_consultant',
    categoryDisplayName: 'Engineering Company / Consultant',
    seedTemplates: [
      'engineering company',
      'engineering consultant',
      'industrial engineering firm',
      'mechanical engineering services',
      'civil engineering consultant',
    ],
    serviceNouns: ['industrial design', 'plant engineering', 'technical consultancy'],
  },
  stationery_store: {
    primaryCategory: 'stationery_store',
    categoryDisplayName: 'Stationery Store / Book Shop',
    seedTemplates: [
      'stationery shop',
      'stationery store',
      'book store',
      'book depot',
      'office supplies store',
      'school stationery',
      'pen and notebook shop',
      'stationery items',
    ],
    hinglishTemplates: [
      'stationery ki dukan',
      'kitab ki dukan',
      'stationery dukan near me',
    ],
    serviceNouns: ['school books', 'office stationery', 'art supplies', 'photocopy printing'],
  },
  printing_service: {
    primaryCategory: 'printing_service',
    categoryDisplayName: 'Printing Services / Digital Press',
    seedTemplates: [
      'printing press',
      'digital printing services',
      'flex banner printing',
      'visiting card printing',
      'photocopy shop',
      'xerox shop',
      'offset printing',
    ],
    serviceNouns: ['pamphlet printing', 'mug printing', 't shirt printing', 'poster printing'],
  },
  hardware_store: {
    primaryCategory: 'hardware_store',
    categoryDisplayName: 'Hardware Store / Sanitaryware',
    seedTemplates: [
      'hardware store',
      'hardware shop',
      'sanitary store',
      'paint shop',
      'plywood shop',
      'building material supplier',
    ],
    hinglishTemplates: [
      'hardware ki dukan',
      'paint ki dukan',
    ],
    serviceNouns: ['power tools', 'paints', 'sanitary fittings', 'plumbing items'],
  },
  electronics_store: {
    primaryCategory: 'electronics_store',
    categoryDisplayName: 'Electronics Store / Mobile Shop',
    seedTemplates: [
      'electronics store',
      'electronics shop',
      'mobile shop',
      'smartphone store',
      'home appliances store',
      'tv showroom',
    ],
    hinglishTemplates: [
      'mobile ki dukan',
      'electronics dukan',
    ],
    serviceNouns: ['mobile accessories', 'smart tv', 'ac showroom', 'refrigerator'],
  },
  tailor: {
    primaryCategory: 'tailor',
    categoryDisplayName: 'Tailor / Designer Boutique',
    seedTemplates: [
      'tailor shop',
      'ladies tailor',
      'gents tailor',
      'boutique',
      'custom tailoring',
      'suit stitching',
    ],
    hinglishTemplates: [
      'darzi ki dukan',
      'ladies tailor near me',
    ],
    serviceNouns: ['suit stitching', 'blouse stitching', 'pant shirt stitching', 'alteration'],
  },
};

