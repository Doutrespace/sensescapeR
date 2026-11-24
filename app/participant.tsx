import { Redirect, router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ParticipantSetupScreen from '../src/components/participant/ParticipantSetupScreen';
import { isParticipantReady, useParticipantStore } from '../src/stores/useParticipantStore';
import { Colors } from '../src/theme/colors';

/** First use: information, consent and the personal details asked once. */
export default function ParticipantRoute() {
  const insets = useSafeAreaInsets();
  const isReady = useParticipantStore(isParticipantReady);

  if (isReady) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ParticipantSetupScreen
        mode="setup"
        bottomInset={Math.max(insets.bottom, 16) + 8}
        onDone={() => router.replace('/(tabs)')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
