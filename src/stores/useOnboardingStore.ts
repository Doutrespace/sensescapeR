import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggingService } from '../services/logging';

const ONBOARDING_KEY = 'onboarding_complete';

interface OnboardingStoreState {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  setOnboardingComplete: () => Promise<void>;
  checkOnboardingStatus: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStoreState>((set) => ({
  hasCompletedOnboarding: false,
  isLoading: true,

  checkOnboardingStatus: async () => {
    try {
      const status = await AsyncStorage.getItem(ONBOARDING_KEY);
      set({ hasCompletedOnboarding: status === 'true', isLoading: false });
    } catch (error) {
      LoggingService.warn('Failed to check onboarding status', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ isLoading: false });
    }
  },

  setOnboardingComplete: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      set({ hasCompletedOnboarding: true });
    } catch (error) {
      LoggingService.warn('Failed to save onboarding status', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  resetOnboarding: async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      set({ hasCompletedOnboarding: false });
    } catch (error) {
      LoggingService.warn('Failed to reset onboarding status', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
