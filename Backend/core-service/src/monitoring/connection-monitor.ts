import mongoose from 'mongoose';
import { redisClient } from '../config/redis';

export interface IConnectionPoolStats {
  mongo: {
    readyState: number;
    totalConnections?: number;
    availableConnections?: number;
    inUseConnections?: number;
  };
  redis: {
    status: string;
  };
  timestamp: string;
}

export async function getConnectionPoolStats(): Promise<IConnectionPoolStats> {
  const stats: IConnectionPoolStats = {
    mongo: {
      readyState: mongoose.connection.readyState,
    },
    redis: {
      status: redisClient ? redisClient.status : 'uninitialized',
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const client = mongoose.connection.getClient();
    if (client) {
      const adminCmd = await client.db('admin').command({ connPoolStats: 1 }).catch(() => null);
      if (adminCmd) {
        stats.mongo.totalConnections = adminCmd.totalConnectionCount;
        stats.mongo.availableConnections = adminCmd.availableConnectionCount;
        stats.mongo.inUseConnections = adminCmd.inUseConnectionCount;
      }
    }
  } catch (err) {
    // Non-critical diagnostic lookup
  }

  return stats;
}

let monitorInterval: NodeJS.Timeout | null = null;

export function startConnectionMonitor(intervalMs = 30000): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(async () => {
    const poolStats = await getConnectionPoolStats();
    console.log('[DB & Redis Pool Monitor]', JSON.stringify(poolStats));
  }, intervalMs);
  monitorInterval.unref();
}

export function stopConnectionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
