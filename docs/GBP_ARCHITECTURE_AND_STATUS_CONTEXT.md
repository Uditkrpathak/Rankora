# Rankora — GBP Integration, Architecture & Project Context

> **Executive Summary**: This document captures the complete architectural, technical, and operational context of Rankora’s Google Business Profile (GBP) integration, multi-tenant customer onboarding model, current Google allowlist case status, debugging diagnoses, and verified API endpoints.

---

## 1. Google Business Profile (GBP) API Status & Case

### The Root Cause of HTTP 429 (`RESOURCE_EXHAUSTED`)
* **Google's Policy**: By default, all unapproved Google Cloud projects have a hard quota of **0 Queries Per Minute (0 QPM)** on `mybusinessaccountmanagement.googleapis.com` and `mybusinessbusinessinformation.googleapis.com`.
* **The Error**: 
  ```json
  {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service 'mybusinessaccountmanagement.googleapis.com' for consumer 'project_number:681956481573'.",
    "status": "RESOURCE_EXHAUSTED"
  }
  ```
* **Status**: This is **not a code or auth bug**. It is an approval gate enforced by Google until your project is allowlisted.

### Active Google Allowlist Application
* **Case ID**: `6-9376000041204`
* **Google Cloud Project**: `rankora-app`
* **Project Number**: `681956481573`
* **Client ID**: `681956481573-74e9roijv55jnbep0hvpf4pbdsjojori.apps.googleusercontent.com`
* **Applicant Email**: `uditpathak65@gmail.com`
* **Application Type**: **Application for Basic Access** (granting 300 QPM default quota)
* **Production URLs**:
  - Live Frontend: `https://rankora-ashy-psi.vercel.app`
  - Privacy Policy: `https://rankora-ashy-psi.vercel.app/privacy`
  - Terms of Service: `https://rankora-ashy-psi.vercel.app/terms`
  - Backend API Docs: `https://rankora-q9dm.onrender.com/docs`

### Mandatory Google Requirements Addressed
1. **Verified Listing > 60 Days**: Applied with verified listing under `uditpathak65@gmail.com`.
2. **Matching Website URL**: Website listed on `business.google.com` matches the domain submitted in the application (`rankora-ashy-psi.vercel.app`).
3. **Public Privacy & Terms Pages**: Live and compliant with Google API Limited Use Requirements.

---

## 2. Multi-Tenant SaaS OAuth Architecture

### Do Customers Need Their Own GBP API?
* **NO**. Only **Rankora** holds the approved Google Cloud Project and API quota.
* Customers (dentists, plumbers, restaurants, agencies) never create Google Cloud accounts, never see API keys, and never request Google approvals.

### How Multi-Tenant Customer Access Works
```
+-----------------------------------------------------------------------------------+
| 1. Customer signs into Rankora                                                    |
| 2. Customer clicks "Connect Google" on /locations/add                             |
| 3. Google OAuth consent screen opens                                              |
| 4. Customer authorizes their own Google Account (e.g. clinic@gmail.com)          |
| 5. Rankora receives OAuth Access & Refresh tokens scoped to that customer         |
| 6. Tokens are AES-256 encrypted in MongoDB under the customer's workspaceId       |
| 7. Rankora calls GBP API using that customer's token                              |
| 8. Google returns ONLY the locations where that email is an Owner or Manager      |
| 9. Customer selects their business listing to activate tracking                   |
+-----------------------------------------------------------------------------------+
```

### Data Isolation & Security Rules
* **Customer A (`customerA@gmail.com`)**: Sees and manages **only Business A and B**.
* **Customer B (`customerB@gmail.com`)**: Sees and manages **only Business C**.
* **Unassociated Accounts**: If a customer connects a Google account with 0 listings, Rankora displays an **empty state** (*"No Google Business Profiles found for this account"*). It will **never** display another customer's listings.
* **Google Permission Enforcement**: OAuth cannot bypass Google permissions. If a user is not an Owner/Manager on `business.google.com`, Google returns an empty list.

---

## 3. How Rankora Works Like Localo (Without GBP API)

Competitors like **Localo**, **BrightLocal**, and **Surfer Local** do not depend on the GBP API for their core product value. Rankora operates under the same model:

