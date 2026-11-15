import { create } from 'zustand';
import { UploadQueueItem } from '../types/recording';
import type { ActivityStatus } from './useActivityStore';

interface SyncActivity {
  message: string;
  status: ActivityStatus;
  at: string;
}
const MAX_SYNC_HISTORY = 20;

export type { SyncActivity };

interface SyncStoreState {
  // Network state
  isOnline: boolean;
  isWifi: boolean;

  // Upload queue
  queue: UploadQueueItem[];
  isUploading: boolean;
  currentUploadId: string | null;

  // Progress
  uploadProgress: number; // 0-1

  // Stats
  totalUploaded: number;
  totalFailed: number;
  lastSyncActivity: SyncActivity | null;
  syncHistory: SyncActivity[];

  // Actions
  setNetworkState: (isOnline: boolean, isWifi: boolean) => void;
  setQueue: (items: UploadQueueItem[]) => void;
  addToQueue: (item: UploadQueueItem) => void;
  removeFromQueue: (recordingId: string) => void;
  updateQueueItem: (recordingId: string, updates: Partial<UploadQueueItem>) => void;
  setUploading: (isUploading: boolean, currentUploadId?: string) => void;
  setUploadProgress: (progress: number) => void;
  incrementUploaded: () => void;
  incrementFailed: () => void;
  setLastSyncActivity: (message: string, status: ActivityStatus) => void;
  clearQueue: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isOnline: true,
  isWifi: false,
  queue: [],
  isUploading: false,
  currentUploadId: null,
  uploadProgress: 0,
  totalUploaded: 0,
  totalFailed: 0,
  lastSyncActivity: null,
  syncHistory: [],

  setNetworkState: (isOnline, isWifi) =>
    set({ isOnline, isWifi }),

  setQueue: (queue) =>
    set({ queue }),

  addToQueue: (item) =>
    set((state) => ({
      queue: [
        ...state.queue.filter((existing) => existing.recordingId !== item.recordingId),
        item,
      ],
    })),

  removeFromQueue: (recordingId) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.recordingId !== recordingId),
    })),

  updateQueueItem: (recordingId, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.recordingId === recordingId ? { ...item, ...updates } : item
      ),
    })),

  setUploading: (isUploading, currentUploadId) =>
    set({
      isUploading,
      currentUploadId: currentUploadId ?? null,
      uploadProgress: isUploading ? 0 : 0,
    }),

  setUploadProgress: (uploadProgress) =>
    set({ uploadProgress }),

  incrementUploaded: () =>
    set((state) => ({ totalUploaded: state.totalUploaded + 1 })),

  incrementFailed: () =>
    set((state) => ({ totalFailed: state.totalFailed + 1 })),

  setLastSyncActivity: (message, status) =>
    set((state) => {
      const nextActivity = {
        message,
        status,
        at: new Date().toISOString(),
      };

      return {
        lastSyncActivity: nextActivity,
        syncHistory: [nextActivity, ...state.syncHistory].slice(0, MAX_SYNC_HISTORY),
      };
    }),

  clearQueue: () =>
    set({ queue: [], isUploading: false, currentUploadId: null }),
}));
