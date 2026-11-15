import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  visible: boolean;
  style?: ViewStyle;
  duration?: number;
}

export default function FadeTransition({
  children,
  visible,
  style,
  duration = 200,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateAnim = useRef(new Animated.Value(visible ? 0 : 20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: visible ? 0 : 20,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fadeAnim, translateAnim, duration]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateAnim }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
