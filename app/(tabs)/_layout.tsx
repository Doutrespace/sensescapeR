import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform, View } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { t } from '../../src/i18n';

// Fallback component for Android when BlurView fails
function TabBarBackground() {
    const baseStyle = {
        flex: 1,
        borderRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.surfaceHighlight,
    };

    // On Android, use a solid background as fallback
    if (Platform.OS === 'android') {
        return (
            <View
                style={{
                    ...baseStyle,
                    backgroundColor: 'rgba(251, 248, 241, 0.96)',
                }}
            />
        );
    }

    // On iOS, use BlurView
    return (
        <BlurView
            intensity={30}
            tint="light"
            style={{
                ...baseStyle,
                backgroundColor: '#FBF8F1D9',
            }}
        />
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 16,
                    borderRadius: 24,
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    height: 70,
                    paddingBottom: 12,
                    paddingTop: 8,
                },
                tabBarBackground: () => <TabBarBackground />,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 0.2,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('Record'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="mic" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: t('Explore'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="public" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="my-map"
                options={{
                    title: t('My Map'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="place" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t('Profile'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="person" size={size} color={color} />
                    ),
                }}
            />
            {/* Hide the old map route */}
            <Tabs.Screen
                name="map"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
