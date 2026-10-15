import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface LocationSliceState {
  selectedLocationId: string | null;
  isDetailDrawerOpen: boolean;
  syncInProgress: Record<string, boolean>;
}

const initialState: LocationSliceState = {
  selectedLocationId: null,
  isDetailDrawerOpen: false,
  syncInProgress: {},
};

export const locationSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    setSelectedLocationId: (state, action: PayloadAction<string | null>) => {
      state.selectedLocationId = action.payload;
      state.isDetailDrawerOpen = action.payload !== null;
    },
    openLocationDrawer: (state, action: PayloadAction<string>) => {
      state.selectedLocationId = action.payload;
      state.isDetailDrawerOpen = true;
    },
    closeLocationDrawer: (state) => {
      state.isDetailDrawerOpen = false;
      state.selectedLocationId = null;
    },
    setSyncInProgress: (
      state,
      action: PayloadAction<{ locationId: string; inProgress: boolean }>
    ) => {
      state.syncInProgress[action.payload.locationId] = action.payload.inProgress;
    },
  },
});

export const {
  setSelectedLocationId,
  openLocationDrawer,
  closeLocationDrawer,
  setSyncInProgress,
} = locationSlice.actions;

export default locationSlice.reducer;
