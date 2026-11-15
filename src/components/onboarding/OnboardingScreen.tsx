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
    icon: 'mic',
    title: 'Welcome to\nSoundscape Explorer',
    description: 'Capture and contribute to global soundscape research using standardized scientific methods.',
  },
  {
    id: 'iso12913',
    icon: 'science',
    title: 'ISO 12913 Compliant',
    description: 'Record soundscapes following international standards for acoustic environment assessment used by researchers worldwide.',
  },
  {
    id: 'perception',
    icon: 'psychology',
    title: 'Perceptual Assessment',
    description: 'Rate how pleasant and eventful each soundscape feels using validated scientific scales based on decades of research.',
  },
  {
    id: 'permissions',
    icon: 'security',
    title: 'Permissions Needed',
    description: 'We need microphone access to record and location to geotag your soundscapes. Your data stays private until you choose to share.',
    action: 'Grant Permissions',
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentIndex < SLIDES.length - 1) {
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

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {isLastSlide && item.action && !permissionsGranted && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRequestPermissions}
            activeOpacity={0.8}
          >
            <MaterialIcons name="lock-open" size={20} color={Colors.background} />
            <Text style={styles.actionButtonText}>{item.action}</Text>
          </TouchableOpacity>
        )}

        {isLastSlide && permissionsGranted && (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={32} color={Colors.success} />
            <Text style={styles.successText}>Permissions granted!</Text>
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
  const canProceed = !isLastSlide || permissionsGranted;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
        <Text style={styles.skipText}>Skip</Text>
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
          { useNativeDriver: false }
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
            {isLastSlide ? 'Get Started' : 'Next'}
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
    padding: Spacing.xl,
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
