import { create } from 'zustand';
import type { ExportFormat } from '../services/export';

export type ActivityStatus = 'info' | 'success' | 'warning' | 'error';
const MAX_EXPORT_HISTORY = 20;

export interface ExportActivity {
  format: ExportFormat;
  message: string;
  status: ActivityStatus;
  at: string;
}

interface ActivityStoreState {
  lastExport: ExportActivity | null;
  exportHistory: ExportActivity[];
  setLastExport: (event: Omit<ExportActivity, 'at'>) => void;
  clearLastExport: () => void;
}

export const useActivityStore = create<ActivityStoreState>((set) => ({
  lastExport: null,
  exportHistory: [],

  setLastExport: (event) =>
    set((state) => {
      const nextEvent = {
        ...event,
        at: new Date().toISOString(),
      };

      return {
        lastExport: nextEvent,
        exportHistory: [nextEvent, ...state.exportHistory].slice(0, MAX_EXPORT_HISTORY),
      };
    }),

  clearLastExport: () =>
    set({ lastExport: null, exportHistory: [] }),
}));
