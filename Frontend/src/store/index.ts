import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import { authApi } from './api/authApi';
import { workspaceApi } from './api/workspaceApi';
import { locationApi } from './api/locationApi';
import { gbpApi } from './api/gbpApi';
import { scanApi } from './api/scanApi';
import { auditApi } from './api/auditApi';
import { competitorApi } from './api/competitorApi';
import { keywordApi } from './api/keywordApi';
import { reviewApi } from './api/reviewApi';
import { performanceApi } from './api/performanceApi';
import { protectionApi } from './api/protectionApi';
import { gscApi } from './api/gscApi';
import { chatApi } from './api/chatApi';
import { notificationApi } from './api/notificationApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    locations: locationReducer,
    [authApi.reducerPath]: authApi.reducer,
    [workspaceApi.reducerPath]: workspaceApi.reducer,
    [locationApi.reducerPath]: locationApi.reducer,
    [gbpApi.reducerPath]: gbpApi.reducer,
    [scanApi.reducerPath]: scanApi.reducer,
    [auditApi.reducerPath]: auditApi.reducer,
    [competitorApi.reducerPath]: competitorApi.reducer,
    [keywordApi.reducerPath]: keywordApi.reducer,
    [reviewApi.reducerPath]: reviewApi.reducer,
    [performanceApi.reducerPath]: performanceApi.reducer,
    [protectionApi.reducerPath]: protectionApi.reducer,
    [gscApi.reducerPath]: gscApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      workspaceApi.middleware,
      locationApi.middleware,
      gbpApi.middleware,
      scanApi.middleware,
      auditApi.middleware,
      competitorApi.middleware,
      keywordApi.middleware,
      reviewApi.middleware,
      performanceApi.middleware,
      protectionApi.middleware,
      gscApi.middleware,
      chatApi.middleware,
      notificationApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
