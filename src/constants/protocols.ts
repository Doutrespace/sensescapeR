import { MaterialIcons } from '@expo/vector-icons';
import { ProtocolType } from '../types/recording';

export type IconName = keyof typeof MaterialIcons.glyphMap;

export interface ProtocolOption {
  value: ProtocolType;
  label: string;
  shortLabel: string;
  description: string;
  defaultDuration: number; // ms
  allowedDurations: number[]; // ms
  icon: IconName;
}

export const PROTOCOLS: ProtocolOption[] = [
  {
    value: 'opportunistic',
    label: 'Opportunistic',
    shortLabel: 'Quick',
    description: 'Flexible recording for casual observations',
    defaultDuration: 30000,
    allowedDurations: [15000, 30000, 60000, 120000, 180000],
    icon: 'smartphone',
  },
  {
    value: 'stationary_60s',
    label: 'Stationary 60s',
    shortLabel: '60s',
    description: 'ISO 12913-2 compliant 60-second recording',
    defaultDuration: 60000,
    allowedDurations: [60000],
    icon: 'gps-fixed',
  },
  {
    value: 'soundwalk',
    label: 'Soundwalk Point',
    shortLabel: 'Walk',
    description: 'Recording at a soundwalk stop point',
    defaultDuration: 60000,
    allowedDurations: [30000, 60000, 120000],
    icon: 'directions-walk',
  },
];

export const DURATION_OPTIONS = [
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
  { value: 120000, label: '2m' },
  { value: 180000, label: '3m' },
];

export function getProtocolOption(value: ProtocolType): ProtocolOption | undefined {
  return PROTOCOLS.find((p) => p.value === value);
}

export function getProtocolLabel(value: ProtocolType): string {
  return PROTOCOLS.find((p) => p.value === value)?.label ?? value;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDurationLong(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds} seconds`;
  }
  if (remainingSeconds === 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
