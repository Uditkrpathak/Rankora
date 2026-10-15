import mongoose from 'mongoose';
import * as argon2 from 'argon2';
import { ARGON2_CONFIG } from '@localo/shared';
import { connectDatabase } from '../config/db';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { Location } from '../models/Location';
import { GoogleConnection } from '../models/GoogleConnection';
import { Scan } from '../models/Scan';
import { Audit } from '../models/Audit';
import { Competitor } from '../models/Competitor';
import { auditService } from '../modules/audits/audit.service';
import { googleVaultService } from '../modules/google/google-vault.service';
import { GridGenerator } from '../modules/rankings/grid-generator';
import { MetricsCalculator } from '../modules/rankings/metrics-calculator';
import { IGridPointResult, IRankItem } from '@localo/types';

export async function seedAllPhasesData() {
  console.log('🚀 Starting Localo Master Seeder for All Phases (Phase 1, 2 & 3)...');
  await connectDatabase();

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 1: Users, Workspace & Team Members
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n--- [Phase 1] Seeding Multi-Tenant Auth, Workspace & Team ---');

  const defaultPasswordHash = await argon2.hash('Password123!', {
    memoryCost: ARGON2_CONFIG.memoryCost,
    timeCost: ARGON2_CONFIG.timeCost,
    parallelism: ARGON2_CONFIG.parallelism,
    type: argon2.argon2id,
  });

  // 1. Owner User
  let owner = await User.findOne({ email: 'alex.vance@apexdental.com' });
  if (!owner) {
    owner = await User.create({
      email: 'alex.vance@apexdental.com',
      passwordHash: defaultPasswordHash,
      argon2Version: ARGON2_CONFIG.version,
      sessionVersion: 1,
      name: 'Dr. Alex Vance',
      status: 'ACTIVE',
      isEmailVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    });
  } else {
    owner.passwordHash = defaultPasswordHash;
    owner.isEmailVerified = true;
    owner.status = 'ACTIVE';
    await owner.save();
  }

  // 2. Admin User
  let admin = await User.findOne({ email: 'sarah.marketing@apexdental.com' });
  if (!admin) {
    admin = await User.create({
      email: 'sarah.marketing@apexdental.com',
      passwordHash: defaultPasswordHash,
      argon2Version: ARGON2_CONFIG.version,
      sessionVersion: 1,
      name: 'Sarah Jenkins (Marketing)',
      status: 'ACTIVE',
      isEmailVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    });
  } else {
    admin.passwordHash = defaultPasswordHash;
    admin.isEmailVerified = true;
    admin.status = 'ACTIVE';
    await admin.save();
  }

  // 3. Member User
  let member = await User.findOne({ email: 'mike.reception@apexdental.com' });
  if (!member) {
    member = await User.create({
      email: 'mike.reception@apexdental.com',
      passwordHash: defaultPasswordHash,
      argon2Version: ARGON2_CONFIG.version,
      sessionVersion: 1,
      name: 'Mike Ross (Front Desk)',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
  } else {
    member.passwordHash = defaultPasswordHash;
    member.isEmailVerified = true;
    member.status = 'ACTIVE';
    await member.save();
  }

  // 4. Primary Workspace
  let workspace = await Workspace.findOne({ ownerId: owner._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: 'Apex Dental Group NYC',
      ownerId: owner._id,
      status: 'ACTIVE',
      plan: {
        key: 'pro',
        status: 'active',
        periodEnd: new Date(Date.now() + 365 * 86400000),
      },
      limits: {
        locations: 10,
        seats: 10,
        scanCredits: 100,
        aiCredits: 250,
      },
      branding: {
        category: 'Dental Healthcare',
        targetCity: 'New York, NY',
        websiteUrl: 'https://apexpremierdental.com',
        phoneNumber: '+1 (212) 555-0188',
      },
    });
  } else {
    workspace.limits.scanCredits = Math.max(workspace.limits.scanCredits || 0, 100);
    await workspace.save();
  }

  // 5. Workspace Memberships
  await WorkspaceMember.findOneAndUpdate(
    { workspaceId: workspace._id, userId: owner._id },
    { role: 'owner' },
    { upsert: true }
  );

  await WorkspaceMember.findOneAndUpdate(
    { workspaceId: workspace._id, userId: admin._id },
    { role: 'admin' },
    { upsert: true }
  );

  await WorkspaceMember.findOneAndUpdate(
    { workspaceId: workspace._id, userId: member._id },
    { role: 'member' },
    { upsert: true }
  );

  console.log(`✅ [Phase 1] Seeded Workspace "${workspace.name}" with 3 Team Members (Owner, Admin, Member)`);

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 2: Google Business Profile (GBP) Connection & Locations
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n--- [Phase 2] Seeding GBP Connection & Multi-Location Portfolio ---');

  // Google Connection
  const encryptedBundle = googleVaultService.encryptToken('mock_refresh_token_dev');
  const googleConn = await GoogleConnection.findOneAndUpdate(
    { workspaceId: workspace._id },
    {
      connectedByUserId: owner._id,
      googleEmail: 'alex.vance@apexdental.com',
      googleAccountId: 'accounts/108392019485728391',
      encryptedRefreshToken: encryptedBundle.encryptedRefreshToken,
      iv: encryptedBundle.iv,
      authTag: encryptedBundle.authTag,
      keyVersion: encryptedBundle.keyVersion,
      status: 'CONNECTED',
      scopes: [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      lastSyncedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Clean old locations for idempotency
  await Location.deleteMany({ workspaceId: workspace._id });

  // Location 1: Flagship Midtown
  const locMidtown = await Location.create({
    workspaceId: workspace._id,
    googleConnectionId: googleConn._id,
    name: 'Apex Premier Dental Care - Midtown',
    address: '350 5th Avenue, Suite 4200 (Empire State Building)',
    city: 'New York',
    state: 'NY',
    country: 'US',
    postalCode: '10118',
    coordinates: { lat: 40.7484, lng: -73.9857 },
    placeId: 'place_apex_midtown_01',
    gbpLocationId: 'locations/182938192839182',
    status: 'active',
    phone: '+1 (212) 555-0188',
    website: 'https://apexpremierdental.com/midtown',
    categories: ['Dentist', 'Cosmetic Dentist', 'Dental Clinic', 'Emergency Dental Service'],
    primaryCategory: { id: 'dentist', displayName: 'Dentist' },
    secondaryCategories: [
      { id: 'cosmetic_dentist', displayName: 'Cosmetic Dentist' },
      { id: 'dental_clinic', displayName: 'Dental Clinic' },
      { id: 'emergency_dental_service', displayName: 'Emergency Dental Service' },
    ],
    regularHours: {
      monday: { open: '08:00', close: '18:00', isClosed: false },
      tuesday: { open: '08:00', close: '18:00', isClosed: false },
      wednesday: { open: '08:00', close: '18:00', isClosed: false },
      thursday: { open: '08:00', close: '18:00', isClosed: false },
      friday: { open: '08:00', close: '17:00', isClosed: false },
      saturday: { open: '09:00', close: '14:00', isClosed: false },
      sunday: { isClosed: true, open: '', close: '' },
    },
    specialHours: [{ date: '2026-12-25', isClosed: true }],
    averageRating: 4.9,
    totalReviewCount: 218,
    reviewResponseRate: 96,
    photosCount: 28,
    coverPhotoUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800',
    logoUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200',
    description:
      'Apex Premier Dental Midtown offers world-class cosmetic dentistry, Invisalign aligners, dental implants, root canal therapy, and compassionate same-day emergency dental care in Midtown Manhattan. Serving New York families and professionals for over 15 years with state-of-the-art digital 3D imaging and painless laser dentistry.',
    hasRecentReview: true,
    hasRecentPost: true,
    attributes: ['Wheelchair accessible entrance', 'Accepts new patients', 'Contactless payments', 'Wi-Fi available'],
    hasLocalBusinessSchema: true,
    syncStatus: 'SYNCED',
  });

  // Location 2: Downtown Financial District
  const locDowntown = await Location.create({
    workspaceId: workspace._id,
    googleConnectionId: googleConn._id,
    name: 'Apex Dental Studio - Financial District',
    address: '140 Broadway, 24th Floor',
    city: 'New York',
    state: 'NY',
    country: 'US',
    postalCode: '10005',
    coordinates: { lat: 40.7081, lng: -74.0098 },
    placeId: 'place_apex_downtown_02',
    gbpLocationId: 'locations/572839182938192',
    status: 'active',
    phone: '+1 (212) 555-0144',
    website: 'https://apexpremierdental.com/financial-district',
    categories: ['Dentist', 'Orthodontist'],
    primaryCategory: { id: 'dentist', displayName: 'Dentist' },
    secondaryCategories: [{ id: 'orthodontist', displayName: 'Orthodontist' }, { id: 'cosmetic_dentist', displayName: 'Cosmetic Dentist' }],
    regularHours: {
      monday: { open: '08:00', close: '17:00', isClosed: false },
      tuesday: { open: '08:00', close: '17:00', isClosed: false },
      wednesday: { open: '08:00', close: '17:00', isClosed: false },
      thursday: { open: '08:00', close: '17:00', isClosed: false },
      friday: { open: '08:00', close: '16:00', isClosed: false },
      saturday: { isClosed: true, open: '', close: '' },
      sunday: { isClosed: true, open: '', close: '' },
    },
    specialHours: [{ date: '2026-12-25', isClosed: true }],
    averageRating: 4.7,
    totalReviewCount: 94,
    reviewResponseRate: 88,
    photosCount: 14,
    description:
      'Apex Dental Studio Downtown brings expert restorative dentistry, teeth whitening, and orthodontic Invisalign solutions directly to Wall Street and Lower Manhattan professionals.',
    hasRecentReview: true,
    hasRecentPost: true,
    attributes: ['Wheelchair accessible', 'Accepts insurance'],
    hasLocalBusinessSchema: true,
    syncStatus: 'SYNCED',
  });

  console.log(`✅ [Phase 2] Seeded GBP Connection & 2 Locations (Midtown Flagship + Financial District)`);

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 3: 17-Point Audits, Geo-Grid Scans & Competitor Intelligence
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n--- [Phase 3] Seeding 17-Point Audits, Geo-Grids & Competitors ---');

  // 1. Seed 17-Point Audits
  await Audit.deleteMany({ workspaceId: workspace._id });
  const auditMidtown = await auditService.runAudit(locMidtown._id.toString(), workspace._id.toString());
  const auditDowntown = await auditService.runAudit(locDowntown._id.toString(), workspace._id.toString());
  console.log(`✅ [Phase 3] Seeded 17-Point Audits: Midtown = ${auditMidtown.score}/100, Downtown = ${auditDowntown.score}/100`);

  // 2. Helper to build realistic SERP items & matrix
  const seedCompetitorRankMatrix = (
    centerCoord: { lat: number; lng: number },
    gridSize: number,
    radiusKm: number,
    targetLoc: any,
    competitors: Array<{ name: string; rating: number; reviews: number; category: string }>
  ) => {
    const grid = GridGenerator.generateGrid(centerCoord.lat, centerCoord.lng, gridSize, radiusKm);
    const half = Math.floor(gridSize / 2);
    const gridPoints: IGridPointResult[] = [];
    const rawResponses: any[] = [];

    for (const coord of grid.coordinates) {
      const dist = Math.sqrt(Math.pow(coord.row - half, 2) + Math.pow(coord.col - half, 2));

      let targetRank: number | null = 1;
      if (dist === 0) targetRank = 1;
      else if (dist <= 1.0) targetRank = 2;
      else if (dist <= 1.5) targetRank = 2;
      else if (dist <= 2.2) targetRank = 3;
      else targetRank = Math.floor(3 + dist);

      if (targetRank > 20) targetRank = null;

      const items: IRankItem[] = [];
      let rankCounter = 1;

      for (let i = 0; i < 15; i++) {
        if (rankCounter === targetRank) {
          items.push({
            placeId: targetLoc.placeId,
            name: targetLoc.name,
            address: targetLoc.address,
            rating: targetLoc.averageRating || 4.8,
            reviewsCount: targetLoc.totalReviewCount || 100,
            primaryCategory: targetLoc.primaryCategory?.displayName || 'Dentist',
            phone: targetLoc.phone,
            website: targetLoc.website,
            rank: rankCounter,
            isTarget: true,
          });
          rankCounter++;
        }

        const comp = competitors[i % competitors.length];
        items.push({
          placeId: `comp_${comp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i + 1}`,
          name: `${comp.name} (${targetLoc.city})`,
          address: `${150 + i * 25} Broadway, New York, NY`,
          rating: comp.rating,
          reviewsCount: comp.reviews,
          primaryCategory: comp.category,
          phone: `+1 (212) 555-01${(10 + i).toString().slice(0, 2)}`,
          website: `https://${comp.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          rank: rankCounter,
          isTarget: false,
        });
        rankCounter++;
      }

      gridPoints.push({
        lat: coord.lat,
        lng: coord.lng,
        row: coord.row,
        col: coord.col,
        targetRank,
        observationState: 'OBSERVED',
        items: items.slice(0, 20),
        scannedAt: new Date(),
      });

      rawResponses.push({
        provider: 'GOOGLE_MAPS_HTTP',
        providerRequestId: `gm_http_seed_${coord.row}_${coord.col}`,
        parserVersion: '1.0',
        gridPoint: { lat: coord.lat, lng: coord.lng, row: coord.row, col: coord.col },
        fetchedAt: new Date(),
        rawPayload: { seeded: true },
      });
    }

    const metrics = MetricsCalculator.calculate(gridPoints);
    return { gridPoints, rawResponses, metrics };
  };

  const midtownCompetitors = [
    { name: 'Manhattan Dental Arts', rating: 4.9, reviews: 310, category: 'Dentist' },
    { name: 'Midtown Smile Center', rating: 4.7, reviews: 185, category: 'Cosmetic Dentist' },
    { name: 'Empire Dental Studio', rating: 4.6, reviews: 92, category: 'Dental Clinic' },
    { name: 'Herald Square Dental', rating: 4.5, reviews: 140, category: 'Dentist' },
    { name: 'Gramercy Park Smiles', rating: 4.8, reviews: 220, category: 'Dentist' },
    { name: 'Madison Ave Dental Group', rating: 4.4, reviews: 78, category: 'Dentist' },
  ];

  const downtownCompetitors = [
    { name: 'Wall Street Dental Spa', rating: 4.9, reviews: 260, category: 'Dentist' },
    { name: 'Tribeca Smiles Studio', rating: 4.8, reviews: 190, category: 'Cosmetic Dentist' },
    { name: 'Battery Park Family Care', rating: 4.5, reviews: 110, category: 'Dental Clinic' },
    { name: 'Financial District Dental', rating: 4.6, reviews: 145, category: 'Dentist' },
  ];

  // 3. Seed Scans
  await Scan.deleteMany({ workspaceId: workspace._id });

  // Scan 1: Midtown 5x5 ("dentist near me")
  const scanData1 = seedCompetitorRankMatrix(
    locMidtown.coordinates!,
    5,
    4.0,
    locMidtown,
    midtownCompetitors
  );

  const scan1 = await Scan.create({
    workspaceId: workspace._id,
    locationId: locMidtown._id,
    idempotencyKey: `seed_midtown_5x5_${Date.now()}`,
    keyword: 'dentist near me',
    gridSize: 5,
    radiusKm: 4.0,
    center: locMidtown.coordinates!,
    localization: { hl: 'en', gl: 'us', device: 'DESKTOP' },
    status: 'COMPLETED',
    credits: { required: 3, reserved: true, charged: true, refunded: false },
    gridPoints: scanData1.gridPoints,
    rawResponses: scanData1.rawResponses,
    metrics: scanData1.metrics,
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3500000),
  });

  // Scan 2: Midtown 3x3 ("emergency tooth extraction")
  const scanData2 = seedCompetitorRankMatrix(
    locMidtown.coordinates!,
    3,
    2.5,
    locMidtown,
    midtownCompetitors
  );

  const scan2 = await Scan.create({
    workspaceId: workspace._id,
    locationId: locMidtown._id,
    idempotencyKey: `seed_midtown_3x3_${Date.now()}`,
    keyword: 'emergency tooth extraction',
    gridSize: 3,
    radiusKm: 2.5,
    center: locMidtown.coordinates!,
    localization: { hl: 'en', gl: 'us', device: 'DESKTOP' },
    status: 'COMPLETED',
    credits: { required: 1, reserved: true, charged: true, refunded: false },
    gridPoints: scanData2.gridPoints,
    rawResponses: scanData2.rawResponses,
    metrics: scanData2.metrics,
    startedAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 7100000),
  });

  // Scan 3: Downtown 7x7 ("invisalign provider nyc")
  const scanData3 = seedCompetitorRankMatrix(
    locDowntown.coordinates!,
    7,
    6.0,
    locDowntown,
    downtownCompetitors
  );

  const scan3 = await Scan.create({
    workspaceId: workspace._id,
    locationId: locDowntown._id,
    idempotencyKey: `seed_downtown_7x7_${Date.now()}`,
    keyword: 'invisalign provider nyc',
    gridSize: 7,
    radiusKm: 6.0,
    center: locDowntown.coordinates!,
    localization: { hl: 'en', gl: 'us', device: 'DESKTOP' },
    status: 'COMPLETED',
    credits: { required: 6, reserved: true, charged: true, refunded: false },
    gridPoints: scanData3.gridPoints,
    rawResponses: scanData3.rawResponses,
    metrics: scanData3.metrics,
    startedAt: new Date(Date.now() - 10800000),
    completedAt: new Date(Date.now() - 10700000),
  });

  console.log(`✅ [Phase 3] Seeded 3 Multi-Grid Scans (5x5 Midtown, 3x3 Emergency, 7x7 Downtown)`);

  // 4. Seed Competitors
  await Competitor.deleteMany({ workspaceId: workspace._id });

  for (let i = 0; i < midtownCompetitors.length; i++) {
    const c = midtownCompetitors[i];
    await Competitor.create({
      workspaceId: workspace._id,
      locationId: locMidtown._id,
      placeId: `comp_midtown_${i + 1}`,
      name: c.name,
      address: `${200 + i * 20} Lexington Ave, New York, NY`,
      rating: c.rating,
      reviewsCount: c.reviews,
      primaryCategory: c.category,
      phone: `+1 (212) 555-01${(20 + i).toString().slice(0, 2)}`,
      website: `https://${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      avgRank: parseFloat((2.3 + i * 1.1).toFixed(1)),
      solv: Math.max(5, Math.round(65 - i * 9)),
      visibilityIndex: Math.max(10, Math.round(82 - i * 10)),
      lastObservedAt: new Date(),
    });
  }

  for (let i = 0; i < downtownCompetitors.length; i++) {
    const c = downtownCompetitors[i];
    await Competitor.create({
      workspaceId: workspace._id,
      locationId: locDowntown._id,
      placeId: `comp_downtown_${i + 1}`,
      name: c.name,
      address: `${50 + i * 15} Wall St, New York, NY`,
      rating: c.rating,
      reviewsCount: c.reviews,
      primaryCategory: c.category,
      phone: `+1 (212) 555-02${(10 + i).toString().slice(0, 2)}`,
      website: `https://${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      avgRank: parseFloat((3.1 + i * 1.3).toFixed(1)),
      solv: Math.max(5, Math.round(50 - i * 8)),
      visibilityIndex: Math.max(10, Math.round(68 - i * 11)),
      lastObservedAt: new Date(),
    });
  }

  console.log(`✅ [Phase 3] Seeded 10 Scoped Competitors for Midtown & Downtown`);

  console.log('\n=============================================================');
  console.log('🎉 ALL PHASES MASTER SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log(`🏢 Workspace:  ${workspace.name} (ID: ${workspace._id})`);
  console.log(`👤 Owner:      ${owner.name} (${owner.email})`);
  console.log(`📍 Locations:  2 Active Locations`);
  console.log(`📊 Scans:      3 Geo-Grid Scans (3x3, 5x5, 7x7)`);
  console.log(`🛡️ Audits:     2 17-Point Audit Runs`);
  console.log(`👥 Competitors:10 Isolated Competitor Benchmark Records`);
  console.log('\n🔗 Ready for live frontend testing:');
  console.log('  👉 Dashboard:      http://localhost:5173/dashboard');
  console.log('  👉 Locations:      http://localhost:5173/locations');
  console.log('  👉 Rank Tracking:  http://localhost:5173/rank-tracking');
  console.log('  👉 SEO Audits:     http://localhost:5173/audits');
  console.log('  👉 Competitors:    http://localhost:5173/competitors');
  console.log('  👉 Team:           http://localhost:5173/team');
  console.log('=============================================================\n');

  return { workspace, owner, admin, member, locMidtown, locDowntown, scan1, scan2, scan3, auditMidtown };
}

if (require.main === module) {
  seedAllPhasesData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
