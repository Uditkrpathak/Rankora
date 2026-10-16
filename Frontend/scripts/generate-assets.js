import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. hero-dashboard.webp
const heroSvg = `
<svg width="1440" height="900" viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg">
  <rect width="1440" height="900" rx="20" fill="#0E1230"/>
  <!-- Top App Bar -->
  <rect x="0" y="0" width="1440" height="64" fill="#141838" rx="20 20 0 0"/>
  <circle cx="36" cy="32" r="6" fill="#FF5F56"/>
  <circle cx="56" cy="32" r="6" fill="#FFBD2E"/>
  <circle cx="76" cy="32" r="6" fill="#27C93F"/>
  <rect x="120" y="18" width="400" height="28" rx="8" fill="#1D234D"/>
  <text x="140" y="37" fill="#8892B0" font-family="sans-serif" font-size="13">rankora.app/dashboard/local-seo-overview</text>
  
  <!-- Left Sidebar -->
  <rect x="24" y="88" width="240" height="788" rx="16" fill="#141838"/>
  <rect x="44" y="112" width="160" height="32" rx="8" fill="#2E3192"/>
  <text x="60" y="133" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">Maps Rank Tracker</text>
  <rect x="44" y="160" width="200" height="28" rx="8" fill="#1D234D"/>
  <text x="60" y="179" fill="#8892B0" font-family="sans-serif" font-size="13">GBP Manager</text>
  <rect x="44" y="200" width="200" height="28" rx="8" fill="#1D234D"/>
  <text x="60" y="219" fill="#8892B0" font-family="sans-serif" font-size="13">Reviews &amp; AI Replies</text>
  <rect x="44" y="240" width="200" height="28" rx="8" fill="#1D234D"/>
  <text x="60" y="259" fill="#8892B0" font-family="sans-serif" font-size="13">Competitor Matrix</text>

  <!-- Main Canvas / Grid Map -->
  <rect x="288" y="88" width="1128" height="788" rx="16" fill="#101538"/>
  
  <!-- Heatmap circles and pins -->
  <circle cx="850" cy="460" r="280" fill="rgba(46,49,146,0.25)" stroke="#2E3192" stroke-width="2"/>
  <circle cx="850" cy="460" r="190" fill="rgba(28,181,214,0.18)" stroke="#1CB5D6" stroke-width="2"/>
  <circle cx="850" cy="460" r="100" fill="rgba(31,169,113,0.22)" stroke="#1FA971" stroke-width="2"/>
  
  <!-- Center Pin -->
  <circle cx="850" cy="460" r="24" fill="#1FA971" stroke="#FFFFFF" stroke-width="3"/>
  <text x="844" y="466" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="16">1</text>

  <!-- Outer Pins -->
  <circle cx="770" cy="420" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="765" y="425" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">1</text>

  <circle cx="930" cy="430" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="925" y="435" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">1</text>

  <circle cx="850" cy="340" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="845" y="345" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">2</text>

  <circle cx="850" cy="580" r="18" fill="#1CB5D6" stroke="#FFFFFF" stroke-width="2"/>
  <text x="845" y="585" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">3</text>

  <circle cx="710" cy="350" r="18" fill="#1CB5D6" stroke="#FFFFFF" stroke-width="2"/>
  <text x="705" y="355" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">3</text>

  <circle cx="1000" cy="490" r="18" fill="#E67E22" stroke="#FFFFFF" stroke-width="2"/>
  <text x="995" y="495" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">4</text>

  <circle cx="680" cy="550" r="18" fill="#E74C3C" stroke="#FFFFFF" stroke-width="2"/>
  <text x="672" y="555" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="12">7</text>

  <!-- Metric overlay cards -->
  <rect x="320" y="120" width="280" height="90" rx="14" fill="#181E48" stroke="rgba(28,181,214,0.3)"/>
  <text x="340" y="150" fill="#8892B0" font-family="sans-serif" font-size="12">MAP PACK VISIBILITY</text>
  <text x="340" y="185" fill="#1FA971" font-family="sans-serif" font-weight="bold" font-size="28">96.4%</text>
  <text x="430" y="183" fill="#1CB5D6" font-family="sans-serif" font-size="12">+18.2% this month</text>

  <rect x="620" y="120" width="280" height="90" rx="14" fill="#181E48" stroke="rgba(46,49,146,0.3)"/>
  <text x="640" y="150" fill="#8892B0" font-family="sans-serif" font-size="12">AVG GOOGLE RANK</text>
  <text x="640" y="185" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="28">#1.4</text>
  <text x="715" y="183" fill="#1FA971" font-family="sans-serif" font-size="12">Top 3 across 18 km</text>
</svg>
`;

