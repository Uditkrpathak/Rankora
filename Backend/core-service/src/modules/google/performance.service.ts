import mongoose from 'mongoose';
import { GoogleConnection } from '../../models/GoogleConnection';
import { GBPPerformanceMetric, GBPPerformanceSnapshot } from '../../models/GBPPerformanceSnapshot';
import { Location } from '../../models/Location';
import { gbpClientService } from './gbp-client.service';
import { googleVaultService } from './google-vault.service';

const BASE_URL = 'https://businessprofileperformance.googleapis.com/v1';
const METRICS: GBPPerformanceMetric[] = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_BOOKINGS',
  'BUSINESS_FOOD_ORDERS',
  'BUSINESS_FOOD_MENU_CLICKS',
];

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateFromGoogle(value: any): Date | null {
  const year = Number(value?.year);
  const month = Number(value?.month);
  const day = Number(value?.day);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export class GBPPerformanceService {
  private async getLinkedLocation(workspaceId: string, locationId: string) {
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null });
    if (!location) throw Object.assign(new Error('Location not found in workspace.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
    if (!location.ownershipVerified || !location.gbpLocationId || !/^locations\/[A-Za-z0-9_-]+$/.test(location.gbpLocationId)) {
      throw Object.assign(new Error('Connect and verify this Google Business Profile to access its performance data.'), { statusCode: 409, code: 'GBP_LOCATION_NOT_LINKED' });
    }
    const connection = await GoogleConnection.findOne({
      _id: location.googleConnectionId,
      workspaceId,
      status: 'CONNECTED',
    });
    if (!connection) throw Object.assign(new Error('Google connection is inactive. Reconnect it to access performance data.'), { statusCode: 409, code: 'GOOGLE_CONNECTION_INACTIVE' });
    return { location, connection };
  }

  private async fetchFromGoogle(workspaceId: string, locationName: string, email: string, days: number) {
    const accessToken = await googleVaultService.getValidAccessToken(workspaceId, email);
    if (accessToken.startsWith('mock_')) {
      throw Object.assign(new Error('Performance metrics are unavailable for demo Google accounts.'), { statusCode: 501, code: 'DEMO_PERFORMANCE_UNAVAILABLE' });
    }
    const endDate = utcDay(new Date());
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const params = new URLSearchParams();
    for (const metric of METRICS) params.append('dailyMetrics', metric);
    const appendDate = (prefix: 'start_date' | 'end_date', date: Date) => {
      params.set(`dailyRange.${prefix}.year`, String(date.getUTCFullYear()));
      params.set(`dailyRange.${prefix}.month`, String(date.getUTCMonth() + 1));
      params.set(`dailyRange.${prefix}.day`, String(date.getUTCDate()));
    };
    appendDate('start_date', startDate);
    appendDate('end_date', endDate);
    return gbpClientService.requestWithRetry(
      `${BASE_URL}/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      workspaceId
    );
  }

  public async refresh(workspaceId: string, locationId: string, days = 90) {
    if (![30, 90, 180].includes(days)) {
      throw Object.assign(new Error('Choose a 30, 90, or 180 day performance range.'), { statusCode: 400, code: 'INVALID_PERFORMANCE_RANGE' });
    }
    const { location, connection } = await this.getLinkedLocation(workspaceId, locationId);
    const response = await this.fetchFromGoogle(workspaceId, location.gbpLocationId!, connection.googleEmail, days);
    const fetchedAt = new Date();
    const byDate = new Map<string, { date: Date; metrics: Partial<Record<GBPPerformanceMetric, number>> }>();

    for (const group of response?.multiDailyMetricTimeSeries || []) {
      for (const series of group?.dailyMetricTimeSeries || []) {
        const metric = series.dailyMetric as GBPPerformanceMetric;
        if (!METRICS.includes(metric)) continue;
        for (const point of series.timeSeries?.datedValues || []) {
          const date = dateFromGoogle(point.date);
          const value = Number(point.value);
          if (!date || !Number.isFinite(value)) continue;
          const key = date.toISOString();
          const row = byDate.get(key) || { date, metrics: {} };
          row.metrics[metric] = (row.metrics[metric] || 0) + value;
          byDate.set(key, row);
        }
      }
    }

    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    const locationObjectId = new mongoose.Types.ObjectId(locationId);
    const rows = [...byDate.values()];
    if (rows.length) {
      await GBPPerformanceSnapshot.bulkWrite(rows.map((row) => ({
        updateOne: {
          filter: { workspaceId: workspaceObjectId, locationId: locationObjectId, date: row.date },
          update: {
            $set: { metrics: row.metrics, source: 'GOOGLE_BUSINESS_PROFILE', fetchedAt },
            $setOnInsert: { workspaceId: workspaceObjectId, locationId: locationObjectId, date: row.date },
          },
          upsert: true,
        },
      })));
    }
    return { days, fetchedAt, source: 'GOOGLE_BUSINESS_PROFILE' as const, pointCount: rows.length };
  }

  public async getHistory(workspaceId: string, locationId: string, days = 90) {
    if (![30, 90, 180].includes(days)) {
      throw Object.assign(new Error('Choose a 30, 90, or 180 day performance range.'), { statusCode: 400, code: 'INVALID_PERFORMANCE_RANGE' });
    }
    const endDate = utcDay(new Date());
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    const location = await Location.findOne({ _id: locationId, workspaceId, deletedAt: null }).select('_id');
    if (!location) throw Object.assign(new Error('Location not found in workspace.'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
    return GBPPerformanceSnapshot.find({
      workspaceId,
      locationId,
      date: { $gte: startDate, $lt: endDate },
    }).sort({ date: 1 }).lean();
  }
}

export const gbpPerformanceService = new GBPPerformanceService();
