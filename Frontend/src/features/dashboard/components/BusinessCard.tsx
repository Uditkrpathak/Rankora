import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Location } from '../../../store/api/locationApi';
import { BusinessCardHeader } from './BusinessCardHeader';
import { BusinessCardGoogleBanner } from './BusinessCardGoogleBanner';
import { BusinessCardKeywords } from './BusinessCardKeywords';
import { LaunchScanModal } from './LaunchScanModal';
import { DeleteBusinessModal } from './DeleteBusinessModal';

interface BusinessCardProps {
  location: Location & {
    isPinned?: boolean;
    optimization?: { enabled: boolean; enabledAt?: string; protectionWatchdog?: boolean };
  };
  workspaceId: string;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  location,
  workspaceId,
}) => {
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const requiresConnect =
    !location.googleConnectionId || location.syncStatus !== 'SYNCED';

  return (
    <>
      <Card className="w-full bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        {/* 1. Header with Name, Avatar, Address, Audit Score, View Map, and Optimization switch */}
        <BusinessCardHeader
          location={location}
          workspaceId={workspaceId}
          onLaunchScan={() => setScanModalOpen(true)}
          onDelete={() => setDeleteModalOpen(true)}
        />

        {/* 2. Google Connection Warning Banner */}
        <BusinessCardGoogleBanner
          locationId={location._id}
          workspaceId={workspaceId}
          requiresConnect={requiresConnect}
        />

        {/* 3. Keywords Section — fetches full rich data (sparklines, deltas) itself */}
        <BusinessCardKeywords
          locationId={location._id}
          workspaceId={workspaceId}
        />
      </Card>

      {/* Modals */}
      {scanModalOpen && (
        <LaunchScanModal
          isOpen={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          locationId={location._id}
          workspaceId={workspaceId}
          businessName={location.name}
        />
      )}

      {deleteModalOpen && (
        <DeleteBusinessModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          locationId={location._id}
          workspaceId={workspaceId}
          businessName={location.name}
        />
      )}
    </>
  );
};

export default BusinessCard;
