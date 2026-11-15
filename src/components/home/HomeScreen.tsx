import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';

interface Props {
  onStartMeasurement: () => void;
  communityCount?: number | null;
}

const QUICK_FACTS = [
  { icon: 'place', label: 'Geotagged' },
  { icon: 'multitrack-audio', label: '48 kHz' },
  { icon: 'science', label: 'ISO 12913' },
] as const;

export function HomeScreen({ onStartMeasurement, communityCount }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const micScale = useRef(new Animated.Value(1)).current;
  const micHaloScale = useRef(new Animated.Value(1)).current;
  const micHaloOpacity = useRef(new Animated.Value(0.16)).current;

  const animateMicPress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(micScale, {
          toValue: 0.94,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(micScale, {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(micHaloScale, {
          toValue: 1.22,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(micHaloScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(micHaloOpacity, {
          toValue: 0.32,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(micHaloOpacity, {
          toValue: 0.16,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  return (
    <View style={[styles.container, { paddingBottom: tabBarHeight + Spacing.lg }]}>
      <View style={styles.backgroundCircle} />
      <View style={styles.gridLineHorizontal} />
      <View style={styles.gridLineVertical} />

      <View style={styles.hero}>
        <Pressable
          onPress={() => {
            animateMicPress();
            onStartMeasurement();
          }}
          accessibilityRole="button"
          accessibilityLabel="Start recording from microphone button"
          accessibilityHint="Starts a new recording immediately"
          style={styles.markerPressable}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.markerHalo,
              {
                opacity: micHaloOpacity,
                transform: [{ scale: micHaloScale }],
              },
            ]}
          />
          <Animated.View style={[styles.markerBadge, { transform: [{ scale: micScale }] }]}>
            <MaterialIcons name="mic-none" size={28} color={Colors.primary} />
          </Animated.View>
        </Pressable>
        <Text style={styles.title}>Soundscape{'\n'}Explorer</Text>
        <Text style={styles.subtitle}>Record the place as it sounds.</Text>
        {typeof communityCount === 'number' ? (
          <View style={styles.communityLine}>
            <Text style={styles.communityCount}>{communityCount}</Text>
            <Text style={styles.communityText}>community contributions</Text>
          </View>
        ) : null}

        <View style={styles.factList}>
          {QUICK_FACTS.map((item, index) => (
            <View key={item.label} style={styles.factRow}>
              <Text style={styles.factIndex}>0{index + 1}</Text>
              <View style={styles.factDivider} />
              <MaterialIcons name={item.icon} size={16} color={Colors.textMuted} />
              <Text style={styles.factText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionBlock}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={onStartMeasurement}
          activeOpacity={0.9}
        >
          <Text style={styles.startButtonText}>Start Recording</Text>
          <View style={styles.startButtonIcon}>
            <MaterialIcons name="arrow-forward" size={18} color={Colors.surface} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
  },
  backgroundCircle: {
    position: 'absolute',
    top: 104,
    right: -24,
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: '#DED7CA',
    backgroundColor: '#F7F3EA',
  },
  gridLineHorizontal: {
    position: 'absolute',
    top: 248,
    left: Spacing.lg,
    right: Spacing.lg,
    height: 1,
    backgroundColor: '#E2DBCF',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 96,
    bottom: 164,
    right: 84,
    width: 1,
    backgroundColor: '#E2DBCF',
  },
  hero: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  markerPressable: {
    width: 64,
    height: 64,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerHalo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B8C9A3',
  },
  markerBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1.1,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 260,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.textMuted,
  },
  communityLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  communityCount: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  communityText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  factList: {
    width: '100%',
    marginTop: Spacing.lg,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    gap: 10,
  },
  factIndex: {
    width: 24,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  factDivider: {
    width: 16,
    height: 1,
    backgroundColor: Colors.surfaceHighlight,
  },
  factText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionBlock: {
    alignItems: 'stretch',
  },
  startButton: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.md,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.surface,
  },
  startButtonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B2B2B',
  },
});
