import { router } from 'expo-router';
import { OnboardingScreen } from '../src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '../src/stores/useOnboardingStore';

export default function OnboardingRoute() {
  const { setOnboardingComplete } = useOnboardingStore();

  const handleComplete = async () => {
    await setOnboardingComplete();
    router.replace('/(tabs)');
  };

  return <OnboardingScreen onComplete={handleComplete} />;
}
