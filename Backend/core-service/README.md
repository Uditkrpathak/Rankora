# Google Search Console (GSC) Integration — Phase 1 & Phase 2

## Overview
Rankora's Google Search Console (GSC) integration allows business owners and agencies to connect their verified Google Search Console properties independently of Google Business Profile (GBP). This provides organic web search query tracking, impression-weighted ranking metrics, and automated opportunity discovery without requiring GBP developer approval.

---

## 🛠 Configuration
The following environment variables configure GSC behavior in `Backend/core-service/.env`:

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | *(existing)* | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | *(existing)* | Google OAuth 2.0 Web Client Secret |
| `GSC_MIN_IMPRESSIONS` | `50` | Minimum 28-day impressions threshold for discovered/striking distance keyword candidate detection |
| `GSC_SYNC_CRON` | `0 3 * * *` | BullMQ cron pattern for automatic daily sync across all connected locations (default 3:00 AM UTC) |

---

## 🚀 Endpoints Specification

Base URL: `/v1/workspaces/:id/gsc`  
*(All routes require Bearer JWT authentication and workspace tenant membership)*

### 1. List Verified Search Console Properties
- **Method & Route:** `GET /v1/workspaces/:id/gsc/sites`
- **Permission Required:** `google.connect`
- **Description:** Calls Google Webmasters API `v3/sites` to retrieve all verified domain properties (`sc-domain:example.com`) and URL-prefix properties (`https://example.com/`). Excludes unverified user properties (`siteUnverifiedUser`).
- **Response:**
```json
{
  "success": true,
  "data": {
    "sites": [
      {
        "siteUrl": "sc-domain:example.com",
        "permissionLevel": "siteOwner"
      },
      {
        "siteUrl": "https://example.com/",
        "permissionLevel": "siteFullUser"
      }
    ]
  }
}
```

### 2. Connect Property to Location & Trigger Initial Sync
- **Method & Route:** `POST /v1/workspaces/:id/gsc/locations/:locId/connect`
- **Permission Required:** `location.update`
- **Body:**
```json
{
  "siteUrl": "sc-domain:example.com"
}
```
- **Description:** Saves `gscSiteUrl` to the Location, marks `gscConnectionStatus: "connected"`, and enqueues a background job via BullMQ (`gsc-sync-queue`) to pull the last 16 months of historical search performance data without blocking the HTTP response.
- **Response:**
```json
{
  "success": true,
  "message": "Google Search Console property connected. Initial data synchronization started in background.",
  "data": {
    "locationId": "65f42c10...",
    "siteUrl": "sc-domain:example.com",
    "gscConnectionStatus": "connected"
  }
}
```

### 3. Location Search Performance
- **Method & Route:** `GET /v1/workspaces/:id/gsc/locations/:locId/performance?range=28d|90d`
- **Permission Required:** `location.view`
- **Description:** Returns aggregated daily clicks, impressions, CTR, and impression-weighted position from `GscQueryDaily`. Returns explicit empty states (`not_connected` or `no_data_yet`) when data is unavailable. Includes `dataNotes` explaining data lag and Google query anonymization.
- **Connected Response Example:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "range": "28d",
    "siteUrl": "sc-domain:example.com",
    "totals": {
      "clicks": 342,
      "impressions": 8920,
      "ctr": 0.0383,
      "averagePosition": 9.4
    },
    "daily": [
      {
        "date": "2026-10-01",
        "clicks": 14,
        "impressions": 310,
        "ctr": 0.0452,
        "averagePosition": 8.7
      }
    ],
    "dataNotes": "Google Search Console data reflects organic web search performance with an approximate 2-3 day reporting lag. Rare and anonymized queries are excluded by Google to protect user privacy, so query-level totals may not equal property-level totals. GSC measures organic web search only and is independent of Google Maps local rankings."
  }
}
```
- **Empty State (Not Connected):**
```json
{
  "success": true,
  "data": {
    "status": "not_connected",
    "message": "Google Search Console is not connected for this location.",
    "dataNotes": "..."
  }
}
```
- **Empty State (Syncing / No Data Yet):**
```json
{
  "success": true,
  "data": {
    "status": "no_data_yet",
    "message": "Search Console data is synchronizing or no organic impressions have been recorded yet.",
    "dataNotes": "..."
  }
}
```

### 4. High-Opportunity Query Discovery
- **Method & Route:** `GET /v1/workspaces/:id/gsc/locations/:locId/top-queries`
- **Permission Required:** `location.view`
- **Description:** Segments organic search queries from the past 28 days that are not already tracked into two categories:
  - `discovered`: top queries ranked by impressions.
  - `strikingDistance`: queries with impression-weighted position between 8.0 and 20.0 (prime page-2 opportunities to push to page-1).
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "discovered": [
      {
        "query": "emergency plumber near me",
        "normalizedQuery": "emergency plumber",
        "clicks": 25,
        "impressions": 1200,
        "ctr": 0.0208,
        "averagePosition": 6.3
      }
    ],
    "strikingDistance": [
      {
        "query": "water heater repair austin",
        "normalizedQuery": "water heater repair",
        "clicks": 8,
        "impressions": 480,
        "ctr": 0.0167,
        "averagePosition": 12.4
      }
    ]
  }
}
```

