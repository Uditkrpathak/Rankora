import { useState, useEffect, useCallback, useRef } from 'react';
import { useTriggerScanMutation, useLazyGetScanByIdQuery, scanApi } from '../../store/api/scanApi';
import { useDispatch, useSelector } from 'react-redux';
import { IScanRun } from '@localo/types';

export interface UseScanPollingOptions {
  workspaceId: string;
  locationId: string;
  onCompleted?: (scan: IScanRun) => void;
  onError?: (error: string) => void;
  pollIntervalMs?: number;
}

export interface ScanPollingState {
  activeScanId: string | null;
  status: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  progress: number; // 0 to 100
  totalPoints: number;
  completedPoints: number;
  scanData: IScanRun | null;
  error: string | null;
  isCreditDepleted: boolean;
  isTriggering: boolean;
}

export function useScanPolling({
  workspaceId,
  locationId,
  onCompleted,
  onError,
  pollIntervalMs = 1500,
}: UseScanPollingOptions) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state: any) => state.auth?.accessToken);
  const [triggerMutation, { isLoading: isTriggering }] = useTriggerScanMutation();
  const [fetchScanById] = useLazyGetScanByIdQuery();

  const [state, setState] = useState<ScanPollingState>({
    activeScanId: null,
    status: 'IDLE',
    progress: 0,
    totalPoints: 9,
    completedPoints: 0,
    scanData: null,
    error: null,
    isCreditDepleted: false,
    isTriggering: false,
  });

  const pollTimerRef = useRef<any>(null);
  const sseRef = useRef<EventSource | null>(null);

  const clearTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      clearSSE();
    };
  }, [clearTimer, clearSSE]);

  const pollScanStatus = useCallback(
    async (scanId: string) => {
      try {
        const res = await fetchScanById({ workspaceId, scanId }, true).unwrap();
        const scan = res.data;
        if (!scan) return;

        const gridSize = scan.gridSize || 3;
        const total = scan.pointCount ?? (gridSize * gridSize);
        const completed = scan.gridPoints?.length || 0;
        let progress = 10;

        if (scan.status === 'RUNNING') {
          progress = Math.min(95, Math.max(20, Math.round((completed / Math.max(1, total)) * 100)));
        } else if (scan.status === 'COMPLETED' || scan.status === 'PARTIAL') {
          progress = 100;
        }

        setState((prev) => ({
          ...prev,
          status: scan.status as any,
          progress,
          totalPoints: total,
          completedPoints: completed,
          scanData: scan,
          error: scan.error || null,
        }));

        if (scan.status === 'COMPLETED' || scan.status === 'PARTIAL') {
          clearTimer();
          clearSSE();
          dispatch(scanApi.util.invalidateTags(['Scan']));
          if (onCompleted) {
            onCompleted(scan);
          }
        } else if (scan.status === 'FAILED') {
          clearTimer();
          clearSSE();
          const errMsg = scan.error || 'Scan execution failed in worker.';
          setState((prev) => ({ ...prev, error: errMsg }));
          if (onError) {
            onError(errMsg);
          }
        }
      } catch (err: any) {
        console.error('Polling scan error:', err);
      }
    },
    [fetchScanById, workspaceId, clearTimer, clearSSE, dispatch, onCompleted, onError]
  );

  const startScan = useCallback(
    async (params: {
      keyword: string;
      gridSize?: number;
      radiusKm?: number;
      center?: { lat: number; lng: number };
      localization?: { hl?: string; gl?: string; device?: 'DESKTOP' | 'MOBILE' };
    }) => {
      if (!workspaceId || !locationId || !params.keyword?.trim()) {
        return;
      }

      clearTimer();
      clearSSE();

      setState({
        activeScanId: null,
        status: 'QUEUED',
        progress: 5,
        totalPoints: (params.gridSize || 3) * (params.gridSize || 3),
        completedPoints: 0,
        scanData: null,
        error: null,
        isCreditDepleted: false,
        isTriggering: true,
      });

      try {
        const res = await triggerMutation({
          workspaceId,
          locationId,
          keyword: params.keyword.trim(),
          gridSize: params.gridSize || 3,
          radiusKm: params.radiusKm || 5.0,
          center: params.center,
          localization: params.localization,
        }).unwrap();

        const scan = res.data;
        const scanId = (scan as any)._id || (scan as any).id;

        setState((prev) => ({
          ...prev,
          activeScanId: scanId,
          status: (scan.status as any) || 'QUEUED',
          isTriggering: false,
          progress: scan.status === 'RUNNING' ? 25 : 10,
        }));

        // Try SSE Streaming first for real-time pin arrival
        let sseConnected = false;
        if (typeof EventSource !== 'undefined') {
          try {
            const streamUrl = `/v1/workspaces/${workspaceId}/scans/${scanId}/stream?token=${encodeURIComponent(accessToken || '')}`;
            const es = new EventSource(streamUrl);
            sseRef.current = es;

            es.addEventListener('progress', (e) => {
              try {
                const data = JSON.parse(e.data);
                const total = data.totalPoints || 9;
                const completed = data.completedPoints || 0;
                const progress = Math.min(98, Math.max(15, Math.round((completed / Math.max(1, total)) * 100)));
                setState((prev) => ({
                  ...prev,
                  status: data.status,
                  progress,
                  totalPoints: total,
                  completedPoints: completed,
                  scanData: prev.scanData ? { ...prev.scanData, ...data } : data,
                }));
              } catch (_) {}
            });

            es.addEventListener('complete', (e) => {
              try {
                const data = JSON.parse(e.data);
                setState((prev) => ({
                  ...prev,
                  status: data.status,
                  progress: 100,
                  scanData: prev.scanData ? { ...prev.scanData, ...data } : data,
                }));
                dispatch(scanApi.util.invalidateTags(['Scan']));
                if (onCompleted) onCompleted(data);
              } catch (_) {}
              clearSSE();
              clearTimer();
            });

            es.onerror = () => {
              // Fallback to polling if SSE encounters an error
              clearSSE();
              if (!pollTimerRef.current) {
                pollScanStatus(scanId);
                pollTimerRef.current = setInterval(() => pollScanStatus(scanId), pollIntervalMs);
              }
            };

            sseConnected = true;
          } catch (_) {
            sseConnected = false;
          }
        }

        // If SSE not supported or could not connect, use interval polling
        if (!sseConnected) {
          pollScanStatus(scanId);
          pollTimerRef.current = setInterval(() => {
            pollScanStatus(scanId);
          }, pollIntervalMs);
        }
      } catch (err: any) {
        const is402 =
          err?.status === 402 ||
          err?.data?.error?.code === 'INSUFFICIENT_CREDITS' ||
          err?.data?.error?.message?.toLowerCase().includes('insufficient') ||
          err?.data?.error?.message?.toLowerCase().includes('credit');

        const errorMessage =
          err?.data?.error?.message ||
          (is402
            ? 'Insufficient scan credits. Please upgrade your plan or wait for your monthly quota reset.'
            : 'Failed to initiate keyword scan.');

        setState((prev) => ({
          ...prev,
          status: 'IDLE',
          isTriggering: false,
          error: errorMessage,
          isCreditDepleted: is402,
        }));

        if (onError) {
          onError(errorMessage);
        }
      }
    },
    [workspaceId, locationId, accessToken, triggerMutation, clearTimer, clearSSE, pollScanStatus, pollIntervalMs, dispatch, onCompleted, onError]
  );

  const reset = useCallback(() => {
    clearTimer();
    clearSSE();
    setState({
      activeScanId: null,
      status: 'IDLE',
      progress: 0,
      totalPoints: 9,
      completedPoints: 0,
      scanData: null,
      error: null,
      isCreditDepleted: false,
      isTriggering: false,
    });
  }, [clearTimer, clearSSE]);

  return {
    ...state,
    isTriggering,
    startScan,
    reset,
  };
}
