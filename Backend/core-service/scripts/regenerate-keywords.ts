/**
 * Regenerate / Repair Tracked Keywords Script (§Keyword Engine V2 Integration)
 * 
 * Inspects a location's tracked keywords, identifies non-commercial or corrupted seeds
 * (e.g., city pin codes, weather, metro stations), and proposes clean replacement seeds
 * generated and scored by KeywordEngineV2.
 * 
 * Flags:
 *   --locationId <id>       Location ID to repair
 *   --apply                 Apply changes (archives corrupted seeds, writes clean seeds)
 *   --keywords "a;b;c"      Explicit user-selected keywords to validate and insert
 *   --mock                  Run offline without external live SERP calls
 * 
 * Safety:
 *   - DRY RUN by default (never writes unless --apply is passed).
 *   - On --apply: writes a full JSON backup to C:\Users\uditp\Desktop\fix_backups\ before modifying.
 *   - Corrupted keywords are soft-deleted (deletedAt timestamp set, status='ARCHIVED').
 * 
 * Usage:
 *   npx tsx scripts/regenerate-keywords.ts --locationId <locationId>
 *   npx tsx scripts/regenerate-keywords.ts --locationId <locationId> --apply
 *   npx tsx scripts/regenerate-keywords.ts --locationId <locationId> --keywords "computer store in ghaziabad;computer repair near me" --apply
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Location } from '../src/models/Location';
import { TrackedKeyword } from '../src/models/TrackedKeyword';
import { Workspace } from '../src/models/Workspace';
import { KeywordEngineV2 } from '../src/modules/keywords/keyword-engine';
import { IntentAndJunkFilter } from '../src/modules/keywords/keyword-engine/intent-and-junk-filter';
import { GoogleMapsHttpProvider } from '../src/providers/serp/google-maps-http.provider';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const isApply = process.argv.includes('--apply');
const isAll = process.argv.includes('--all');
const locationId = parseArg('--locationId');
const workspaceIdArg = parseArg('--workspaceId');
const userKeywordsArg = parseArg('--keywords');

async function repairLocation(loc: any, maxKeywordsAllowed: number) {
  console.log('='.repeat(95));
  console.log(`KEYWORD INTEGRITY & REPAIR AUDIT: ${loc.name}`);
  console.log('='.repeat(95));
  console.log(`Location ID:        ${loc._id}`);
  console.log(`Workspace ID:       ${loc.workspaceId}`);
  console.log(`Address:            ${loc.address || 'N/A'}`);
  console.log(`City:               ${loc.city || 'N/A'}`);
  console.log(`Coordinates:        (${loc.coordinates?.lat}, ${loc.coordinates?.lng}) [Source: ${loc.coordinatesSource || 'N/A'}]`);
  console.log(`Execution Mode:     ${isApply ? '⚡ APPLY CHANGES (LIVE WRITE)' : '🔍 DRY RUN (NO CHANGES WRITTEN)'}`);
  console.log('-'.repeat(95));

  // 1. Audit Existing Active Keywords
  const currentKeywords = await TrackedKeyword.find({
    locationId: loc._id,
    deletedAt: null,
  }).lean();

  console.log(`Current Active Tracked Keywords: (${currentKeywords.length})`);
  console.log(
    'ID'.padEnd(26) +
    'Keyword'.padEnd(35) +
    'Source'.padEnd(16) +
    'Status'.padEnd(10) +
    'Integrity'
  );
  console.log('-'.repeat(95));

  const evaluatedKeywords = currentKeywords.map((kw: any) => {
    const evalRes = IntentAndJunkFilter.evaluateCandidate(kw.keyword);
    return {
      id: kw._id.toString(),
      keyword: kw.keyword,
      source: kw.source || 'MANUAL',
      isCorrupted: !evalRes.accepted,
      reasons: evalRes.rejectReason ? [evalRes.rejectReason] : [],
    };
  });

  for (const ek of evaluatedKeywords) {
    const label = ek.isCorrupted
      ? `⚠️ CORRUPTED / JUNK (${ek.reasons.join('; ')})`
      : '✅ VALID COMMERCIAL';
    console.log(
      ek.id.padEnd(26) +
      ek.keyword.slice(0, 33).padEnd(35) +
      ek.source.padEnd(16) +
      'ACTIVE'.padEnd(10) +
      label
    );
  }

  const corruptedList = evaluatedKeywords.filter((k) => k.isCorrupted);
  const validList = evaluatedKeywords.filter((k) => !k.isCorrupted);

  // 2. Generate Proposed Clean Keywords using KeywordEngineV2
  let proposedKeywords: Array<{ keyword: string; kind: string; source: string; evidence?: string }> = [];

  if (userKeywordsArg) {
    const rawUserList = userKeywordsArg.split(';').map((s) => s.trim()).filter(Boolean);
    const filtered = IntentAndJunkFilter.filterAndDedupe(rawUserList.map((k) => ({ keyword: k })));
    proposedKeywords = filtered.valid.map((v) => ({
      keyword: v.keyword,
      kind: 'USER_SPECIFIED',
      source: 'MANUAL_REPAIR',
      evidence: 'User-specified repair candidate',
    }));
  } else {
    const provider = new GoogleMapsHttpProvider({
      requestTimeoutMs: 12000,
      minRequestSpacingMs: 0,
    });

    const engineResult = await KeywordEngineV2.execute({
      businessName: loc.name,
      coordinates: loc.coordinates || { lat: 28.6139, lng: 77.2090 },
      city: loc.city,
      state: loc.state,
      sublocality: loc.sublocality,
      placeId: loc.placeId,
      placesPrimaryTypeDisplayName: typeof loc.primaryCategory === 'object' ? (loc.primaryCategory as any)?.displayName : loc.primaryCategory,
      placesTypes: loc.categories,
      maxKeywordsLimit: 10,
      searchFn: async (params) => {
        const res = await provider.search({
          keyword: params.keyword,
          lat: params.lat,
          lng: params.lng,
          radiusKm: 3,
          localization: { hl: 'en', gl: loc.country?.toLowerCase() || 'in', device: 'DESKTOP' },
        });
        return { items: res.items || [], wireBytes: res.wireBytes, status: res.status };
      },
    });

    await GoogleMapsHttpProvider.closeAllDispatchers();

    proposedKeywords = (engineResult.defaultKeywords.length > 0
      ? engineResult.defaultKeywords
      : engineResult.extraKeywords
    ).slice(0, 8).map((k) => ({
      keyword: k.keyword,
      kind: k.scope,
      source: k.sourceBadges.join(', '),
      evidence: `Category: "${engineResult.category.primary}", Relevance: ${k.relevancePercentage}, Proof: ${k.proofText}`,
    }));
  }

  console.log('-'.repeat(95));
  console.log('PROPOSED CLEAN KEYWORDS (Derived via KeywordEngineV2 Category Discovery):');
  proposedKeywords.forEach((pk, idx) => {
    console.log(`  ${idx + 1}. "${pk.keyword}" [Kind: ${pk.kind}] — ${pk.evidence || ''}`);
  });

  if (!isApply) {
    console.log('='.repeat(95));
    console.log(`DRY RUN SUMMARY FOR: ${loc.name}`);
    console.log(`  • Valid Keywords Retained:        ${validList.length}`);
    console.log(`  • Corrupted Keywords to Archive:  ${corruptedList.length}`);
    console.log(`  • Proposed Clean Keywords:        ${proposedKeywords.length}`);
    console.log(`  • Plan Limit:                     ${maxKeywordsAllowed} keywords max`);
    console.log('');
    console.log('⚠️  NO DATABASE WRITES PERFORMED (DRY RUN).');
    console.log(`👉 To apply repair, re-run with:`);
    console.log(`   npx tsx scripts/regenerate-keywords.ts --locationId ${loc._id} --apply`);
    console.log('='.repeat(95) + '\n');
    return;
  }

  // Apply Mode: Backup first to C:\Users\uditp\Desktop\fix_backups\locations\<locationId>\keywords_<timestamp>.json
  const locationBackupDir = path.join('C:\\Users\\uditp\\Desktop\\fix_backups', 'locations', loc._id.toString());
  if (!fs.existsSync(locationBackupDir)) {
    fs.mkdirSync(locationBackupDir, { recursive: true });
  }
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(locationBackupDir, `keywords_${timestampStr}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(currentKeywords, null, 2), 'utf8');
  console.log(`✅ JSON Backup saved to: ${backupFilePath}`);

  // Soft delete corrupted keywords
  let archivedCount = 0;
  if (corruptedList.length > 0) {
    const corruptedIds = corruptedList.map((k) => k.id);
    const res = await TrackedKeyword.updateMany(
      { _id: { $in: corruptedIds } },
      { $set: { deletedAt: new Date(), status: 'ARCHIVED', archivedReason: 'CORRUPTED_SEED_REPAIR' } }
    );
    archivedCount = res.modifiedCount;
    console.log(`📦 Archived ${archivedCount} corrupted keywords.`);
  }

  // Insert clean keywords
  let insertedCount = 0;
  const existingKeywordTexts = new Set(validList.map((k) => k.keyword.toLowerCase()));

  for (const item of proposedKeywords) {
    if (existingKeywordTexts.has(item.keyword.toLowerCase())) {
      continue;
    }
    if (validList.length + insertedCount >= maxKeywordsAllowed) {
      console.warn(`[Plan Limit] Reached max ${maxKeywordsAllowed} keywords.`);
      break;
    }

    await TrackedKeyword.create({
      locationId: loc._id,
      workspaceId: loc.workspaceId,
      keyword: item.keyword,
      normalizedKeyword: item.keyword.toLowerCase().trim().replace(/\s+/g, ' '),
      source: 'GOOGLE_AUTOCOMPLETE',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    insertedCount++;
    console.log(`  + Created clean keyword: "${item.keyword}"`);
  }

  console.log('='.repeat(95));
  console.log(`✅ REPAIR COMPLETE FOR: ${loc.name}`);
  console.log(`  • Archived Corrupted Keywords: ${archivedCount}`);
  console.log(`  • Added New Clean Keywords:   ${insertedCount}`);
  console.log(`  • Backup File:                 ${backupFilePath}`);
  console.log('='.repeat(95) + '\n');
}

async function main() {
  if (!locationId && !isAll) {
    console.error('❌ Error: Either --locationId <id> or --all argument is required.');
    console.error('Examples:');
    console.error('  npx tsx scripts/regenerate-keywords.ts --locationId 6ac8c07a80e897fe4636ef0e');
    console.error('  npx tsx scripts/regenerate-keywords.ts --all');
    console.error('  npx tsx scripts/regenerate-keywords.ts --all --apply');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI or MONGO_URI is not set in environment.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas...`);
  await mongoose.connect(mongoUri);

  try {
    let locationsToProcess: any[] = [];

    if (locationId) {
      const loc = await Location.findById(locationId);
      if (!loc) {
        console.error(`❌ Location with ID '${locationId}' not found.`);
        process.exit(1);
      }
      locationsToProcess = [loc];
    } else {
      const query: any = { deletedAt: null };
      if (workspaceIdArg) {
        query.workspaceId = workspaceIdArg;
      }
      locationsToProcess = await Location.find(query);
      console.log(
        `Found ${locationsToProcess.length} locations${workspaceIdArg ? ` in workspace ${workspaceIdArg}` : ' across all workspaces'}`
      );
    }

    const workspaceLimitCache = new Map<string, number>();

    for (const loc of locationsToProcess) {
      let maxKeywordsAllowed = 100;
      const wsId = loc.workspaceId?.toString();
      if (wsId) {
        if (!workspaceLimitCache.has(wsId)) {
          try {
            const ws = await Workspace.findById(wsId).lean();
            workspaceLimitCache.set(wsId, (ws as any)?.limits?.maxKeywordsPerLocation || 100);
          } catch {
            workspaceLimitCache.set(wsId, 100);
          }
        }
        maxKeywordsAllowed = workspaceLimitCache.get(wsId) || 100;
      }
      await repairLocation(loc, maxKeywordsAllowed);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal keyword repair error:', err);
  process.exit(1);
});

