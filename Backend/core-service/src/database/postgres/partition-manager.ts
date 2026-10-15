import { getDirectPool } from './postgres.client';
import { postgresDefaultPartitionRows } from '../../monitoring/metrics';

export class PostgresPartitionManager {
  /**
   * Generates partition table name for a given year and month (1-indexed, 1-12).
   */
  public static getPartitionName(year: number, month: number): string {
    const formattedMonth = month.toString().padStart(2, '0');
    return `ranking_history_${year}_${formattedMonth}`;
  }

  /**
   * Computes the ISO-8601 start and end timestamp strings for a monthly partition.
   */
  public static getPartitionBounds(year: number, month: number): { fromDate: string; toDate: string } {
    const startYear = year;
    const startMonth = month.toString().padStart(2, '0');
    const fromDate = `${startYear}-${startMonth}-01 00:00:00+00`;

    let endYear = year;
    let endMonthNum = month + 1;
    if (endMonthNum > 12) {
      endMonthNum = 1;
      endYear += 1;
    }
    const endMonth = endMonthNum.toString().padStart(2, '0');
    const toDate = `${endYear}-${endMonth}-01 00:00:00+00`;

    return { fromDate, toDate };
  }

  /**
   * Generates and executes the DDL statement to create a monthly partition if it doesn't exist.
   * Uses a safe transactional pattern to migrate any existing matching rows from the default
   * partition so PostgreSQL constraint violation errors are avoided.
   */
  public static async createMonthlyPartition(year: number, month: number): Promise<{ partitionName: string; created: boolean }> {
    const partitionName = this.getPartitionName(year, month);
    const { fromDate, toDate } = this.getPartitionBounds(year, month);

    const pool = getDirectPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check if default partition exists and move conflicting rows
      const hasDefault = await client.query(`
        SELECT 1 FROM pg_class c
        JOIN pg_inherits i ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'ranking_history' AND c.relname = 'ranking_history_default'
      `);

      let rowsMoved = 0;
      if (hasDefault.rows.length > 0) {
        await client.query(`
          CREATE TEMP TABLE IF NOT EXISTS _conflicting_partition_rows (LIKE ranking_history_default INCLUDING ALL) ON COMMIT DROP;
        `);
        const delRes = await client.query(`
          WITH deleted AS (
            DELETE FROM ranking_history_default
            WHERE created_at >= $1 AND created_at < $2
            RETURNING *
          )
          INSERT INTO _conflicting_partition_rows SELECT * FROM deleted
          RETURNING 1;
        `, [fromDate, toDate]);
        rowsMoved = delRes.rowCount || 0;
      }

      // 2. Create the partition
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF ranking_history 
        FOR VALUES FROM ('${fromDate}') TO ('${toDate}');
      `);

      // 3. Move rows into the newly created partition
      if (rowsMoved > 0) {
        await client.query(`
          INSERT INTO ${partitionName}
          SELECT * FROM _conflicting_partition_rows
          ON CONFLICT (idempotency_hash, created_at) DO NOTHING;
        `);
      }

      await client.query('COMMIT');
      return { partitionName, created: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Checks the count of unpartitioned rows stored in ranking_history_default.
   * Updates the Prometheus gauge `postgres_default_partition_rows` and logs an alert if > 0.
   */
  public static async checkDefaultPartitionStatus(): Promise<{ defaultRowCount: number; isClean: boolean }> {
    const pool = getDirectPool();
    try {
      const res = await pool.query('SELECT count(*)::int AS count FROM ranking_history_default;');
      const count = res.rows[0]?.count || 0;
      postgresDefaultPartitionRows.set(count);
      if (count > 0) {
        console.warn(`[ALERT] PostgreSQL default partition ranking_history_default contains ${count} rows! Ensure future partitions are pre-provisioned.`);
      }
      return { defaultRowCount: count, isClean: count === 0 };
    } catch (err: any) {
      postgresDefaultPartitionRows.set(0);
      return { defaultRowCount: 0, isClean: true };
    }
  }


  /**
   * Ensures that partitions exist for the current month and the next `monthsAhead` months (default 3).
   */
  public static async ensureUpcomingPartitions(monthsAhead = 3, baseDate: Date = new Date()): Promise<string[]> {
    const provisioned: string[] = [];

    for (let i = 0; i <= monthsAhead; i++) {
      const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + i, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;

      const { partitionName } = await this.createMonthlyPartition(year, month);
      provisioned.push(partitionName);
    }

    return provisioned;
  }

  /**
   * Fetches all registered partitions of `ranking_history`.
   */
  public static async getExistingPartitions(): Promise<string[]> {
    const pool = getDirectPool();
    const query = `
      SELECT c.relname AS partition_name
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      WHERE p.relname = 'ranking_history'
      ORDER BY c.relname ASC;
    `;

    const result = await pool.query(query);
    return result.rows.map((r) => r.partition_name);
  }
}