// 2. map-rankings.webp
const mapRankingsSvg = `
<svg width="960" height="720" viewBox="0 0 960 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="720" rx="16" fill="#F4F7FC"/>
  <path d="M0,120 L960,120 M0,240 L960,240 M0,360 L960,360 M0,480 L960,480 M0,600 L960,600" stroke="#E2E8F4" stroke-width="1.5"/>
  <path d="M160,0 L160,720 M320,0 L320,720 M480,0 L480,720 M640,0 L640,720 M800,0 L800,720" stroke="#E2E8F4" stroke-width="1.5"/>
  
  <!-- Road Network Simulation -->
  <path d="M120,40 Q480,220 840,160" stroke="#D1DCF0" stroke-width="8" fill="none"/>
  <path d="M480,40 L480,680" stroke="#CBD8EE" stroke-width="12" fill="none"/>
  <path d="M80,480 Q480,420 880,560" stroke="#CBD8EE" stroke-width="10" fill="none"/>

  <!-- Rings -->
  <circle cx="480" cy="360" r="240" fill="rgba(46,49,146,0.06)" stroke="rgba(46,49,146,0.2)" stroke-width="2" stroke-dasharray="6,6"/>
  <circle cx="480" cy="360" r="150" fill="rgba(28,181,214,0.08)" stroke="rgba(28,181,214,0.3)" stroke-width="2"/>
  <circle cx="480" cy="360" r="70" fill="rgba(31,169,113,0.12)" stroke="rgba(31,169,113,0.4)" stroke-width="2"/>

  <!-- Center Pin -->
  <circle cx="480" cy="360" r="26" fill="#2E3192" stroke="#FFFFFF" stroke-width="3"/>
  <text x="473" y="367" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="18">1</text>

  <!-- Pins -->
  <circle cx="420" cy="310" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="415" y="315" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">1</text>

  <circle cx="540" cy="320" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="535" y="325" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">1</text>

  <circle cx="480" cy="240" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="475" y="245" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">2</text>

  <circle cx="360" cy="380" r="18" fill="#1FA971" stroke="#FFFFFF" stroke-width="2"/>
  <text x="355" y="385" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">2</text>

  <circle cx="600" cy="400" r="18" fill="#1CB5D6" stroke="#FFFFFF" stroke-width="2"/>
  <text x="595" y="405" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">3</text>

  <circle cx="480" cy="480" r="18" fill="#1CB5D6" stroke="#FFFFFF" stroke-width="2"/>
  <text x="475" y="485" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">3</text>

  <circle cx="300" cy="260" r="18" fill="#E67E22" stroke="#FFFFFF" stroke-width="2"/>
  <text x="295" y="265" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">5</text>

  <circle cx="680" cy="460" r="18" fill="#E67E22" stroke="#FFFFFF" stroke-width="2"/>
  <text x="675" y="465" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="13">6</text>

  <!-- Legend Card -->
  <rect x="40" y="40" width="220" height="96" rx="12" fill="#FFFFFF" stroke="rgba(46,49,146,0.12)"/>
  <text x="60" y="68" fill="#141833" font-family="sans-serif" font-weight="bold" font-size="14">Geo-Grid Coverage</text>
  <text x="60" y="90" fill="#5A6180" font-family="sans-serif" font-size="12">Keyword: &quot;dentist near me&quot;</text>
  <text x="60" y="112" fill="#1FA971" font-family="sans-serif" font-weight="bold" font-size="12">Rank #1 (89% of area)</text>
</svg>
`;

