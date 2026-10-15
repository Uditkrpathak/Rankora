import { connectDatabase } from '../config/db';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { WorkspaceInvite } from '../models/WorkspaceInvite';
import { Location } from '../models/Location';
import { GoogleConnection } from '../models/GoogleConnection';
import { Scan } from '../models/Scan';
import { Audit } from '../models/Audit';
import { AuditTask } from '../models/AuditTask';
import { Competitor } from '../models/Competitor';
import { TrackedKeyword } from '../models/TrackedKeyword';
import { ReviewCache } from '../models/ReviewCache';
import { GBPPerformanceSnapshot } from '../models/GBPPerformanceSnapshot';
import { KeywordVolumeCache } from '../models/KeywordVolumeCache';
import { AiDraftLog } from '../models/AiDraftLog';
import { MfaSecret } from '../models/MfaSecret';
import { RefreshToken } from '../models/RefreshToken';
import { OAuthState } from '../models/OAuthState';
import { AuditLog } from '../models/AuditLog';
import { redisClient } from '../config/redis';

export async function purgeAllMockData() {
  console.log('🧹 Connecting to MongoDB database to purge all seeded & mock data...');
  await connectDatabase();

  console.log('Purging collections...');
  const [
    usersRes,
    workspacesRes,
    membersRes,
    invitesRes,
    locationsRes,
    googleConnRes,
    scansRes,
    auditsRes,
    auditTasksRes,
    competitorsRes,
    keywordsRes,
    reviewsRes,
    gbpSnapshotsRes,
    keywordVolumeRes,
    aiDraftsRes,
    mfaSecretsRes,
    tokensRes,
    oauthStatesRes,
    auditLogsRes,
  ] = await Promise.all([
    User.deleteMany({}),
    Workspace.deleteMany({}),
    WorkspaceMember.deleteMany({}),
    WorkspaceInvite.deleteMany({}),
    Location.deleteMany({}),
    GoogleConnection.deleteMany({}),
    Scan.deleteMany({}),
    Audit.deleteMany({}),
    AuditTask.deleteMany({}),
    Competitor.deleteMany({}),
    TrackedKeyword.deleteMany({}),
    ReviewCache.deleteMany({}),
    GBPPerformanceSnapshot.deleteMany({}),
    KeywordVolumeCache.deleteMany({}),
    AiDraftLog.deleteMany({}),
    MfaSecret.deleteMany({}),
    RefreshToken.deleteMany({}),
    OAuthState.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  try {
    if (redisClient.status === 'ready') {
      await redisClient.flushall();
      console.log('🧹 Redis cache flushed completely.');
    }
  } catch (e) {
    // Redis optional in local dev
  }

  console.log('-------------------------------------------------------------');
  console.log('✅ ALL SEEDED AND MOCK DATA PURGED COMPLETELY:');
  console.log(` - Users Deleted:                 ${usersRes.deletedCount}`);
  console.log(` - Workspaces Deleted:            ${workspacesRes.deletedCount}`);
  console.log(` - Workspace Members Deleted:     ${membersRes.deletedCount}`);
  console.log(` - Workspace Invites Deleted:     ${invitesRes.deletedCount}`);
  console.log(` - Locations Deleted:             ${locationsRes.deletedCount}`);
  console.log(` - Google Connections Deleted:    ${googleConnRes.deletedCount}`);
  console.log(` - Geo-Grid Scans Deleted:        ${scansRes.deletedCount}`);
  console.log(` - Audits Deleted:                ${auditsRes.deletedCount}`);
  console.log(` - Audit Tasks Deleted:           ${auditTasksRes.deletedCount}`);
  console.log(` - Competitors Deleted:           ${competitorsRes.deletedCount}`);
  console.log(` - Tracked Keywords Deleted:      ${keywordsRes.deletedCount}`);
  console.log(` - Review Caches Deleted:         ${reviewsRes.deletedCount}`);
  console.log(` - GBP Snapshots Deleted:         ${gbpSnapshotsRes.deletedCount}`);
  console.log(` - Keyword Volume Cache Deleted:  ${keywordVolumeRes.deletedCount}`);
  console.log(` - AI Draft Logs Deleted:         ${aiDraftsRes.deletedCount}`);
  console.log(` - MFA Secrets Deleted:           ${mfaSecretsRes.deletedCount}`);
  console.log(` - Refresh Tokens Deleted:        ${tokensRes.deletedCount}`);
  console.log(` - OAuth States Deleted:          ${oauthStatesRes.deletedCount}`);
  console.log(` - Audit Logs Deleted:            ${auditLogsRes.deletedCount}`);
  console.log('-------------------------------------------------------------');
  console.log('🎉 Database is now 100% clean and ready for real production usage!');
  process.exit(0);
}

purgeAllMockData().catch((err) => {
  console.error('❌ Failed to purge mock data:', err);
  process.exit(1);
});
