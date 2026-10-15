import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { Location } from '../src/models/Location';
import { placesAutocompleteProvider, isKnownFallbackCoordinate } from '../src/providers/places-autocomplete.provider';
import { GridGenerator } from '../src/modules/rankings/grid-generator';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`=======================================================`);
  console.log(` LOCATION COORDINATE INTEGRITY REPAIR SCRIPT`);
  console.log(` Mode: ${isApply ? 'APPLY (Modifications will be committed with JSON backup)' : 'DRY RUN (Read-only simulation)'}`);
  console.log(`=======================================================\n`);

  await connectDatabase();

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn(`⚠️ WARNING: No GOOGLE_PLACES_API_KEY found in environment.`);
    console.warn(`To fetch real Google Places (New) geometry, provide GOOGLE_PLACES_API_KEY=<key>.\n`);
  }

  const allLocations = await Location.find({ deletedAt: null }).lean();
  const suspiciousLocations: any[] = [];

  for (const loc of allLocations) {
    const lat = loc.coordinates?.lat;
    const lng = loc.coordinates?.lng;
    const isFallback = isKnownFallbackCoordinate(lat, lng);
    const isMockSource = loc.coordinatesSource === 'MOCK_FALLBACK';
    const isSuspiciousCity = loc.city === 'Sector 16A' || (loc.city === 'New Delhi' && loc.address && !loc.address.toLowerCase().includes('delhi'));

    if (isFallback || isMockSource || isSuspiciousCity) {
      suspiciousLocations.push(loc);
    }
  }

  console.log(`Found ${suspiciousLocations.length} suspicious or fallback location records out of ${allLocations.length} total active locations.\n`);

  if (suspiciousLocations.length === 0) {
    console.log(`✅ All locations have valid coordinates and clean locality fields.`);
    await disconnectDatabase();
    return;
  }

  const repairPlans: Array<{
    id: string;
    name: string;
    placeId: string;
    oldData: { coordinates: any; city: string; state: string; postalCode?: string };
    newData?: { coordinates: any; city: string; state: string; postalCode?: string };
    distanceMovedKm?: number;
    error?: string;
  }> = [];

  for (const loc of suspiciousLocations) {
    const oldData = {
      coordinates: loc.coordinates,
      city: loc.city,
      state: loc.state,
      postalCode: loc.postalCode,
    };

    if (!loc.placeId) {
      repairPlans.push({
        id: loc._id.toString(),
        name: loc.name,
        placeId: 'none',
        oldData,
        error: 'Missing placeId: cannot fetch Places API details automatically. Manual pin confirmation required.',
      });
      continue;
    }

    if (!apiKey) {
      repairPlans.push({
        id: loc._id.toString(),
        name: loc.name,
        placeId: loc.placeId,
        oldData,
        error: 'GOOGLE_PLACES_API_KEY required to fetch live Places API details.',
      });
      continue;
    }

    try {
      const details = await placesAutocompleteProvider.getPlaceDetails(loc.placeId);
      if (details && details.coordinates) {
        const oldLat = loc.coordinates?.lat || 0;
        const oldLng = loc.coordinates?.lng || 0;
        const distKm = GridGenerator.haversineDistanceKm(oldLat, oldLng, details.coordinates.lat, details.coordinates.lng);

        repairPlans.push({
          id: loc._id.toString(),
          name: loc.name,
          placeId: loc.placeId,
          oldData,
          newData: {
            coordinates: details.coordinates,
            city: details.city,
            state: details.state,
            postalCode: details.postalCode,
          },
          distanceMovedKm: distKm,
        });
      } else {
        repairPlans.push({
          id: loc._id.toString(),
          name: loc.name,
          placeId: loc.placeId,
          oldData,
          error: 'Places API returned empty coordinates for placeId.',
        });
      }
    } catch (err: any) {
      repairPlans.push({
        id: loc._id.toString(),
        name: loc.name,
        placeId: loc.placeId,
        oldData,
        error: err.message || 'Places API fetch failed.',
      });
    }
  }

  // Print results summary
  for (const plan of repairPlans) {
    console.log(`-------------------------------------------------------`);
    console.log(`📍 Location ID: ${plan.id} | "${plan.name}"`);
    console.log(`   Place ID: ${plan.placeId}`);
    console.log(`   OLD: coords=(${plan.oldData.coordinates?.lat}, ${plan.oldData.coordinates?.lng}) | city="${plan.oldData.city}" | state="${plan.oldData.state}" | postal="${plan.oldData.postalCode || ''}"`);
    if (plan.newData) {
      console.log(`   NEW: coords=(${plan.newData.coordinates?.lat}, ${plan.newData.coordinates?.lng}) | city="${plan.newData.city}" | state="${plan.newData.state}" | postal="${plan.newData.postalCode || ''}"`);
      console.log(`   Distance Shift: ${plan.distanceMovedKm?.toFixed(3)} km`);
    } else {
      console.log(`   ⚠️ Skipped: ${plan.error}`);
    }
  }
  console.log(`-------------------------------------------------------\n`);

  if (isApply) {
    const applicable = repairPlans.filter((p) => Boolean(p.newData));
    if (applicable.length === 0) {
      console.log(`No records eligible for automatic update.`);
      await disconnectDatabase();
      return;
    }

    // 1. Write JSON backup
    const backupDir = path.resolve('C:/Users/uditp/Desktop/fix_backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, `location_repair_backup_${Date.now()}.json`);
    const backupData = suspiciousLocations.filter((loc) =>
      applicable.some((app) => app.id === loc._id.toString())
    );

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`💾 JSON Backup written to: ${backupPath}`);

    // 2. Apply updates ONLY to specified fields
    let updatedCount = 0;
    for (const item of applicable) {
      await Location.updateOne(
        { _id: item.id },
        {
          $set: {
            coordinates: item.newData!.coordinates,
            city: item.newData!.city,
            state: item.newData!.state,
            postalCode: item.newData!.postalCode,
            coordinatesSource: 'PLACES_API',
            coordinatesVerifiedAt: new Date(),
          },
        }
      );
      updatedCount++;
    }

    console.log(`✅ Successfully updated ${updatedCount} location documents.`);
  } else {
    console.log(`[DRY RUN COMPLETE] No changes were written to the database.`);
    console.log(`To apply changes with JSON backup, run:`);
    console.log(`npx ts-node scripts/repair-location-coordinates.ts --apply\n`);
  }

  await disconnectDatabase();
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
