import '../src/web/setup';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Alert, Text, TouchableOpacity } from 'react-native';
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
import { isParticipantReady, useParticipantStore } from '../src/stores/useParticipantStore';
import { Colors } from '../src/theme/colors';
import { t, useLanguageStore } from '../src/i18n';
import { acquireTabLock } from '../src/web/tabLock';
import { isSupabaseConfigured } from '../src/utils/supabase';

export default function RootLayout() {
    const router = useRouter();
    const { hasCompletedOnboarding, isLoading, checkOnboardingStatus } = useOnboardingStore();
    const { initialize: initializePreferences } = usePreferencesStore();
    const { initialize: initializeAuth } = useAuthStore();
    const { initialize: initializeBadges } = useBadgeStore();
    const initializeParticipant = useParticipantStore((state) => state.initialize);
    const participantReady = useParticipantStore(isParticipantReady);
    const language = useLanguageStore((state) => state.language);
    const initializeLanguage = useLanguageStore((state) => state.initialize);
    const [openInOtherTab, setOpenInOtherTab] = useState(false);

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
            // Stored language choice must be known before the first screen renders.
            await initializeLanguage();

            // A second tab must not open the database (see tabLock).
            if (Platform.OS === 'web' && (await acquireTabLock()) === 'blocked') {
                setOpenInOtherTab(true);
                return;
            }

            // The participant must be known before the first screen is chosen.
            await initializeParticipant();

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
                Alert.alert(
                    t('Storage unavailable'),
                    t('The storage of this browser could not be opened, so measurements cannot be saved here. Leave private browsing, reload the page or open the link in another browser.')
                );
            }

            const preferences = usePreferencesStore.getState();
            // Without a course database the device holds the only copy:
            // nothing is removed automatically.
            if (isSupabaseConfigured && preferences.autoCleanupRetentionDays !== null) {
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
    }, [checkOnboardingStatus, initializeAuth, initializeLanguage, initializeParticipant, initializePreferences, initializeBadges]);

    // On web the URL decides the first screen, so a first-time visitor opening
    // the site root would land on the tabs and never see onboarding.
    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!hasCompletedOnboarding) {
            if (Platform.OS === 'web') {
                router.replace('/onboarding');
            }
            return;
        }

        // Consent and the personal details (Teil 1) come before any measurement,
        // also for people who used an earlier version of the app.
        if (!participantReady) {
            router.replace('/participant');
        }
    }, [hasCompletedOnboarding, isLoading, participantReady, router]);

    if (openInOtherTab) {
        return (
            <View style={styles.blockedContainer}>
                <Text style={styles.blockedTitle}>{t('Already open in another tab')}</Text>
                <Text style={styles.blockedText}>
                    {t('Sensescape Explorer is already open in another tab or window of this browser. Please continue there and close this tab, otherwise measurements could get lost.')}
                </Text>
                <TouchableOpacity
                    style={styles.blockedButton}
                    onPress={() => {
                        if (typeof window !== 'undefined') {
                            window.location.reload();
                        }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Try again')}
                >
                    <Text style={styles.blockedButtonText}>{t('Try again')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <ErrorBoundary>
            {/* Keyed by language: switching it re-renders every screen in the new language. */}
            <Stack key={language} screenOptions={{ headerShown: false }}>
                {!hasCompletedOnboarding ? (
                    <Stack.Screen name="onboarding" />
                ) : !participantReady ? (
                    <Stack.Screen name="participant" />
                ) : (
                    <Stack.Screen name="(tabs)" />
                )}
            </Stack>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 28,
        gap: 14,
        backgroundColor: Colors.background,
    },
    blockedTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.text,
    },
    blockedText: {
        fontSize: 16,
        lineHeight: 23,
        color: Colors.textMuted,
    },
    blockedButton: {
        alignSelf: 'flex-start',
        minHeight: 52,
        paddingHorizontal: 24,
        borderRadius: 26,
        justifyContent: 'center',
        backgroundColor: Colors.text,
    },
    blockedButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
});
