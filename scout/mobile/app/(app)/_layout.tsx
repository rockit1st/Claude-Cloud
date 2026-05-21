import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

function HomeIcon({ color }: { color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>⌂</Text>;
}

function SearchIcon({ color }: { color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>◎</Text>;
}

function GearIcon({ color }: { color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>⚙</Text>;
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="scouts"
        options={{
          title: 'My Scouts',
          tabBarIcon: ({ color }) => <SearchIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <GearIcon color={color} />,
        }}
      />
      {/* Hide scout sub-screens from tab bar */}
      <Tabs.Screen
        name="scout/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="scout/create"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F172A',
    borderTopColor: '#334155',
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 4,
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
  },
});
