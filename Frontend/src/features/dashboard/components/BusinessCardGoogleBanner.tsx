import React from 'react';

interface BusinessCardGoogleBannerProps {
  locationId: string;
  workspaceId: string;
  requiresConnect: boolean;
}

export const BusinessCardGoogleBanner: React.FC<BusinessCardGoogleBannerProps> = () => {
  // GBP connection warning banner hidden per operator preference
  return null;
};
