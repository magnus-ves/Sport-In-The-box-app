import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, HeaderRight } from '@/components/ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

const icon = (name: IconName) =>
  function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <TabIcon name={name} color={color} size={size} />;
  };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        headerRight: () => <HeaderRight />,
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Hurtigknapper', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="rundown" options={{ title: 'Rundown', tabBarIcon: icon('list') }} />
      <Tabs.Screen name="playlists" options={{ title: 'Spillelister', tabBarIcon: icon('musical-notes') }} />
      <Tabs.Screen name="streams" options={{ title: 'Streaming', tabBarIcon: icon('radio') }} />
      <Tabs.Screen name="settings" options={{ title: 'Innstillinger', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
