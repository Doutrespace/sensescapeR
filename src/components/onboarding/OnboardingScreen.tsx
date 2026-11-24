import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { LoggingService } from '../../services/logging';
import { t } from '../../i18n';
import { LanguageToggle } from '../ui/LanguageToggle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  action?: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    icon: 'explore',
    title: 'Welcome to\nSensescape Explorer',
    description: 'Capture how a place sounds, looks, smells and feels: a short recording and a few questions, right where you are.',
  },
  {
    id: 'steps',
    icon: 'graphic-eq',
    title: 'One measurement, five minutes',
    description: 'Thirty seconds of sound, a photo if you like, then your impressions of the soundscape and the other senses. At the end your project group adds its own questions.',
  },
  {
    id: 'science',
    icon: 'science',
    title: 'Built on research standards',
    description: 'The questions follow established methods, among them the soundscape standard ISO/TS 12913. There are no right or wrong answers: what counts is how you perceive the place.',
  },
  {
    id: 'permissions',
    icon: 'security',
    title: 'Microphone and location',
    description: 'The app needs the microphone for the recording and your location to put the measurement on the map. Both are only used while you measure.',
    action: 'Allow access',
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  // Asked at least once; a refusal must not lock the user out of the app.
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  // Page the Next button is scrolling to; swipe tracking waits until it is reached.
  const scrollTarget = useRef<number | null>(null);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentIndex < SLIDES.length - 1) {
      scrollTarget.current = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleRequestPermissions = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const [micStatus, locationStatus] = await Promise.all([
        Audio.requestPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      if (micStatus.status === 'granted' && locationStatus.status === 'granted') {
        setPermissionsGranted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      LoggingService.warn('Failed to request onboarding permissions', {
        error: error instanceof Error ? error.message : String(error),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPermissionsRequested(true);
    }
  };

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const isLastSlide = index === SLIDES.length - 1;

    return (
      <View style={styles.slide}>
        <View style={styles.iconContainer}>
          <MaterialIcons name={item.icon} size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>{t(item.title)}</Text>
        <Text style={styles.description}>{t(item.description)}</Text>

        {isLastSlide && item.action && !permissionsGranted && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRequestPermissions}
            activeOpacity={0.8}
          >
            <MaterialIcons name="lock-open" size={20} color={Colors.background} />
            <Text style={styles.actionButtonText}>{t(item.action)}</Text>
          </TouchableOpacity>
        )}

        {isLastSlide && permissionsRequested && !permissionsGranted && (
          <Text style={styles.permissionNote}>
            {t('Access was not granted completely. Without the microphone no recording is possible; without location the measurement has no place on the map. You can allow both later in the settings of your browser.')}
          </Text>
        )}

        {isLastSlide && permissionsGranted && (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={32} color={Colors.success} />
            <Text style={styles.successText}>{t('Permissions granted!')}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderPagination = () => (
    <View style={styles.pagination}>
      {SLIDES.map((_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });

        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity: dotOpacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const canProceed = !isLastSlide || permissionsGranted || permissionsRequested;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.languageToggle}>
        <LanguageToggle />
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
        <Text style={styles.skipText}>{t('Skip')}</Text>
      </TouchableOpacity>

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (scrollTarget.current !== null) {
                // Still on the way to the page the button asked for.
                if (index === scrollTarget.current) {
                  scrollTarget.current = null;
                }
                return;
              }
              if (index >= 0 && index < SLIDES.length) {
                setCurrentIndex(index);
              }
            },
          }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {renderPagination()}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={isLastSlide ? handleComplete : handleNext}
          disabled={!canProceed}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? t('Get Started') : t('Next')}
          </Text>
          <MaterialIcons
            name={isLastSlide ? 'check' : 'arrow-forward'}
            size={20}
            color={Colors.background}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  languageToggle: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: Spacing.sm,
  },
  skipText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Keeps the content clear of the language switch and "Skip" above it.
    paddingTop: 112,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.primary,
  },
  actionButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionNote: {
    marginTop: Spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  successText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginHorizontal: 4,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    ...Shadows.primary,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.textDisabled,
  },
  nextButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
});