| Product Feature | Needs GBP API? | How Rankora Operates Without GBP API | Current Status in Rankora |
| :--- | :---: | :--- | :---: |
| **GeoGrid Rank Tracking** | ❌ **No** | Wire HTTP queries to Google Maps across a lat/lng grid. Computes ATRP, SoLV, and position badges. | ✅ **Fully Operational** |
| **Competitor Benchmarking** | ❌ **No** | Analyzes top 20 Google Maps results for each keyword and calculates competitor review gaps. | ✅ **Fully Operational** |
| **17-Point Profile Audit** | ❌ **No** | Audits public profile factors (primary/secondary category, reviews, photos, hours, description). | ✅ **Fully Operational** |
| **Keyword Discovery** | ❌ **No** | Google autocomplete and Maps query mining engine. | ✅ **Fully Operational** |
| **Direct Review Replies** | ⚠️ **Yes** | Replying to customer reviews directly through Rankora requires the GBP write API. | ⏳ Pending Google Allowlist |
| **Direct Google Posts** | ⚠️ **Yes** | Publishing promotional updates and offers requires the GBP write API. | ⏳ Pending Google Allowlist |

---

## 4. Key Debugging Resolutions from This Session

### 1. Browser COOP Warning (`client:395`)
* **Message**: `Cross-Origin-Opener-Policy policy would block the window.postMessage call.`
* **Diagnosis**: Google Identity Services (`accounts.google.com/gsi/client`) runs internal communication probes across iframes. Chrome DevTools flags this when `Cross-Origin-Opener-Policy: same-origin-allow-popups` is present.
* **Impact**: **Harmless informational warning**. It does not block Google Sign-In or OAuth.

### 2. Login Page "Sign-in Error: An unexpected error occurred"
* **Diagnosis**: The backend was restarting/booting when a login request was made. RTK Query failed to connect to `http://localhost:5001`, resulting in `FETCH_ERROR: Failed to fetch`.
* **Resolution**: Updated `AuthAlert.tsx` to catch `FETCH_ERROR` and show a clear **"Server Connection Error"** instead of the generic fallback message. Tested live and verified working.

### 3. Why Reviews Showed "0 Reviews" for Dentist Alpha
* **Diagnosis**: Verified directly with Google Places API:
  ```json
  {
    "id": "ChIJ_zU_YGsDDTkRwHEX1QqHnqQ",
    "displayName": { "text": "Dentist Alpha" }
  }
  ```
  `Dentist Alpha` has **0 reviews on Google Maps in reality**.
* **Zero Mock Rule**: Because Rankora strictly adheres to 100% authentic Google data (no fake placeholder reviews), it truthfully displayed `0.0 ★` and `0 Google reviews`. Locations with real Google reviews (such as *The Exotica Grand Delhi* with 1,197 reviews) reflect live review counts.

---

## 5. Verified Backend Endpoints (Production Ready)

The moment Google approves Case `6-9376000041204`, these existing endpoints will immediately activate live:

### Review Intelligence & Automation
* `GET /v1/workspaces/:id/locations/:locId/reviews` — Fetches real Google reviews, reviewer names, star ratings, timestamps, and replies.
* `PUT /v1/workspaces/:id/locations/:locId/reviews/:reviewId/reply` — Posts owner replies directly to Google Maps.
* `POST /v1/workspaces/:id/locations/:locId/reviews/generate-copilot-tones` — Generates AI replies (*Professional*, *Friendly*, *Empathetic*).
* `GET /v1/workspaces/:id/locations/:locId/reviews/analytics` — Sentiment analysis, topic extraction, and review velocity trends.
* `GET /v1/workspaces/:id/locations/:locId/reviews/alerts` — Real-time negative review email alerts (1-star / 2-star).

### Google Profile Discovery & Sync
* `GET /v1/workspaces/:id/google/auth-url` — Generates customer OAuth authorization link.
* `POST /v1/workspaces/:id/google/callback` — Exchanges OAuth code, encrypts tokens, and stores connection.
* `GET /v1/workspaces/:id/google/discovered-locations` — Lists all Google Business Profiles accessible to that customer.
* `POST /v1/workspaces/:id/google/import` — Imports selected profile into the workspace with verified ownership.

### Google Posts & Performance Insights
* `POST /v1/workspaces/:id/locations/:locId/posts` — Publishes Google Posts, updates, offers, and photos directly to Google.
* `GET /v1/workspaces/:id/google/performance` — Pulls live search impressions, phone calls, direction requests, and website clicks.
