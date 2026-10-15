import { Pool, PoolConfig } from 'pg';
import { ENV } from '../../config/env';

export interface PostgresConnectionPools {
  directPool: Pool;
  appPool: Pool;
}

let directPoolInstance: Pool | null = null;
let appPoolInstance: Pool | null = null;

function parseConnectionOptions(connectionString: string, maxConnections: number): PoolConfig {
  return {
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

/**
 * Direct PostgreSQL Pool (Port 5432)
 * Used for DDL migrations, partition creation, schema management, and admin tasks.
 */
export function getDirectPool(): Pool {
  if (!directPoolInstance) {
    directPoolInstance = new Pool(
      parseConnectionOptions(ENV.POSTGRES_DIRECT_URL, 5)
    );

    directPoolInstance.on('error', (err) => {
      console.error('[Postgres:DirectPool] Unexpected idle client error:', err.message);
    });
  }
  return directPoolInstance;
}

/**
 * App Runtime PostgreSQL Pool (PgBouncer Port 6432)
 * Used for transactional queries, high-throughput batch inserts, and dual-read paths.
 */
export function getAppPool(): Pool {
  if (!appPoolInstance) {
    appPoolInstance = new Pool(
      parseConnectionOptions(ENV.POSTGRES_POOL_URL, ENV.POSTGRES_POOL_MAX || 20)
    );

    appPoolInstance.on('error', (err) => {
      console.error('[Postgres:AppPool] Unexpected idle client error:', err.message);
    });
  }
  return appPoolInstance;
}

/**
 * Checks connectivity to both Direct and App pools.
 */
export async function checkPostgresHealth(): Promise<{ direct: boolean; app: boolean; error?: string }> {
  let direct = false;
  let app = false;
  try {
    const directRes = await getDirectPool().query('SELECT 1 as ok');
    direct = directRes.rows[0]?.ok === 1;

    const appRes = await getAppPool().query('SELECT 1 as ok');
    app = appRes.rows[0]?.ok === 1;

    return { direct, app };
  } catch (err: any) {
    return { direct, app, error: err.message };
  }
}

/**
 * Gracefully close all connection pools during shutdown.
 */
export async function closePostgresPools(): Promise<void> {
  if (directPoolInstance) {
    await directPoolInstance.end();
    directPoolInstance = null;
  }
  if (appPoolInstance) {
    await appPoolInstance.end();
    appPoolInstance = null;
  }
}