### 5. Tracked Keyword GSC Metrics
- **Method & Route:** `GET /v1/workspaces/:id/gsc/locations/:locId/keyword-metrics`
- **Permission Required:** `location.view`
- **Description:** Returns organic search metrics mapped directly to the location's active `TrackedKeyword` records.
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "keywords": [
      {
        "_id": "65f42c90...",
        "keyword": "plumber austin",
        "normalizedKeyword": "plumber",
        "gscMetrics": {
          "clicks": 42,
          "impressions": 1850,
          "ctr": 0.0227,
          "averagePosition": 5.8,
          "lastSyncedAt": "2026-10-13T03:00:00.000Z"
        }
      }
    ]
  }
}
```

### 6. Manual Re-Sync (Rate-Limited)
- **Method & Route:** `POST /v1/workspaces/:id/gsc/locations/:locId/sync`
- **Permission Required:** `location.update`
- **Description:** Triggers an immediate 7-day incremental sync job in the background. Rate-limited to once every 15 minutes per location.
- **Response (Success):**
```json
{
  "success": true,
  "message": "Google Search Console synchronization has been queued.",
  "data": {
    "locationId": "65f42c10...",
    "gscSiteUrl": "sc-domain:example.com",
    "lastSyncedAt": "2026-10-13T03:00:00.000Z"
  }
}
```
- **Response (Rate-Limited 429):**
```json
{
  "success": false,
  "error": {
    "code": "GSC_SYNC_RATE_LIMITED",
    "message": "Search Console sync was run recently. Manual re-sync is limited to once every 15 minutes."
  }
}
```

---

## 🧪 Testing with a Google Test User

Because Google Business Profile (GBP) API access requires enterprise verification, **Google Search Console does not require enterprise approval** and can be tested immediately using Google Cloud OAuth:

### Step 1: Configure OAuth Consent Screen in Google Cloud Console
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project and navigate to **APIs & Services** ➔ **OAuth consent screen**.
3. Under **User Type**, set to **External** with Publishing status: **Testing**.
4. In **Test Users**, click **+ Add Users** and add your Google account (e.g. `your-email@gmail.com`).
5. Ensure the Search Console API is enabled:
   - Navigate to **APIs & Services** ➔ **Library**.
   - Search for **Google Search Console API** (or **Web Search Console API**) and ensure it is **Enabled**.

### Step 2: Initiate OAuth Flow for GSC
Call the auth URL endpoint with `connectionType=gsc`:
```http
GET /v1/workspaces/:workspaceId/google/auth-url?connectionType=gsc
Authorization: Bearer <YOUR_ACCESS_TOKEN>
```
The returned URL will request the scope:
`https://www.googleapis.com/auth/webmasters.readonly` with `access_type=offline` and `prompt=consent`.

### Step 3: Complete Authentication & Callback
1. Open the generated `authUrl` in your browser.
2. Log in with your test user account and click **Continue** (accepting unverified app warning if in Testing mode).
3. Google will redirect to your callback URL with `code` and `state`.
4. Submit the callback:
```http
POST /v1/workspaces/:workspaceId/google/callback
Authorization: Bearer <YOUR_ACCESS_TOKEN>
Content-Type: application/json

{
  "code": "4/0A...",
  "state": "<STATE_FROM_AUTH_URL>"
}
```
5. GoogleVaultService will securely encrypt and persist the refresh token.

### Step 4: Verify Sites & Connect
1. Fetch verified sites:
```http
GET /v1/workspaces/:workspaceId/gsc/sites
Authorization: Bearer <YOUR_ACCESS_TOKEN>
```
2. Connect a site to your location:
```http
POST /v1/workspaces/:workspaceId/gsc/locations/:locationId/connect
Authorization: Bearer <YOUR_ACCESS_TOKEN>
Content-Type: application/json

{
  "siteUrl": "sc-domain:yourdomain.com"
}
```
3. The background worker will immediately start syncing historical data!
