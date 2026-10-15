import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { useToast } from '../../../components/ui/Toast';
import { useGetScanConfigQuery, useTriggerScanMutation } from '../../../store/api/scanApi';
import { useListKeywordsQuery } from '../../../store/api/keywordApi';
import { Zap, Play, AlertCircle } from 'lucide-react';

interface LaunchScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  locationId: string;
  businessName: string;
  onScanStarted?: () => void;
}

export const LaunchScanModal: React.FC<LaunchScanModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  locationId,
  businessName,
  onScanStarted,
}) => {
  const toast = useToast();
  const { data: configResp } = useGetScanConfigQuery({ workspaceId }, { skip: !workspaceId || !isOpen });
  const { data: keywordsResp, isLoading: isLoadingKeywords } = useListKeywordsQuery(
    { workspaceId, locationId, limit: 100 },
    { skip: !workspaceId || !locationId || !isOpen }
  );
  const [triggerScan, { isLoading: isTriggering }] = useTriggerScanMutation();

  const scanConfig = configResp?.data;
  const gridSizes = scanConfig?.gridSizes || [3, 5, 7];
  const creditsByGrid = scanConfig?.scanCreditsByGridSize || {};

  const [selectedGridSize, setSelectedGridSize] = useState<number>(3);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const keywordsList = keywordsResp?.keywords || [];

  // Initialize selected keywords when loaded
  useEffect(() => {
    if (keywordsList.length > 0 && selectedKeywords.length === 0) {
      // Select the first keyword by default
      setSelectedKeywords([keywordsList[0].keyword]);
    }
  }, [keywordsList]);

  // Set default grid size from config if available
  useEffect(() => {
    if (scanConfig?.defaultGridSize) {
      setSelectedGridSize(scanConfig.defaultGridSize);
    }
  }, [scanConfig?.defaultGridSize]);

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  };

  const costPerScan = creditsByGrid[selectedGridSize];
  const totalCost = typeof costPerScan === 'number' ? costPerScan * selectedKeywords.length : null;

  const hasNoKeywords = keywordsList.length === 0;
  const isStartDisabled = isTriggering || hasNoKeywords || selectedKeywords.length === 0;

  const handleStartScan = async () => {
    if (isStartDisabled || selectedKeywords.length === 0) return;
    setErrorMsg(null);

    try {
      // Trigger scan for each selected keyword
      for (const kw of selectedKeywords) {
        await triggerScan({
          workspaceId,
          locationId,
          keyword: kw,
          gridSize: selectedGridSize,
        }).unwrap();
      }

      toast.success(
        `Scan started for ${selectedKeywords.length} keyword(s) on ${selectedGridSize}x${selectedGridSize} matrix.`,
        'GeoGrid scan launched'
      );

      if (onScanStarted) onScanStarted();
      onClose();
    } catch (err: unknown) {
      const errorData = (err as { status?: number; data?: { error?: { code?: string; message?: string } } })?.data?.error;
      const statusCode = (err as { status?: number })?.status;

      let msg = errorData?.message || 'Failed to start scan.';
      if (statusCode === 402 || errorData?.code === 'INSUFFICIENT_SCAN_CREDITS') {
        msg = 'Insufficient scan credits available in your workspace.';
      }

      setErrorMsg(msg);
      toast.error(msg, 'Scan failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Launch GeoGrid Scan"
      size="md"
    >
      <div className="space-y-4 text-xs">
        <div>
          <p className="text-slate-500 text-[11px]">
            Target Business: <strong className="text-slate-900 font-semibold">{businessName}</strong>
          </p>
        </div>

        {/* Grid Size Selection */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-800 block">Matrix Grid Size</label>
          <div className="grid grid-cols-3 gap-2">
            {gridSizes.map((size) => {
              const cost = creditsByGrid[size];
              const isSelected = selectedGridSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedGridSize(size)}
                  className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/50 text-brand-900 ring-1 ring-brand-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <p className="font-bold text-xs">{size}x{size}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{size * size} search pins</p>
                  {typeof cost === 'number' && (
                    <p className="text-[10px] text-brand-700 font-medium mt-1">{cost} credits</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tracked Keywords to Scan */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-800 flex items-center justify-between">
            <span>Keywords to Scan</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {selectedKeywords.length} of {keywordsList.length} selected
            </span>
          </label>

          {isLoadingKeywords ? (
            <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg">
              Loading tracked keywords...
            </div>
          ) : hasNoKeywords ? (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No tracked keywords</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Add keywords to this business before launching a scan.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-50/70 rounded-lg border border-slate-200">
              {keywordsList.map((kw) => {
                const isChecked = selectedKeywords.includes(kw.keyword);
                return (
                  <label
                    key={kw._id || kw.keyword}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white cursor-pointer transition select-none text-xs text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleKeyword(kw.keyword)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate">{kw.keyword}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Real Credit Cost Display from scan config */}
        {totalCost !== null && (
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
            <div className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-brand-600" />
              <span>Credit Cost</span>
            </div>
            <span className="font-bold text-slate-900">{totalCost} credits</span>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isTriggering}>
            Cancel
          </Button>

          {hasNoKeywords ? (
            <Tooltip content="Add keywords first" side="top">
              <span className="inline-block">
                <Button variant="primary" size="sm" disabled={true}>
                  Start Scan
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartScan}
              isLoading={isTriggering}
              disabled={isStartDisabled}
              leftIcon={<Play className="w-3 h-3" />}
            >
              Start Scan
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
