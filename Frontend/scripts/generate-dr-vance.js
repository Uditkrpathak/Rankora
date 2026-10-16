import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Vector graphic matching the screenshot's Dr. Jennifer Vance photo
const drVanceSvg = `
<svg width="600" height="480" viewBox="0 0 600 480" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="officeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E8EEFA" />
      <stop offset="100%" stop-color="#D5DFFA" />
    </linearGradient>
    <linearGradient id="woodPanel" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8D6E63" />
      <stop offset="100%" stop-color="#6D4C41" />
    </linearGradient>
    <linearGradient id="coatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F0F4F8" />
    </linearGradient>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE4D6" />
      <stop offset="100%" stop-color="#F5CBA7" />
    </linearGradient>
    <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4E342E" />
      <stop offset="100%" stop-color="#2D1B18" />
    </linearGradient>
  </defs>

  <!-- Office Background -->
  <rect width="600" height="480" fill="url(#officeBg)" />
  <rect x="0" y="0" width="600" height="180" fill="#F8FAFC" />
  
  <!-- Clinic Wood Feature Wall behind doctor -->
  <rect x="260" y="40" width="300" height="240" rx="12" fill="url(#woodPanel)" />
  
  <!-- Clinic Logo on Wall (Vance Family Dental) -->
  <path d="M 400 70 C 385 70 380 85 390 100 C 395 108 400 120 400 130 C 400 120 405 108 410 100 C 420 85 415 70 400 70 Z" fill="#FFFFFF" fill-opacity="0.85" stroke="#FFFFFF" stroke-width="2" />
  <text x="400" y="160" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="18" text-anchor="middle" letter-spacing="2">VANCE</text>
  <text x="400" y="180" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="11" text-anchor="middle" letter-spacing="3" fill-opacity="0.9">FAMILY DENTAL</text>

  <!-- Doctor Silhouette & Attire -->
  <!-- Long Dark Hair Behind -->
  <path d="M 120 220 Q 90 280 100 360 Q 150 380 200 360 Q 210 280 180 220 Z" fill="url(#hairGrad)" />

  <!-- White Lab Coat / Shoulders -->
  <path d="M 40 480 Q 70 320 150 310 Q 230 320 260 480 Z" fill="url(#coatGrad)" stroke="#CBD5E1" stroke-width="1.5" />
  
  <!-- Lapels -->
  <path d="M 120 310 L 150 410 L 110 480" stroke="#CBD5E1" stroke-width="2" fill="none" />
  <path d="M 180 310 L 150 410 L 190 480" stroke="#CBD5E1" stroke-width="2" fill="none" />
  <!-- Blue inner scrub shirt -->
  <polygon points="135,310 165,310 150,360" fill="#1CB5D6" />

  <!-- Neck -->
  <rect x="135" y="240" width="30" height="75" rx="8" fill="url(#skinGrad)" />

  <!-- Face -->
  <ellipse cx="150" cy="200" rx="42" ry="52" fill="url(#skinGrad)" />
  
  <!-- Hair Front Waves -->
  <path d="M 105 190 Q 110 140 150 140 Q 190 140 195 190 Q 170 160 150 165 Q 130 160 105 190 Z" fill="url(#hairGrad)" />
  <path d="M 105 190 Q 100 240 115 280 Q 125 240 120 200 Z" fill="url(#hairGrad)" />
  <path d="M 195 190 Q 200 240 185 280 Q 175 240 180 200 Z" fill="url(#hairGrad)" />

  <!-- Eyes & Smile -->
  <circle cx="135" cy="195" r="4" fill="#2D1B18" />
  <circle cx="165" cy="195" r="4" fill="#2D1B18" />
  <path d="M 130 185 Q 135 180 140 185" stroke="#2D1B18" stroke-width="1.5" fill="none" />
  <path d="M 160 185 Q 165 180 170 185" stroke="#2D1B18" stroke-width="1.5" fill="none" />
  <!-- Warm Friendly Smile -->
  <path d="M 136 222 Q 150 238 164 222" stroke="#B71C1C" stroke-width="2" fill="#FFFFFF" />

  <!-- Stethoscope (Professional Detail) -->
  <path d="M 125 320 Q 120 370 140 390 Q 150 400 160 390 Q 180 370 175 320" stroke="#37474F" stroke-width="4" fill="none" />
  <circle cx="150" cy="405" r="10" fill="#90A4AE" stroke="#37474F" stroke-width="3" />

  <!-- Arms Folded Posture -->
  <path d="M 60 480 Q 100 420 150 425 Q 200 420 240 480" fill="url(#coatGrad)" stroke="#CBD5E1" stroke-width="1.5" />
</svg>
`;

async function run() {
  await sharp(Buffer.from(drVanceSvg)).webp({ quality: 90 }).toFile(path.join(publicDir, 'dr-vance.webp'));
  await sharp(Buffer.from(drVanceSvg)).webp({ quality: 90 }).toFile(path.join(publicDir, 'owner-storefront.webp'));
  console.log('Generated dr-vance.webp and updated owner-storefront.webp');
}

run().catch(console.error);
