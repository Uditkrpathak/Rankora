export const openApiSpec: any = {
  openapi: '3.1.0',
  info: {
    title: 'Rankora Core Service API',
    version: '1.0.0',
    description:
      'Production API for Rankora — Local SEO Platform with GeoGrid Rank Tracking, Smart Multi-Locality Keyword Intelligence, Google Business Profile Sync, Review Copilot, Audits, and Native Map Scrapers with Zero Paid APIs.',
    contact: {
      name: 'Rankora Engineering',
      email: 'dev@rankora.io',
    },
  },
  servers: [
    {
      url: '/v1',
      description: 'API Version 1 (/v1)',
    },
    {
      url: '/',
      description: 'Root Service (Health / Metrics / Docs)',
    },
  ],
  tags: [
    { name: 'Authentication & Users', description: 'User registration, login, Google OAuth, session management, MFA, and profile' },
    { name: 'Workspaces & Team', description: 'Multi-tenant workspace management, member roles, invites, and deletion lifecycle' },
    { name: 'Locations & GBP Profiles', description: 'Business locations, Google Business Profile connection, geocoding, and dashboards' },
    { name: 'Tracked Keywords & Intelligence', description: 'Geo-targeted keyword tracking, search volume, suggestions, and auto-probing' },
    { name: 'GeoGrid Scans & Rank Tracking', description: 'On-demand & scheduled 31/49-pin local rank scans, real-time SSE stream, and sharing' },
    { name: 'Google Business Profile Integration', description: 'Direct GBP OAuth token management, account discovery, and location import' },
    { name: 'GBP Performance Insights', description: 'Google search impressions, call clicks, direction requests, and website clicks' },
    { name: 'Audits & Local Health', description: 'SEO audit scoring, ranking readiness, listing consistency, and scheduled checks' },
    { name: 'Reviews & Reputation', description: 'Customer review sync, AI copilot responses, and review replies' },
    { name: 'Competitor Intelligence', description: 'Local competitor leaderboards, benchmark comparisons, and citation gap analysis' },
    { name: 'AI Copilot & Drafts', description: 'Generative AI content drafts, GBP updates, review responses, and approval workflow' },
    { name: 'Listing Protection', description: 'Anti-tampering monitoring, unauthorized change detection, and incident resolution' },
    { name: 'Google Places Resolver', description: 'In-house HTTP place search resolver and photo proxy (zero paid Google Places API)' },
    { name: 'Public Endpoints', description: 'Public unauthenticated endpoints for shareable scan reports and media' },
    { name: 'MCP (Model Context Protocol)', description: 'AI agent JSON-RPC interface for tool execution and autonomous workflows' },
    { name: 'System & Health', description: 'Prometheus metrics and cluster health check endpoints' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Standard Bearer JWT access token passed in the Authorization header.',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'HttpOnly cookie containing the access token.',
      },
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Resource not found' } },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Missing or invalid authentication token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string', example: 'Unauthorized' } },
            },
          },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['error'],
      },
      SparklinePoint: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date-time' },
          rank: { type: 'integer', nullable: true },
          visibility: { type: 'number' },
          scanId: { type: 'string', nullable: true },
        },
        required: ['date', 'visibility'],
      },
      TrackedKeywordSnapshot: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          workspaceId: { type: 'string' },
          locationId: { type: 'string' },
          keyword: { type: 'string' },
          normalizedKeyword: { type: 'string' },
          source: { type: 'string', enum: ['MANUAL', 'SUGGESTION', 'RECOMMENDED_SEED', 'GOOGLE_AUTOCOMPLETE', 'LEGACY'] },
          currentRank: { type: 'integer', nullable: true, description: 'Storefront center pin rank' },
          overallRank: { type: 'integer', nullable: true, description: 'True overall market standing across all competitors' },
          totalCompetitors: { type: 'integer', nullable: true, description: 'Total competitor businesses ranking for query' },
          previousRank: { type: 'integer', nullable: true },
          rankState: { type: 'string', enum: ['RANKED', 'NOT_IN_TOP_20', 'UNKNOWN'] },
          volumeTier: { type: 'string', enum: ['POPULAR', 'MEDIUM', 'LOW'] },
          searchVolume: { type: 'integer', nullable: true },
          triggersLocalPack: { type: 'boolean', description: 'True if query triggers Google 3-Pack widget in search results.' },
          visibilityScore: { type: 'number', description: 'Geographic visibility score (0-100%).' },
          visibilityDelta: { type: 'number' },
          sparkline: {
            type: 'array',
            items: { $ref: '#/components/schemas/SparklinePoint' },
          },
          lastScannedAt: { type: 'string', format: 'date-time', nullable: true },
          lastSuccessfulScanAt: { type: 'string', format: 'date-time', nullable: true },
          scanStatus: { type: 'string', enum: ['NOT_SCANNED', 'QUEUED', 'SCANNING', 'SCANNED', 'PARTIAL', 'FAILED', 'NO_LOCAL_RESULTS'] },
          lastScanError: { type: 'string', nullable: true },
          gridType: { type: 'string', enum: ['QUICK', 'SMART_GRID'] },
          lastScanId: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'paused'] },
        },
        required: ['_id', 'workspaceId', 'locationId', 'keyword', 'visibilityScore'],
      },
      KeywordSuggestion: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          volumeTier: { type: 'string', enum: ['POPULAR', 'MEDIUM', 'LOW'] },
          triggersLocalPack: { type: 'boolean' },
          score: { type: 'integer', description: 'Composite intent & frequency score (0-100)' },
          localityType: { type: 'string', enum: ['SUBLOCALITY', 'CITY', 'GENERIC'] },
          source: { type: 'string', enum: ['AUTOCOMPLETE', 'CATEGORY_SEED', 'COMPETITOR'] },
        },
        required: ['keyword', 'volumeTier', 'triggersLocalPack', 'score'],
      },
      GridPin: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          pinIndex: { type: 'integer' },
          ring: { type: 'integer' },
          targetRank: { type: 'integer', nullable: true },
          provider: { type: 'string' },
        },
        required: ['lat', 'lng', 'pinIndex'],
      },
      ScanDocument: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          workspaceId: { type: 'string' },
          locationId: { type: 'string' },
          keyword: { type: 'string' },
          status: { type: 'string', enum: ['QUEUED', 'SCANNING', 'SCANNED', 'FAILED'] },
          radiusKm: { type: 'number' },
          gridShape: { type: 'string', enum: ['rings_31', 'sunflower_31', 'quick_9'] },
          visibilityScore: { type: 'number' },
          averageRank: { type: 'number' },
          totalPins: { type: 'integer' },
          completedPins: { type: 'integer' },
          pins: {
            type: 'array',
            items: { $ref: '#/components/schemas/GridPin' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  paths: {
    // ----------------------------------------------------
    // AUTHENTICATION & USERS
    // ----------------------------------------------------
    '/auth/register': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Register New User',
        description: 'Creates a new user account with email/password and automatically initializes a default workspace.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', format: 'password', minLength: 8, example: 'P@ssword123' },
                  name: { type: 'string', example: 'John Doe' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User successfully created' },
          '400': { description: 'Validation error or email already in use' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'User Login',
        description: 'Authenticates with email and password, returning JWT access token and setting refresh token cookie.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', format: 'password', example: 'P@ssword123' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated successfully with tokens' },
          '401': { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/google': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Google One-Tap / OAuth Sign-In',
        description: 'Exchanges a Google OAuth ID token for a Rankora session and access token.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credential'],
                properties: {
                  credential: { type: 'string', description: 'Google ID token credential' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated with Google successfully' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Refresh Access Token',
        description: 'Uses HttpOnly refresh token cookie to rotate and issue a new short-lived JWT access token.',
        security: [],
        responses: {
          '200': { description: 'New access token issued' },
          '401': { description: 'Refresh token invalid or expired' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Log Out Current Session',
        description: 'Revokes the current refresh token and clears the authentication cookies.',
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/logout-all': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Log Out of All Devices',
        description: 'Invalidates all active session families across all browsers and devices for this user.',
        responses: {
          '200': { description: 'All active sessions terminated' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication & Users'],
        summary: 'Get Current User Profile',
        description: 'Returns authenticated user account profile, email verification status, and workspace memberships.',
        responses: {
          '200': { description: 'Current user profile data' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        tags: ['Authentication & Users'],
        summary: 'Update Profile Details',
        description: 'Updates current user name, phone, or UI preferences.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phoneNumber: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Profile updated successfully' },
        },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Authentication & Users'],
        summary: 'List Active Login Sessions',
        description: 'Returns all devices and browsers currently logged into this account.',
        responses: {
          '200': { description: 'Array of active sessions' },
        },
      },
    },
    '/auth/sessions/{familyId}': {
      delete: {
        tags: ['Authentication & Users'],
        summary: 'Revoke Specific Session',
        parameters: [{ name: 'familyId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Session revoked' },
        },
      },
    },
    '/auth/mfa/enroll': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Enroll TOTP 2-Factor Authentication',
        responses: {
          '200': { description: 'Returns TOTP QR code URI and backup secret' },
        },
      },
    },
    '/auth/mfa/verify': {
      post: {
        tags: ['Authentication & Users'],
        summary: 'Verify & Activate 2FA',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string', example: '123456' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'MFA verified and enabled' },
        },
      },
    },

    // ----------------------------------------------------
    // WORKSPACES & TEAM
    // ----------------------------------------------------
    '/workspaces': {
      get: {
        tags: ['Workspaces & Team'],
        summary: 'List User Workspaces',
        description: 'Returns all workspaces the authenticated user belongs to with role permissions.',
        responses: {
          '200': { description: 'List of workspaces' },
        },
      },
      post: {
        tags: ['Workspaces & Team'],
        summary: 'Create New Workspace',
        description: 'Initializes a new agency or business workspace with tenant isolation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Apex Marketing Agency' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Workspace created' },
        },
      },
    },
    '/workspaces/{workspaceId}': {
      get: {
        tags: ['Workspaces & Team'],
        summary: 'Get Workspace Details',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Workspace metadata and tier limits' },
        },
      },
      patch: {
        tags: ['Workspaces & Team'],
        summary: 'Update Workspace',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Workspace updated' },
        },
      },
      delete: {
        tags: ['Workspaces & Team'],
        summary: 'Schedule Workspace Deletion',
        description: 'Places workspace in a 7-day grace period before permanent deletion.',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Deletion scheduled' },
        },
      },
    },
    '/workspaces/{workspaceId}/members': {
      get: {
        tags: ['Workspaces & Team'],
        summary: 'List Workspace Team Members',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of team members with assigned roles' },
        },
      },
    },
    '/workspaces/{workspaceId}/invites': {
      post: {
        tags: ['Workspaces & Team'],
        summary: 'Invite Team Member',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'manager', 'viewer'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Invitation sent via email' },
        },
      },
    },

    // ----------------------------------------------------
    // LOCATIONS & GBP PROFILES
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations': {
      get: {
        tags: ['Locations & GBP Profiles'],
        summary: 'List Workspace Locations',
        description: 'Returns all managed business profiles within the tenant workspace.',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Array of locations' },
        },
      },
      post: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Create Location Manually',
        description: 'Adds a new business location with coordinates, category, and target address.',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'address', 'lat', 'lng'],
                properties: {
                  name: { type: 'string', example: 'Garg Sweets' },
                  address: { type: 'string', example: 'Radha Krishna Mandir Main Rd, Raipur, CG' },
                  lat: { type: 'number', example: 21.2514 },
                  lng: { type: 'number', example: 81.6296 },
                  primaryCategory: { type: 'string', example: 'Sweet shop' },
                  placeId: { type: 'string' },
                  mapsCid: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Location created successfully' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/overview': {
      get: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Locations Overview & Aggregate Health',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Overview statistics, audit scores, and total keywords' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}': {
      get: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Get Single Location Profile',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Location details, coordinates, and sync state' },
        },
      },
      patch: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Update Location Information',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Location updated' },
        },
      },
      delete: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Delete Location',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Location deleted' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/dashboard': {
      get: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Single Location Dashboard Metrics',
        description: 'Comprehensive dashboard metrics combining top keywords, visibility history, recent reviews, and audits.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Location dashboard bundle' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/sync': {
      post: {
        tags: ['Locations & GBP Profiles'],
        summary: 'Sync with Google Business Profile',
        description: 'Pulls real-time profile data, categories, hours, and attributes from Google.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Synced with Google Business Profile' },
        },
      },
    },

    // ----------------------------------------------------
    // TRACKED KEYWORDS & INTELLIGENCE
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locationId}/keywords': {
      get: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'List Tracked Keywords (Paginated Snapshots)',
        description: 'Returns precomputed keyword snapshots for the specified location with lean selective projection (<300ms p95).',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of keyword snapshots',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/TrackedKeywordSnapshot' } },
                    pagination: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'Add Tracked Keyword(s)',
        description: 'Idempotently adds keywords for tracking and automatically enqueues GeoGrid scans.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['keywords'],
                properties: {
                  keywords: { type: 'array', items: { type: 'string' }, example: ['Sweets Shop', 'bakery near me'] },
                  source: { type: 'string', enum: ['MANUAL', 'SUGGESTION', 'RECOMMENDED_SEED'], default: 'MANUAL' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Keywords created and enqueued' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/keywords/{keywordId}': {
      patch: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'Update Tracked Keyword Settings',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'keywordId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Keyword updated' },
        },
      },
      delete: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'Delete Tracked Keyword',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'keywordId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Keyword deleted successfully' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/keyword-suggestions': {
      get: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'Get Multi-Locality Keyword Suggestions',
        description: 'Generates up to 30 hyper-local search suggestions spanning Category × Macro City and Micro Sub-Localities without paid APIs.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'hl', in: 'query', schema: { type: 'string', default: 'en' } },
        ],
        responses: {
          '200': {
            description: 'List of ranked keyword suggestions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/KeywordSuggestion' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/keywords/export': {
      get: {
        tags: ['Tracked Keywords & Intelligence'],
        summary: 'Export Keywords (CSV / Excel format)',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'CSV file stream of keywords, ranks, and visibility' },
        },
      },
    },

    // ----------------------------------------------------
    // GEOGRID SCANS & RANK TRACKING
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/scans': {
      post: {
        tags: ['GeoGrid Scans & Rank Tracking'],
        summary: 'Trigger On-Demand GeoGrid Scan',
        description: 'Launches a high-resolution 31-pin or 49-pin GeoGrid scan for the target location and keyword.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['keywordId'],
                properties: {
                  keywordId: { type: 'string' },
                  radiusKm: { type: 'number', default: 5 },
                  gridShape: { type: 'string', enum: ['rings_31', 'sunflower_31', 'quick_9'], default: 'rings_31' },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Scan created and enqueued for scraping' },
        },
      },
      get: {
        tags: ['GeoGrid Scans & Rank Tracking'],
        summary: 'List Location Scans',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Array of historical scans' },
        },
      },
    },
    '/workspaces/{workspaceId}/scans/{scanId}': {
      get: {
        tags: ['GeoGrid Scans & Rank Tracking'],
        summary: 'Get Scan Results & Pins',
        description: 'Returns the full scan document with all coordinate pins, rank numbers, competitors, and visibility metrics.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'scanId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Scan details and pin matrix',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScanDocument' },
              },
            },
          },
        },
      },
    },
    '/workspaces/{workspaceId}/scans/{scanId}/stream': {
      get: {
        tags: ['GeoGrid Scans & Rank Tracking'],
        summary: 'Real-Time SSE Pin Progress Stream',
        description: 'Server-Sent Events (SSE) streaming live pin batches as they are scraped across worker threads.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'scanId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'token', in: 'query', schema: { type: 'string' }, description: 'Query token for EventSource support' },
        ],
        responses: {
          '200': {
            description: 'Live event stream (text/event-stream)',
            content: { 'text/event-stream': {} },
          },
        },
      },
    },
    '/workspaces/{workspaceId}/scans/{scanId}/share': {
      post: {
        tags: ['GeoGrid Scans & Rank Tracking'],
        summary: 'Generate Shareable Public Link',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'scanId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Returns shareable public URL with secure token' },
        },
      },
    },

    // ----------------------------------------------------
    // GOOGLE BUSINESS PROFILE INTEGRATION
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/google/auth-url': {
      get: {
        tags: ['Google Business Profile Integration'],
        summary: 'Get Google GBP OAuth URL',
        description: 'Generates the Google OAuth authorization redirect URL for connecting Google Business Profile.',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'OAuth redirection URL' },
        },
      },
    },
    '/workspaces/{workspaceId}/google/callback': {
      post: {
        tags: ['Google Business Profile Integration'],
        summary: 'Handle Google OAuth Callback',
        description: 'Exchanges authorization code for Google refresh tokens stored in encrypted vault.',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'GBP account linked' },
        },
      },
    },
    '/workspaces/{workspaceId}/google/status': {
      get: {
        tags: ['Google Business Profile Integration'],
        summary: 'Get GBP Connection Status',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Connected accounts, email, and token health' },
        },
      },
    },
    '/workspaces/{workspaceId}/google/discovered-locations': {
      get: {
        tags: ['Google Business Profile Integration'],
        summary: 'List Available GBP Locations for Import',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of unimported business listings in Google account' },
        },
      },
    },
    '/workspaces/{workspaceId}/google/import': {
      post: {
        tags: ['Google Business Profile Integration'],
        summary: 'Import GBP Location',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['googleLocationId'],
                properties: { googleLocationId: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Location imported into Rankora' },
        },
      },
    },
    '/workspaces/{workspaceId}/google/disconnect': {
      delete: {
        tags: ['Google Business Profile Integration'],
        summary: 'Disconnect Google Business Profile',
        parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Tokens purged and connection severed' },
        },
      },
    },

    // ----------------------------------------------------
    // GBP PERFORMANCE INSIGHTS
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/performance': {
      get: {
        tags: ['GBP Performance Insights'],
        summary: 'Get GBP Call / Direction / Website Metrics',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Historical daily and monthly performance metrics' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locId}/performance/refresh': {
      post: {
        tags: ['GBP Performance Insights'],
        summary: 'Force Fetch Latest Performance from Google API',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Metrics refreshed' },
        },
      },
    },

    // ----------------------------------------------------
    // AUDITS & LOCAL HEALTH
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/audits': {
      post: {
        tags: ['Audits & Local Health'],
        summary: 'Run Comprehensive SEO Profile Audit',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'Audit completed with score and actionable checklist' },
        },
      },
      get: {
        tags: ['Audits & Local Health'],
        summary: 'List Historical Audits',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of past audits and health score trend' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locId}/audit-tasks': {
      get: {
        tags: ['Audits & Local Health'],
        summary: 'List SEO Action Items / Tasks',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Actionable tasks generated by audit' },
        },
      },
    },

    // ----------------------------------------------------
    // REVIEWS & REPUTATION
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/reviews': {
      get: {
        tags: ['Reviews & Reputation'],
        summary: 'List Location Reviews',
        description: 'Returns customer Google reviews with star ratings, comments, and reply state.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Array of customer reviews' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locId}/reviews/{reviewId}/reply': {
      put: {
        tags: ['Reviews & Reputation'],
        summary: 'Post Review Reply to Google',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'reviewId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['comment'],
                properties: { comment: { type: 'string', example: 'Thank you for visiting Garg Sweets!' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Reply published to Google Maps' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locId}/reviews/generate-copilot-tones': {
      post: {
        tags: ['Reviews & Reputation'],
        summary: 'Generate AI Review Responses (Multiple Tones)',
        description: 'Generates professional, friendly, and appreciative reply options using Gemini AI.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reviewText', 'starRating'],
                properties: {
                  reviewText: { type: 'string' },
                  starRating: { type: 'integer' },
                  reviewerName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '3 AI generated draft responses' },
        },
      },
    },

    // ----------------------------------------------------
    // COMPETITOR INTELLIGENCE
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/competitors': {
      get: {
        tags: ['Competitor Intelligence'],
        summary: 'List Detected Local Competitors',
        description: 'Aggregates top ranking businesses competing within the location GeoGrid footprint.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of competitors with review count, avg rating, and market share' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locId}/competitors/benchmark': {
      get: {
        tags: ['Competitor Intelligence'],
        summary: 'Competitor Benchmark Comparison',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Benchmark comparison across visibility, ratings, and keyword presence' },
        },
      },
    },

    // ----------------------------------------------------
    // AI COPILOT & DRAFTS
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locId}/ai/drafts': {
      get: {
        tags: ['AI Copilot & Drafts'],
        summary: 'List AI Generated Content Drafts',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Array of pending and approved drafts' },
        },
      },
      post: {
        tags: ['AI Copilot & Drafts'],
        summary: 'Create AI Post / Update Draft',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'topic'],
                properties: {
                  type: { type: 'string', enum: ['POST', 'OFFER', 'EVENT', 'UPDATE'] },
                  topic: { type: 'string', example: 'Diwali special sweets discount' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Draft created' },
        },
      },
    },
    '/workspaces/{workspaceId}/ai/drafts/{draftId}/approve': {
      post: {
        tags: ['AI Copilot & Drafts'],
        summary: 'Approve AI Draft',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'draftId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Draft approved' },
        },
      },
    },

    // ----------------------------------------------------
    // LISTING PROTECTION
    // ----------------------------------------------------
    '/workspaces/{workspaceId}/locations/{locationId}/protection': {
      get: {
        tags: ['Listing Protection'],
        summary: 'Get Listing Protection Status',
        description: 'Monitors GBP attributes against unauthorized Google edits or malicious competitor tampering.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Protection status and incident history' },
        },
      },
    },
    '/workspaces/{workspaceId}/locations/{locationId}/protection/check': {
      post: {
        tags: ['Listing Protection'],
        summary: 'Run Manual Protection Integrity Check',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'locationId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Integrity check finished' },
        },
      },
    },

    // ----------------------------------------------------
    // GOOGLE PLACES RESOLVER
    // ----------------------------------------------------
    '/places/search': {
      get: {
        tags: ['Google Places Resolver'],
        summary: 'Native Places Search Resolver',
        description: 'Searches Google Maps places using the in-house HTTP scraper without Google Places API fees.',
        parameters: [
          { name: 'query', in: 'query', required: true, schema: { type: 'string' }, description: 'Business name or category' },
          { name: 'lat', in: 'query', schema: { type: 'number' } },
          { name: 'lng', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          '200': { description: 'Matching places array with coordinates, address, and placeId' },
        },
      },
    },
    '/places/photo': {
      get: {
        tags: ['Google Places Resolver'],
        summary: 'Cached Place Photo Proxy',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Image binary stream' },
        },
      },
    },

    // ----------------------------------------------------
    // PUBLIC ENDPOINTS
    // ----------------------------------------------------
    '/public/scans/{shareToken}': {
      get: {
        tags: ['Public Endpoints'],
        summary: 'View Public Shared GeoGrid Scan',
        security: [],
        description: 'Unauthenticated public view of a shared scan report.',
        parameters: [{ name: 'shareToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Read-only public scan details with pins' },
        },
      },
    },

    // ----------------------------------------------------
    // MODEL CONTEXT PROTOCOL (MCP)
    // ----------------------------------------------------
    '/mcp': {
      post: {
        tags: ['MCP (Model Context Protocol)'],
        summary: 'Model Context Protocol JSON-RPC Endpoint',
        description: 'AI agent protocol interface for querying local rankings, triggering scans, and inspecting system state.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jsonrpc', 'method'],
                properties: {
                  jsonrpc: { type: 'string', example: '2.0' },
                  id: { type: 'string', example: '1' },
                  method: { type: 'string', example: 'tools/list' },
                  params: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'JSON-RPC 2.0 response' },
        },
      },
    },

    // ----------------------------------------------------
    // SYSTEM & HEALTH
    // ----------------------------------------------------
    '/health': {
      get: {
        tags: ['System & Health'],
        summary: 'Service Health Check',
        security: [],
        responses: {
          '200': {
            description: 'Core service health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'core-service' },
                    timestamp: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['System & Health'],
        summary: 'Prometheus Metrics',
        security: [],
        responses: {
          '200': {
            description: 'Standard Prometheus plaintext metrics for scraper latency, queue length, and API errors.',
            content: { 'text/plain': {} },
          },
        },
      },
    },
  },
};
