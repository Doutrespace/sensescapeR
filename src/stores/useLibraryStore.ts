import { create } from 'zustand';
import {
  Recording,
  RecordingWithPerception,
  RecordingFilters,
  SyncStatus,
} from '../types/recording';
import {
  getRecordingsWithPerceptions,
  getRecordingCount,
  deleteRecording as dbDeleteRecording,
} from '../services/database/recordings';

type LibraryQueryMode = 'page' | 'all';
const PAGE_SIZE = 50;

interface LibraryStoreState {
  // Data
  recordings: RecordingWithPerception[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  queryMode: LibraryQueryMode;

  // Filters
  filters: RecordingFilters;

  // Stats
  totalCount: number;
  uploadedCount: number;
  pendingCount: number;
  failedCount: number;

  // Actions
  loadRecordings: (mode?: LibraryQueryMode) => Promise<void>;
  loadMoreRecordings: () => Promise<void>;
  refreshRecordings: () => Promise<void>;
  setFilters: (filters: RecordingFilters) => void;
  clearFilters: () => void;
  deleteRecording: (id: string) => Promise<void>;
  addRecording: (recording: RecordingWithPerception) => void;
  updateRecordingSyncStatus: (id: string, status: SyncStatus, remoteId?: string) => void;
  updateRecordingLocally: (id: string, updates: Partial<RecordingWithPerception>) => void;
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  recordings: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  hasMore: false,
  queryMode: 'page',
  filters: {},
  totalCount: 0,
  uploadedCount: 0,
  pendingCount: 0,
  failedCount: 0,

  loadRecordings: async (mode = get().queryMode) => {
    const { filters } = get();

    set({ isLoading: true, error: null, queryMode: mode });

    try {
      const totalCount = await getRecordingCount(filters);
      const uploadedCount = await getRecordingCount({ ...filters, syncStatus: ['uploaded'] });
      const pendingCount = await getRecordingCount({ ...filters, syncStatus: ['queued', 'local'] });
      const failedCount = await getRecordingCount({ ...filters, syncStatus: ['failed'] });
      const recordings = mode === 'all'
        ? await getRecordingsWithPerceptions(filters)
        : await getRecordingsWithPerceptions(filters, { limit: PAGE_SIZE, offset: 0 });

      set({
        recordings,
        totalCount,
        uploadedCount,
        pendingCount,
        failedCount,
        hasMore: mode === 'page' ? recordings.length < totalCount : false,
        isLoading: false,
        isLoadingMore: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load recordings',
        isLoading: false,
        isLoadingMore: false,
      });
    }
  },

  loadMoreRecordings: async () => {
    const { filters, recordings, isLoading, isLoadingMore, hasMore, queryMode } = get();

    if (isLoading || isLoadingMore || !hasMore || queryMode !== 'page') {
      return;
    }

    set({ isLoadingMore: true, error: null });

    try {
      const totalCount = await getRecordingCount(filters);
      const nextPage = await getRecordingsWithPerceptions(filters, {
        limit: PAGE_SIZE,
        offset: recordings.length,
      });

      set((state) => ({
        recordings: [...state.recordings, ...nextPage],
        totalCount,
        hasMore: state.recordings.length + nextPage.length < totalCount,
        isLoadingMore: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load more recordings',
        isLoadingMore: false,
      });
    }
  },

  refreshRecordings: async () => {
    await get().loadRecordings();
  },

  setFilters: (filters) => {
    set({ filters });
    get().loadRecordings();
  },

  clearFilters: () => {
    set({ filters: {} });
    get().loadRecordings();
  },

  deleteRecording: async (id) => {
    try {
      const target = get().recordings.find((r) => r.id === id);
      await dbDeleteRecording(id);
      set((state) => ({
        recordings: state.recordings.filter((r) => r.id !== id),
        totalCount: Math.max(0, state.totalCount - 1),
        uploadedCount:
          target?.syncStatus === 'uploaded'
            ? Math.max(0, state.uploadedCount - 1)
            : state.uploadedCount,
        pendingCount:
          target?.syncStatus === 'queued' || target?.syncStatus === 'local'
            ? Math.max(0, state.pendingCount - 1)
            : state.pendingCount,
        failedCount:
          target?.syncStatus === 'failed'
            ? Math.max(0, state.failedCount - 1)
            : state.failedCount,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete recording',
      });
    }
  },

  addRecording: (recording) => {
    set((state) => ({
      recordings: [recording, ...state.recordings],
      totalCount: state.totalCount + 1,
      pendingCount:
        recording.syncStatus === 'queued' || recording.syncStatus === 'local'
          ? state.pendingCount + 1
          : state.pendingCount,
      uploadedCount:
        recording.syncStatus === 'uploaded'
          ? state.uploadedCount + 1
          : state.uploadedCount,
      failedCount:
        recording.syncStatus === 'failed'
          ? state.failedCount + 1
          : state.failedCount,
    }));
  },

  updateRecordingSyncStatus: (id, status, remoteId) => {
    set((state) => {
      const previous = state.recordings.find((recording) => recording.id === id);
      const wasPending = previous ? previous.syncStatus === 'queued' || previous.syncStatus === 'local' : false;
      const isPending = status === 'queued' || status === 'local';
      const wasUploaded = previous?.syncStatus === 'uploaded';
      const wasFailed = previous?.syncStatus === 'failed';

      return {
        recordings: state.recordings.map((r) =>
          r.id === id ? { ...r, syncStatus: status, remoteId } : r
        ),
        uploadedCount:
          !wasUploaded && status === 'uploaded'
            ? state.uploadedCount + 1
            : wasUploaded && status !== 'uploaded'
              ? Math.max(0, state.uploadedCount - 1)
              : state.uploadedCount,
        pendingCount:
          !wasPending && isPending
            ? state.pendingCount + 1
            : wasPending && !isPending
              ? Math.max(0, state.pendingCount - 1)
              : state.pendingCount,
        failedCount:
          !wasFailed && status === 'failed'
            ? state.failedCount + 1
            : wasFailed && status !== 'failed'
              ? Math.max(0, state.failedCount - 1)
              : state.failedCount,
      };
    });
  },

  updateRecordingLocally: (id, updates) => {
    set((state) => ({
      recordings: state.recordings.map((recording) => (
        recording.id === id ? { ...recording, ...updates } : recording
      )),
    }));
  },
}));