// 3. owner-storefront.webp (Case Study Image)
const ownerStorefrontSvg = `
<svg width="960" height="720" viewBox="0 0 960 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141838"/>
      <stop offset="100%" stop-color="#0E1230"/>
    </linearGradient>
  </defs>
  <rect width="960" height="720" rx="16" fill="url(#bg)"/>
  
  <!-- Architectural Outline of Storefront -->
  <rect x="180" y="140" width="600" height="440" rx="12" fill="#1A204C" stroke="#2E3192" stroke-width="2"/>
  <rect x="220" y="190" width="220" height="260" rx="8" fill="#242B66"/>
  <rect x="520" y="190" width="220" height="260" rx="8" fill="#242B66"/>
  
  <!-- Storefront Awning -->
  <path d="M160,140 L800,140 L760,190 L200,190 Z" fill="#2E3192"/>
  <text x="360" y="172" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="18">MODERN CLINIC &amp; PRACTICE</text>

  <!-- Google Verification Badge -->
  <rect x="220" y="500" width="520" height="50" rx="8" fill="#1FA971"/>
  <text x="330" y="532" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="16">Google Maps Verified · Top 3 Local Pack</text>

  <!-- Floating Stats Card -->
  <rect x="60" y="80" width="260" height="110" rx="16" fill="#FFFFFF" stroke="rgba(46,49,146,0.12)"/>
  <text x="84" y="112" fill="#5A6180" font-family="sans-serif" font-size="12">CALLS THIS MONTH</text>
  <text x="84" y="152" fill="#141833" font-family="sans-serif" font-weight="bold" font-size="32">+112%</text>
  <text x="84" y="174" fill="#1FA971" font-family="sans-serif" font-weight="bold" font-size="12">248 incoming inquiries</text>
</svg>
`;

// 4. reviews-panel.webp
const reviewsPanelSvg = `
<svg width="960" height="720" viewBox="0 0 960 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="720" rx="16" fill="#F4F7FC"/>
  <!-- Reviews Card 1 -->
  <rect x="80" y="80" width="800" height="160" rx="16" fill="#FFFFFF" stroke="rgba(46,49,146,0.1)"/>
  <circle cx="130" cy="130" r="24" fill="#E8EEFA"/>
  <text x="122" y="136" fill="#2E3192" font-family="sans-serif" font-weight="bold" font-size="16">JS</text>
  <text x="170" y="125" fill="#141833" font-family="sans-serif" font-weight="bold" font-size="15">Jessica Scott</text>
  <text x="170" y="145" fill="#5A6180" font-family="sans-serif" font-size="12">2 days ago · Verified Google Review</text>
  <text x="170" y="175" fill="#FFB800" font-family="sans-serif" font-size="18">★★★★★</text>
  <text x="170" y="205" fill="#141833" font-family="sans-serif" font-size="13">&quot;Incredible staff and gentle care. Found them on Google Maps while looking for an emergency appointment.&quot;</text>
  <rect x="680" y="110" width="160" height="36" rx="8" fill="#1FA971"/>
  <text x="702" y="133" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="12">AI Replied</text>

  <!-- Reviews Card 2 -->
  <rect x="80" y="270" width="800" height="160" rx="16" fill="#FFFFFF" stroke="rgba(46,49,146,0.1)"/>
  <circle cx="130" cy="320" r="24" fill="#E8EEFA"/>
  <text x="122" y="326" fill="#2E3192" font-family="sans-serif" font-weight="bold" font-size="16">DK</text>
  <text x="170" y="315" fill="#141833" font-family="sans-serif" font-weight="bold" font-size="15">David Kim</text>
  <text x="170" y="335" fill="#5A6180" font-family="sans-serif" font-size="12">5 days ago · Local Guide</text>
  <text x="170" y="365" fill="#FFB800" font-family="sans-serif" font-size="18">★★★★★</text>
  <text x="170" y="395" fill="#141833" font-family="sans-serif" font-size="13">&quot;Hands down the top practice in town. Very thorough consultation and modern equipment.&quot;</text>
  <rect x="680" y="300" width="160" height="36" rx="8" fill="#1FA971"/>
  <text x="702" y="323" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="12">AI Replied</text>
  
  <!-- Review Stats Banner -->
  <rect x="80" y="460" width="800" height="160" rx="16" fill="#0E1230"/>
  <text x="120" y="520" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="28">4.9 Average Rating</text>
  <text x="120" y="550" fill="#8892B0" font-family="sans-serif" font-size="14">Based on 342 authentic customer reviews on Google Maps</text>
  <text x="120" y="585" fill="#1CB5D6" font-family="sans-serif" font-weight="bold" font-size="13">+24 new 5-star reviews captured this week</text>
</svg>
`;

