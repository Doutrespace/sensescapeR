import { router } from 'expo-router';
import { OnboardingScreen } from '../src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '../src/stores/useOnboardingStore';
import { isParticipantReady, useParticipantStore } from '../src/stores/useParticipantStore';

export default function OnboardingRoute() {
  const { setOnboardingComplete } = useOnboardingStore();

  const handleComplete = async () => {
    await setOnboardingComplete();
    // First use continues with the consent and the personal details.
    router.replace(isParticipantReady(useParticipantStore.getState()) ? '/(tabs)' : '/participant');
  };

  return <OnboardingScreen onComplete={handleComplete} />;
}
