jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('../services/logging', () => ({
  LoggingService: {
    warn: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferencesStore } from './usePreferencesStore';

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('usePreferencesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({
      autoUploadWifiOnly: true,
      defaultPrivacyMode: 'exact',
      defaultLicense: 'CC-BY',
      defaultCommunityVisibility: 'private',
      audioLevelingMode: 'playback',
      autoCleanupRetentionDays: 90,
      autoCleanupUploadedOnly: true,
      isLoaded: false,
    });
  });

  it('keeps defaults when nothing is persisted', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    await usePreferencesStore.getState().initialize();

    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith('soundscape.preferences.v1');
    expect(usePreferencesStore.getState()).toMatchObject({
      autoUploadWifiOnly: true,
      defaultPrivacyMode: 'exact',
      defaultLicense: 'CC-BY',
      defaultCommunityVisibility: 'private',
      audioLevelingMode: 'playback',
      autoCleanupRetentionDays: 90,
      autoCleanupUploadedOnly: true,
      isLoaded: true,
    });
  });

  it('hydrates persisted values from AsyncStorage', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      autoUploadWifiOnly: false,
      defaultPrivacyMode: 'hidden',
      defaultLicense: 'CC0',
      defaultCommunityVisibility: 'community',
      audioLevelingMode: 'off',
      autoCleanupRetentionDays: 180,
      autoCleanupUploadedOnly: false,
      visibilityDefaultVersion: 2,
    }));

    await usePreferencesStore.getState().initialize();

    expect(usePreferencesStore.getState()).toMatchObject({
      autoUploadWifiOnly: false,
      defaultPrivacyMode: 'hidden',
      defaultLicense: 'CC0',
      defaultCommunityVisibility: 'community',
      audioLevelingMode: 'off',
      autoCleanupRetentionDays: 180,
      autoCleanupUploadedOnly: false,
      isLoaded: true,
    });
  });

  it('does not carry over the old "community" default saved before version 2', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      defaultCommunityVisibility: 'community',
      defaultLicense: 'CC0',
    }));

    await usePreferencesStore.getState().initialize();

    expect(usePreferencesStore.getState()).toMatchObject({
      defaultCommunityVisibility: 'private',
      defaultLicense: 'CC0',
    });
  });

  it('persists preference updates', async () => {
    await usePreferencesStore.getState().setAutoUploadWifiOnly(false);
    await usePreferencesStore.getState().setDefaultPrivacyMode('fuzzed');
    await usePreferencesStore.getState().setDefaultLicense('CC-BY-NC');
    await usePreferencesStore.getState().setDefaultCommunityVisibility('private');
    await usePreferencesStore.getState().setAudioLevelingMode('off');
    await usePreferencesStore.getState().setAutoCleanupRetentionDays(30);
    await usePreferencesStore.getState().setAutoCleanupUploadedOnly(false);

    expect(usePreferencesStore.getState()).toMatchObject({
      autoUploadWifiOnly: false,
      defaultPrivacyMode: 'fuzzed',
      defaultLicense: 'CC-BY-NC',
      defaultCommunityVisibility: 'private',
      audioLevelingMode: 'off',
      autoCleanupRetentionDays: 30,
      autoCleanupUploadedOnly: false,
    });

    expect(mockedAsyncStorage.setItem).toHaveBeenLastCalledWith(
      'soundscape.preferences.v1',
      JSON.stringify({
        autoUploadWifiOnly: false,
        defaultPrivacyMode: 'fuzzed',
        defaultLicense: 'CC-BY-NC',
        defaultCommunityVisibility: 'private',
        audioLevelingMode: 'off',
        autoCleanupRetentionDays: 30,
        autoCleanupUploadedOnly: false,
        profileAvatarMode: 'default',
        profileAvatarEmoji: null,
        profileAvatarImageUri: null,
        visibilityDefaultVersion: 2,
      })
    );
  });
});
