import mongoose from 'mongoose';
import { Location } from '../models/Location';
import { connectDatabase, disconnectDatabase } from '../config/db';

interface BackfillStats {
  totalScanned: number;
  eligibleCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  estimatedCostUsd: number;
}

/**
 * Idempotent, rate-limited backfill script for existing locations missing photo references.
 * Fetches field-masked (id,photos) from Google Places API (New) to minimize API expenditure.
 */
export async function runPhotoBackfill(execute: boolean = false): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalScanned: 0,
    eligibleCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    estimatedCostUsd: 0,
  };

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await connectDatabase();
  }

  try {
    const candidates = await Location.find({
      deletedAt: null,
      placeId: { $ne: null, $exists: true, $regex: /^.+$/ },
      $or: [
        { coverPhotoUrl: null },
        { coverPhotoUrl: { $exists: false } },
        { coverPhotoUrl: '' },
      ],
    });

    stats.totalScanned = await Location.countDocuments({ deletedAt: null });
    stats.eligibleCount = candidates.length;
    // Google Places API (New) Place Details Basic/Photo mask is approx $0.017 per request (or within $200 free tier)
    stats.estimatedCostUsd = Number((stats.eligibleCount * 0.017).toFixed(4));

    console.log('====================================================');
    console.log('📸 Google Places Photo Reference Backfill Report');
    console.log('====================================================');
    console.log(`Total Active Locations: ${stats.totalScanned}`);
    console.log(`Locations needing photo references: ${stats.eligibleCount}`);
    console.log(`Estimated API Cost: ~$${stats.estimatedCostUsd} USD`);
    console.log(`Execution Mode: ${execute ? 'EXECUTE (Writing updates)' : 'DRY RUN (Listing only)'}`);
    console.log('----------------------------------------------------');

    for (const loc of candidates) {
      console.log(`- [${loc._id}] "${loc.name}" (placeId: ${loc.placeId})`);
    }

    if (!execute) {
      console.log('\nTo apply updates, run with --execute');
      return stats;
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured in environment.');
    }

    console.log('\n🚀 Starting rate-limited backfill execution (200ms debounce per call)...');

    for (const loc of candidates) {
      try {
        const isSynthetic =
          loc.placeId?.startsWith('place_') ||
          loc.placeId?.startsWith('ChIJ_test') ||
          loc.placeId?.startsWith('ChIJ_manual') ||
          loc.placeId?.startsWith('ChIJ_upgrade') ||
          loc.placeId?.startsWith('ChIJ_unverified') ||
          loc.placeId?.startsWith('ChIJ_b1_') ||
          loc.placeId?.startsWith('ChIJ_b2_') ||
          loc.placeId?.startsWith('locations/');

        if (isSynthetic) {
          console.log(`ℹ️ [${loc._id}] Skipping synthetic test placeId: "${loc.placeId}" for "${loc.name}".`);
          stats.skippedCount++;
          continue;
        }

        // Field mask restricted strictly to id,photos for lowest possible billing tier
        const res = await fetch(`https://places.googleapis.com/v1/places/${loc.placeId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,photos',
          },
        });

        if (!res.ok) {
          console.warn(`⚠️ [${loc._id}] Google Places returned status ${res.status} for placeId ${loc.placeId}`);
          stats.failedCount++;
          continue;
        }

        const data = await res.json();
        const photos = data.photos || [];
        const firstPhoto = photos[0]?.name;

        if (firstPhoto) {
          const photoProxyUrl = `/v1/places/photo?ref=${encodeURIComponent(firstPhoto)}`;
          loc.coverPhotoUrl = photoProxyUrl;
          loc.logoUrl = photoProxyUrl;
          loc.photosCount = photos.length;
          loc.mediaSyncedAt = new Date();
          await loc.save();

          console.log(`✅ [${loc._id}] Updated "${loc.name}" with photo reference (${photos.length} photos found).`);
          stats.updatedCount++;
        } else {
          console.log(`ℹ️ [${loc._id}] No photos available on Google Places for "${loc.name}".`);
          stats.skippedCount++;
        }

        // Rate limit: 200ms pause between API calls
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err: any) {
        console.error(`❌ [${loc._id}] Failed to backfill photos:`, err?.message || err);
        stats.failedCount++;
      }
    }

    console.log('====================================================');
    console.log('🏁 Backfill Completed');
    console.log(`Updated: ${stats.updatedCount}, Skipped: ${stats.skippedCount}, Failed: ${stats.failedCount}`);
    console.log('====================================================');
  } finally {
    if (!isConnected) {
      await disconnectDatabase();
    }
  }

  return stats;
}

if (require.main === module) {
  const isExecute = process.argv.includes('--execute');
  runPhotoBackfill(isExecute).catch((err) => {
    console.error('Fatal error during backfill:', err);
    process.exit(1);
  });
}
