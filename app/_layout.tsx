import '../src/web/setup';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { getDatabase } from '../src/services/database';
import { initSyncManager, cleanupSyncManager } from '../src/services/sync/syncManager';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { LoggingService } from '../src/services/logging';
import { cleanupExpiredLocalRecordingData } from '../src/services/storage/localStorage';
import { useOnboardingStore } from '../src/stores/useOnboardingStore';
import { usePreferencesStore } from '../src/stores/usePreferencesStore';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useRecordingStore } from '../src/stores/useRecordingStore';
import { useBadgeStore } from '../src/stores/useBadgeStore';
import { Colors } from '../src/theme/colors';

export default function RootLayout() {
    const router = useRouter();
    const { hasCompletedOnboarding, isLoading, checkOnboardingStatus } = useOnboardingStore();
    const { initialize: initializePreferences } = usePreferencesStore();
    const { initialize: initializeAuth } = useAuthStore();
    const { initialize: initializeBadges } = useBadgeStore();

    useEffect(() => {
        const handleIncomingUrl = (url?: string | null) => {
            if (!url) {
                return;
            }

            const parsed = Linking.parse(url);
            const normalizedPath = [parsed.hostname, parsed.path]
                .filter(Boolean)
                .join('/')
                .replace(/^\/+|\/+$/g, '');

            if (normalizedPath === 'record/start') {
                useRecordingStore.getState().queueShortcutAction('START_RECORDING');
                router.replace('/(tabs)');
            }
        };

        void Linking.getInitialURL().then(handleIncomingUrl).catch((error) => {
            LoggingService.warn('Failed to read initial app URL', {
                error: error instanceof Error ? error.message : String(error),
            });
        });

        const subscription = Linking.addEventListener('url', ({ url }) => {
            handleIncomingUrl(url);
        });

        return () => {
            subscription.remove();
        };
    }, [router]);

    useEffect(() => {
        async function initialize() {
            // Check onboarding status
            await checkOnboardingStatus();
            await initializePreferences();
            await initializeAuth();
            await initializeBadges();

            // Initialize database
            try {
                await getDatabase();
                LoggingService.info('Database initialized');
            } catch (err: any) {
                LoggingService.error('Database init failed', { error: err.message });
            }

            const preferences = usePreferencesStore.getState();
            if (preferences.autoCleanupRetentionDays !== null) {
                try {
                    const result = await cleanupExpiredLocalRecordingData({
                        retentionDays: preferences.autoCleanupRetentionDays,
                        uploadedOnly: preferences.autoCleanupUploadedOnly,
                    });

                    if (result.deletedRecordings > 0 || result.deletedFiles > 0) {
                        LoggingService.info('Automatic local retention cleanup removed expired recordings', {
                            deletedRecordings: result.deletedRecordings,
                            deletedFiles: result.deletedFiles,
                            freedBytes: result.freedBytes,
                        });
                    }
                } catch (err: any) {
                    LoggingService.warn('Automatic local retention cleanup failed', {
                        error: err?.message ?? String(err),
                    });
                }
            }

            // Initialize sync manager
            initSyncManager();
            LoggingService.info('Sync manager initialized');
        }

        initialize();

        return () => {
            cleanupSyncManager();
        };
    }, [checkOnboardingStatus, initializeAuth, initializePreferences, initializeBadges]);

    // On web the URL decides the first screen, so a first-time visitor opening
    // the site root would land on the tabs and never see onboarding.
    useEffect(() => {
        if (Platform.OS === 'web' && !isLoading && !hasCompletedOnboarding) {
            router.replace('/onboarding');
        }
    }, [hasCompletedOnboarding, isLoading, router]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false }}>
                {!hasCompletedOnboarding ? (
                    <Stack.Screen name="onboarding" />
                ) : (
                    <Stack.Screen name="(tabs)" />
                )}
            </Stack>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
});
