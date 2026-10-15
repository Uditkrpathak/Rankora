import fs from 'fs';
import path from 'path';
import { getDirectPool } from './postgres.client';

export class PostgresMigrationService {
  /**
   * Initializes the migrations tracking table and applies pending migrations.
   */
  public static async runMigrations(): Promise<string[]> {
    const pool = getDirectPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Ensure migrations meta table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS _schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 2. Fetch applied migrations
      const { rows } = await client.query('SELECT migration_name FROM _schema_migrations');
      const applied = new Set(rows.map((r) => r.migration_name));

      // 3. Read migration files from migrations directory
      const migrationsDir = path.resolve(__dirname, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        await client.query('COMMIT');
        return [];
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const newlyApplied: string[] = [];

      for (const file of files) {
        if (!applied.has(file)) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          console.log(`[PostgresMigration] Applying migration: ${file}...`);
          await client.query(sql);
          await client.query('INSERT INTO _schema_migrations (migration_name) VALUES ($1)', [file]);
          newlyApplied.push(file);
        }
      }

      await client.query('COMMIT');
      return newlyApplied;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PostgresMigration] Migration failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}
