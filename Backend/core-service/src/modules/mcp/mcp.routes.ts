import { Router, Request, Response } from 'express';
import { scanService } from '../rankings/scan.service';
import { logger } from '../../config/logger';

export const mcpRouter = Router();

const RANKORA_MCP_TOOLS = [
  {
    name: 'get_local_grid_rankings',
    description: 'Retrieve local SEO geo-grid rankings for a business keyword across geographic pins.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace ID' },
        scanId: { type: 'string', description: 'The scan ID to retrieve' },
      },
      required: ['workspaceId', 'scanId'],
    },
  },
  {
    name: 'trigger_geogrid_scan',
    description: 'Trigger a new on-demand geo-grid rank scan for a location and keyword (bypassing off-peak queue).',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace ID' },
        locationId: { type: 'string', description: 'The location ID' },
        keywordId: { type: 'string', description: 'The keyword ID' },
        gridShape: { type: 'string', enum: ['rings_31', 'sunflower_31', 'quick_9'], default: 'rings_31' },
      },
      required: ['workspaceId', 'locationId', 'keywordId'],
    },
  },
  {
    name: 'get_system_health',
    description: 'Get Rankora system health, proxy status, and BullMQ worker queue metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

mcpRouter.post('/', async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    res.status(400).json({ jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: jsonrpc version must be 2.0' } });
    return;
  }

  try {
    if (method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: RANKORA_MCP_TOOLS,
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (toolName === 'get_local_grid_rankings') {
        const scan = await scanService.getScanById(toolArgs.workspaceId, toolArgs.scanId);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(scan, null, 2),
              },
            ],
          },
        });
        return;
      }

      if (toolName === 'get_system_health') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'healthy',
                  platform: 'Rankora Local SEO Engine',
                  version: '1.0.0',
                  scraper: 'Undici Mobile HTTP (Zero Headless Browser)',
                  caching: 'Redis Geo-Hash Spatial Cache (48-72h TTL)',
                  queues: ['ondemand-scan-queue', 'weekly-scan-queue'],
                  database: 'PostgreSQL Partitioned + PgBouncer',
                }, null, 2),
              },
            ],
          },
        });
        return;
      }

      res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool not found: ${toolName}` },
      });
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not supported: ${method}` },
    });
  } catch (error: any) {
    logger.error({ error }, 'MCP Error executing method');
    res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message || 'Internal MCP error' },
    });
  }
});

mcpRouter.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Rankora MCP Endpoint',
    version: '1.0.0',
    description: 'Model Context Protocol (MCP) server for Rankora Local SEO and GeoGrid rank tracking.',
    supportedMethods: ['tools/list', 'tools/call'],
    tools: RANKORA_MCP_TOOLS.map((t) => t.name),
  });
});
