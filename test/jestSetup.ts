import '@testing-library/jest-native/extend-expect';

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: ({ name, ...props }: any) =>
      React.createElement('Icon', { ...props, accessibilityLabel: String(name) }),
  };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
