import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { CommunityVisibility, LicenseType, PrivacyMode } from '../types/recording';
import { LoggingService } from '../services/logging';

const PREFERENCES_KEY = 'soundscape.preferences.v1';
export type AudioLevelingMode = 'off' | 'playback';

interface StoredPreferences {
  autoUploadWifiOnly: boolean;
  defaultPrivacyMode: PrivacyMode;
  defaultLicense: LicenseType;
  defaultCommunityVisibility: CommunityVisibility;
  audioLevelingMode: AudioLevelingMode;
  autoCleanupRetentionDays: number | null;
  autoCleanupUploadedOnly: boolean;
  profileAvatarMode: 'default' | 'emoji' | 'image';
  profileAvatarEmoji: string | null;
  profileAvatarImageUri: string | null;
}

interface PreferencesStoreState extends StoredPreferences {
  isLoaded: boolean;
  initialize: () => Promise<void>;
  setAutoUploadWifiOnly: (value: boolean) => Promise<void>;
  setDefaultPrivacyMode: (value: PrivacyMode) => Promise<void>;
  setDefaultLicense: (value: LicenseType) => Promise<void>;
  setDefaultCommunityVisibility: (value: CommunityVisibility) => Promise<void>;
  setAudioLevelingMode: (value: AudioLevelingMode) => Promise<void>;
  setAutoCleanupRetentionDays: (value: number | null) => Promise<void>;
  setAutoCleanupUploadedOnly: (value: boolean) => Promise<void>;
  setProfileAvatarEmoji: (value: string) => Promise<void>;
  setProfileAvatarImageUri: (value: string) => Promise<void>;
  clearProfileAvatar: () => Promise<void>;
}

/**
 * Version 2 made "private" the default share setting: course measurements
 * reach the public map only when the participant chooses so. A setting saved
 * before (usually the old default "community", never chosen on purpose) is
 * not carried over.
 */
const VISIBILITY_DEFAULT_VERSION = 2;

const DEFAULT_PREFERENCES: StoredPreferences = {
  autoUploadWifiOnly: true,
  defaultPrivacyMode: 'exact',
  defaultLicense: 'CC-BY',
  defaultCommunityVisibility: 'private',
  audioLevelingMode: 'playback',
  autoCleanupRetentionDays: 90,
  autoCleanupUploadedOnly: true,
  profileAvatarMode: 'default',
  profileAvatarEmoji: null,
  profileAvatarImageUri: null,
};

async function persistPreferences(preferences: StoredPreferences): Promise<void> {
  await AsyncStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ ...preferences, visibilityDefaultVersion: VISIBILITY_DEFAULT_VERSION })
  );
}

export const usePreferencesStore = create<PreferencesStoreState>((set, get) => ({
  ...DEFAULT_PREFERENCES,
  isLoaded: false,

  initialize: async () => {
    try {
      const storedValue = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (!storedValue) {
        set({ isLoaded: true });
        return;
      }

      const parsed = JSON.parse(storedValue) as Partial<StoredPreferences> & {
        visibilityDefaultVersion?: number;
      };
      set({
        autoUploadWifiOnly: typeof parsed.autoUploadWifiOnly === 'boolean'
          ? parsed.autoUploadWifiOnly
          : DEFAULT_PREFERENCES.autoUploadWifiOnly,
        defaultPrivacyMode: parsed.defaultPrivacyMode ?? DEFAULT_PREFERENCES.defaultPrivacyMode,
        defaultLicense: parsed.defaultLicense ?? DEFAULT_PREFERENCES.defaultLicense,
        defaultCommunityVisibility:
          parsed.visibilityDefaultVersion === VISIBILITY_DEFAULT_VERSION
          && (parsed.defaultCommunityVisibility === 'private' || parsed.defaultCommunityVisibility === 'community')
            ? parsed.defaultCommunityVisibility
            : DEFAULT_PREFERENCES.defaultCommunityVisibility,
        audioLevelingMode:
          parsed.audioLevelingMode === 'off' || parsed.audioLevelingMode === 'playback'
            ? parsed.audioLevelingMode
            : DEFAULT_PREFERENCES.audioLevelingMode,
        autoCleanupRetentionDays: typeof parsed.autoCleanupRetentionDays === 'number'
          ? parsed.autoCleanupRetentionDays
          : parsed.autoCleanupRetentionDays === null
            ? null
            : DEFAULT_PREFERENCES.autoCleanupRetentionDays,
        autoCleanupUploadedOnly: typeof parsed.autoCleanupUploadedOnly === 'boolean'
          ? parsed.autoCleanupUploadedOnly
          : DEFAULT_PREFERENCES.autoCleanupUploadedOnly,
        profileAvatarMode:
          parsed.profileAvatarMode === 'emoji' || parsed.profileAvatarMode === 'image'
            ? parsed.profileAvatarMode
            : DEFAULT_PREFERENCES.profileAvatarMode,
        profileAvatarEmoji: typeof parsed.profileAvatarEmoji === 'string'
          ? parsed.profileAvatarEmoji
          : DEFAULT_PREFERENCES.profileAvatarEmoji,
        profileAvatarImageUri: typeof parsed.profileAvatarImageUri === 'string'
          ? parsed.profileAvatarImageUri
          : DEFAULT_PREFERENCES.profileAvatarImageUri,
        isLoaded: true,
      });
    } catch (error) {
      LoggingService.warn('Failed to load saved app preferences', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ isLoaded: true });
    }
  },

  setAutoUploadWifiOnly: async (autoUploadWifiOnly) => {
    const next = {
      autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setDefaultPrivacyMode: async (defaultPrivacyMode) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setDefaultLicense: async (defaultLicense) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setDefaultCommunityVisibility: async (defaultCommunityVisibility) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setAudioLevelingMode: async (audioLevelingMode) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setAutoCleanupRetentionDays: async (autoCleanupRetentionDays) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setAutoCleanupUploadedOnly: async (autoCleanupUploadedOnly) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly,
      profileAvatarMode: get().profileAvatarMode,
      profileAvatarEmoji: get().profileAvatarEmoji,
      profileAvatarImageUri: get().profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  setProfileAvatarEmoji: async (profileAvatarEmoji) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: 'emoji' as const,
      profileAvatarEmoji,
      profileAvatarImageUri: null,
    };
    set(next);
    await persistPreferences(next);
  },

  setProfileAvatarImageUri: async (profileAvatarImageUri) => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: 'image' as const,
      profileAvatarEmoji: null,
      profileAvatarImageUri,
    };
    set(next);
    await persistPreferences(next);
  },

  clearProfileAvatar: async () => {
    const next = {
      autoUploadWifiOnly: get().autoUploadWifiOnly,
      defaultPrivacyMode: get().defaultPrivacyMode,
      defaultLicense: get().defaultLicense,
      defaultCommunityVisibility: get().defaultCommunityVisibility,
      audioLevelingMode: get().audioLevelingMode,
      autoCleanupRetentionDays: get().autoCleanupRetentionDays,
      autoCleanupUploadedOnly: get().autoCleanupUploadedOnly,
      profileAvatarMode: 'default' as const,
      profileAvatarEmoji: null,
      profileAvatarImageUri: null,
    };
    set(next);
    await persistPreferences(next);
  },
}));