// 5. avatar-1.webp, avatar-2.webp, avatar-3.webp
const avatarSvgs = [
  {
    name: 'avatar-1.webp',
    svg: `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="240" rx="120" fill="#2E3192"/>
      <circle cx="120" cy="90" r="45" fill="#FFFFFF"/>
      <ellipse cx="120" cy="200" rx="70" ry="50" fill="#FFFFFF"/>
    </svg>`
  },
  {
    name: 'avatar-2.webp',
    svg: `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="240" rx="120" fill="#1CB5D6"/>
      <circle cx="120" cy="90" r="45" fill="#FFFFFF"/>
      <ellipse cx="120" cy="200" rx="70" ry="50" fill="#FFFFFF"/>
    </svg>`
  },
  {
    name: 'avatar-3.webp',
    svg: `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="240" rx="120" fill="#0E1230"/>
      <circle cx="120" cy="90" r="45" fill="#FFFFFF"/>
      <ellipse cx="120" cy="200" rx="70" ry="50" fill="#FFFFFF"/>
    </svg>`
  }
];

async function generateAll() {
  console.log('Generating WebP images...');
  
  // Hero dashboard
  await sharp(Buffer.from(heroSvg)).webp({ quality: 85 }).toFile(path.join(publicDir, 'hero-dashboard.webp'));
  await sharp(Buffer.from(heroSvg)).resize(960).webp({ quality: 85 }).toFile(path.join(publicDir, 'hero-dashboard-960w.webp'));
  await sharp(Buffer.from(heroSvg)).resize(480).webp({ quality: 85 }).toFile(path.join(publicDir, 'hero-dashboard-480w.webp'));

  // Map rankings
  await sharp(Buffer.from(mapRankingsSvg)).webp({ quality: 85 }).toFile(path.join(publicDir, 'map-rankings.webp'));
  await sharp(Buffer.from(mapRankingsSvg)).resize(480).webp({ quality: 85 }).toFile(path.join(publicDir, 'map-rankings-480w.webp'));

  // Owner storefront
  await sharp(Buffer.from(ownerStorefrontSvg)).webp({ quality: 85 }).toFile(path.join(publicDir, 'owner-storefront.webp'));
  await sharp(Buffer.from(ownerStorefrontSvg)).resize(480).webp({ quality: 85 }).toFile(path.join(publicDir, 'owner-storefront-480w.webp'));

  // Reviews panel
  await sharp(Buffer.from(reviewsPanelSvg)).webp({ quality: 85 }).toFile(path.join(publicDir, 'reviews-panel.webp'));
  await sharp(Buffer.from(reviewsPanelSvg)).resize(480).webp({ quality: 85 }).toFile(path.join(publicDir, 'reviews-panel-480w.webp'));

  // Avatars
  for (const a of avatarSvgs) {
    await sharp(Buffer.from(a.svg)).webp({ quality: 90 }).toFile(path.join(publicDir, a.name));
  }

  console.log('Successfully generated all WebP images in public/ directory!');
}

generateAll().catch(console.error);
