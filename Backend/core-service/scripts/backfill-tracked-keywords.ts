/**
 * Idempotent Backfill Script for Tracked Keywords
 *
 * Reconstructs:
 *   - currentRank (null when unranked, never 0)
 *   - previousRank (null when unranked or single scan)
 *   - visibilityScore (0..100)
 *   - visibilityDelta (difference from prior scan)
 *   - sparkline (array of { date, rank: number | null, visibility: number }, max 30)
 *   - scanStatus: 'SCANNED' | 'NOT_SCANNED' | 'FAILED'
 *   - lastScannedAt
 *   - lastProvider
 *
 * Usage:
 *   npx tsx scripts/backfill-tracked-keywords.ts --dry-run
 *   npx tsx scripts/backfill-tracked-keywords.ts --commit
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';

function normalize(kw: string): string {
  return kw
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface BackfillSummary {
  totalKeywords: number;
  scannedWithHistory: number;
  scannedSingle: number;
  unscanned: number;
  failedScansOnly: number;
  sampleBeforeAfter: Array<{
    keyword: string;
    before: any;
    after: any;
  }>;
}

export async function runBackfill(isDryRun: boolean = true): Promise<BackfillSummary> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URI or MONGODB_URI in environment');
  }

  const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Backfill] Connecting to MongoDB Atlas: ${maskedUri}`);
  console.log(`[Backfill] Mode: ${isDryRun ? '🔍 DRY RUN (read-only, no database mutations)' : '🚀 LIVE COMMIT'}`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  const keywordsCol = db.collection('trackedkeywords');
  const scansCol = db.collection('scans');

  const [allKeywords, allScans] = await Promise.all([
    keywordsCol.find({}).toArray(),
    scansCol.find({}).sort({ createdAt: 1 }).toArray(),
  ]);
  console.log(`[Backfill] Found ${allKeywords.length} tracked keywords and ${allScans.length} scans in database.`);

  // Group scans by `${locationId}_${normalizedKeyword}`
  const scansByKwKey = new Map<string, any[]>();
  for (const s of allScans) {
    if (!s.locationId || !s.keyword) continue;
    const key = `${s.locationId.toString()}_${normalize(s.keyword)}`;
    if (!scansByKwKey.has(key)) {
      scansByKwKey.set(key, []);
    }
    scansByKwKey.get(key)!.push(s);
  }

  let scannedWithHistory = 0;
  let scannedSingle = 0;
  let unscanned = 0;
  let failedScansOnly = 0;

  const samples: Array<{ keyword: string; before: any; after: any }> = [];

  for (const kw of allKeywords) {
    const kwNorm = kw.normalizedKeyword || normalize(kw.keyword);
    const key = `${kw.locationId.toString()}_${kwNorm}`;
    const matchingScans = scansByKwKey.get(key) || [];

    const completedScans = matchingScans.filter((s: any) => s.status === 'COMPLETED' || s.status === 'PARTIAL');
    const failedScans = matchingScans.filter((s: any) => s.status === 'FAILED');

    let updateDoc: any = {};

    if (completedScans.length === 0) {
      if (failedScans.length > 0) {
        failedScansOnly++;
        const lastFailed = failedScans[failedScans.length - 1];
        updateDoc = {
          currentRank: null,
          previousRank: null,
          visibilityScore: 0,
          visibilityDelta: 0,
          sparkline: [],
          lastScannedAt: null,
          scanStatus: 'FAILED',
          lastScanError: lastFailed.error || 'Scan failed',
        };
      } else {
        unscanned++;
        updateDoc = {
          currentRank: null,
          previousRank: null,
          visibilityScore: 0,
          visibilityDelta: 0,
          sparkline: [],
          lastScannedAt: null,
          scanStatus: 'NOT_SCANNED',
          lastScanError: null,
        };
      }
    } else {
      if (completedScans.length === 1) {
        scannedSingle++;
      } else {
        scannedWithHistory++;
      }

      // Reconstruct chronological sparkline points
      const fullSparkline = completedScans.map((s: any) => {
        // Center pin takes precedence if available
        const centerPin = (s.gridPoints || []).find((p: any) => p.pinIndex === 0 || p.ring === 0) || s.gridPoints?.[0];
        const centerRank = typeof centerPin?.targetRank === 'number' && centerPin.targetRank > 0 && centerPin.targetRank <= 20
          ? centerPin.targetRank
          : null;
        const rank = centerRank ?? (s.metrics?.arp ? Math.round(s.metrics.arp) : null);
        const visibility = Math.round(s.metrics?.visibilityIndex ?? 0);
        return {
          date: s.completedAt || s.createdAt,
          rank,
          visibility,
          scanId: s._id ? s._id.toString() : null,
        };
      });

      const cappedSparkline = fullSparkline.slice(-30);

      const latestScan = completedScans[completedScans.length - 1];
      const latestCenter = (latestScan.gridPoints || []).find((p: any) => p.pinIndex === 0 || p.ring === 0) || latestScan.gridPoints?.[0];
      const latestCenterRank = typeof latestCenter?.targetRank === 'number' && latestCenter.targetRank > 0 && latestCenter.targetRank <= 20
        ? latestCenter.targetRank
        : null;
      const latestRank = latestCenterRank ?? (latestScan.metrics?.arp ? Math.round(latestScan.metrics.arp) : null);
      const latestVis = Math.round(latestScan.metrics?.visibilityIndex ?? 0);

      let previousRank: number | null = null;
      let visibilityDelta = 0;

      if (completedScans.length >= 2) {
        const priorScan = completedScans[completedScans.length - 2];
        const priorCenter = (priorScan.gridPoints || []).find((p: any) => p.pinIndex === 0 || p.ring === 0) || priorScan.gridPoints?.[0];
        const priorCenterRank: number | null = typeof priorCenter?.targetRank === 'number' && priorCenter.targetRank > 0 && priorCenter.targetRank <= 20
          ? priorCenter.targetRank
          : null;
        previousRank = priorCenterRank ?? (priorScan.metrics?.arp ? Math.round(priorScan.metrics.arp) : null);
        const priorVis = Math.round(priorScan.metrics?.visibilityIndex ?? 0);
        visibilityDelta = latestVis - priorVis;
      }

      const providers = [
        ...new Set(
          (latestScan.gridPoints || [])
            .map((p: any) => p.provider?.trim())
            .filter((p: any): p is string => Boolean(p))
        ),
      ];
      const lastProvider = providers.length === 0 ? null : providers.length === 1 ? providers[0] : 'MIXED';
      const rankState = latestRank && latestRank >= 1 && latestRank <= 20 ? 'RANKED' : 'NOT_IN_TOP_20';
      const lastScanId = latestScan._id ? latestScan._id.toString() : null;

      updateDoc = {
        currentRank: latestRank,
        previousRank,
        rankState,
        visibilityScore: latestVis,
        visibilityDelta,
        sparkline: cappedSparkline,
        lastScannedAt: latestScan.completedAt || latestScan.createdAt,
        lastSuccessfulScanAt: latestScan.completedAt || latestScan.createdAt,
        lastProvider,
        lastScanId,
        scanStatus: 'SCANNED',
        lastScanError: null,
      };
    }

    // Capture before/after samples for reporting
    if (
      kw.keyword === 'clothing stores in delhi india' ||
      kw.keyword === 'garments shop in delhi' ||
      (kw.keyword === 'Zomato office near me' && samples.length < 3) ||
      (samples.length < 3 && completedScans.length > 0)
    ) {
      // Pick unique samples
      if (!samples.some((s) => s.keyword === kw.keyword)) {
        samples.push({
          keyword: kw.keyword,
          before: {
            currentRank: kw.currentRank,
            previousRank: kw.previousRank,
            visibilityScore: kw.visibilityScore,
            visibilityDelta: kw.visibilityDelta,
            sparklineCount: kw.sparkline?.length || 0,
            sparklineSample: (kw.sparkline || []).slice(-2),
            lastScannedAt: kw.lastScannedAt,
            scanStatus: kw.scanStatus || '(missing)',
          },
          after: {
            currentRank: updateDoc.currentRank,
            previousRank: updateDoc.previousRank,
            visibilityScore: updateDoc.visibilityScore,
            visibilityDelta: updateDoc.visibilityDelta,
            sparklineCount: updateDoc.sparkline.length,
            sparklineSample: updateDoc.sparkline.slice(-2),
            lastScannedAt: updateDoc.lastScannedAt,
            scanStatus: updateDoc.scanStatus,
          },
        });
      }
    }

    // Mutate if live commit
    if (!isDryRun) {
      await keywordsCol.updateOne({ _id: kw._id }, { $set: updateDoc });
    }
  }

  return {
    totalKeywords: allKeywords.length,
    scannedWithHistory,
    scannedSingle,
    unscanned,
    failedScansOnly,
    sampleBeforeAfter: samples.slice(0, 3),
  };
}

// Direct CLI invocation
if (require.main === module || process.argv[1]?.includes('backfill-tracked-keywords')) {
  const isCommit = process.argv.includes('--commit');
  const isDryRun = !isCommit;

  runBackfill(isDryRun)
    .then((summary) => {
      console.log('\n=== BACKFILL EXECUTION SUMMARY ===');
      console.log(`Total Tracked Keywords: ${summary.totalKeywords}`);
      console.log(`- Keywords with 2+ Completed Scans (with history & deltas): ${summary.scannedWithHistory}`);
      console.log(`- Keywords with 1 Completed Scan (single point, no delta): ${summary.scannedSingle}`);
      console.log(`- Keywords Unscanned (scanStatus = NOT_SCANNED): ${summary.unscanned}`);
      console.log(`- Keywords with Failed Scans Only (scanStatus = FAILED): ${summary.failedScansOnly}`);

      console.log('\n=== SAMPLE BEFORE / AFTER DOCUMENTS (3 SAMPLES) ===');
      for (const sample of summary.sampleBeforeAfter) {
        console.log(`\nKeyword: "${sample.keyword}"`);
        console.log('BEFORE:', JSON.stringify(sample.before, null, 2));
        console.log('AFTER: ', JSON.stringify(sample.after, null, 2));
      }

      process.exit(0);
    })
    .catch((err) => {
      console.error('[Backfill Error]:', err);
      process.exit(1);
    });
}
