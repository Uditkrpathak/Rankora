import { Location } from '../../models/Location';
import { GoogleConnection } from '../../models/GoogleConnection';
import { AiDraftLogDocument } from '../../models/AiDraftLog';
import { googleVaultService } from './google-vault.service';
import { gbpClientService } from './gbp-client.service';

const GBP_POSTS_API = 'https://mybusiness.googleapis.com/v4';

export class GbpPostService {
  /** Accepts only a claimed, approved AI post draft; all other paths are rejected. */
  public async publishDraft(workspaceId: string, draft: AiDraftLogDocument): Promise<any> {
    if (draft.kind !== 'GBP_POST' || draft.status !== 'PUBLISHING') {
      throw Object.assign(new Error('Only an approved GBP post draft may be published.'), { statusCode: 409, code: 'AI_DRAFT_APPROVAL_REQUIRED' });
    }
    const location = await Location.findOne({ _id: draft.locationId, workspaceId, deletedAt: null });
    if (!location || !location.ownershipVerified || location.addedVia !== 'gbp_import' || !location.gbpAccountId || !location.gbpLocationId || !location.googleConnectionId) {
      throw Object.assign(new Error('Publishing requires a linked, owner-authorized GBP location.'), { statusCode: 403, code: 'GBP_OWNERSHIP_REQUIRED' });
    }
    const connection = await GoogleConnection.findOne({ _id: location.googleConnectionId, workspaceId, status: 'CONNECTED' });
    if (!connection) throw Object.assign(new Error('The Google connection is inactive.'), { statusCode: 409, code: 'GOOGLE_CONNECTION_INACTIVE' });
    const accessToken = await googleVaultService.getValidAccessToken(workspaceId, connection.googleEmail);
    if (accessToken.startsWith('mock_')) throw Object.assign(new Error('Google post publishing is unavailable for demo connections.'), { statusCode: 501, code: 'DEMO_GBP_UNAVAILABLE' });
    const parent = `${location.gbpAccountId}/${location.gbpLocationId}`.replace(/\/{2,}/g, '/');
    return gbpClientService.requestWithRetry(`${GBP_POSTS_API}/${parent}/localPosts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: draft.draftText, languageCode: 'en', topicType: 'STANDARD' }),
    }, workspaceId);
  }
}

export const gbpPostService = new GbpPostService();
