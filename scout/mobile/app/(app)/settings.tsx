import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { updateNotificationSettings } from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { permissionGranted, requestPermission } = useNotifications();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notifications_enabled ?? true
  );
  const [isSaving, setIsSaving] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    setIsSaving(true);
    try {
      await updateNotificationSettings(value);
    } catch {
      // Revert on failure
      setNotificationsEnabled(!value);
      Alert.alert('Error', 'Failed to update notification settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Push notification permission was denied. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Notifications Section */}
      <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Enable Push Notifications</Text>
            <Text style={styles.rowSubtitle}>
              Get alerted when scouts find new deals
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: '#334155', true: '#6366F1' }}
            thumbColor={notificationsEnabled ? '#FFFFFF' : '#94A3B8'}
            ios_backgroundColor="#334155"
            disabled={isSaving}
          />
        </View>

        <View style={styles.separator} />

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Notification Permission</Text>
            <Text style={[styles.rowSubtitle, permissionGranted ? styles.statusGranted : styles.statusDenied]}>
              {permissionGranted ? 'Granted' : 'Not granted'}
            </Text>
          </View>
          {!permissionGranted && (
            <TouchableOpacity
              style={styles.grantButton}
              onPress={handleGrantPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.grantButtonText}>Grant</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Account Section */}
      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Email</Text>
            <Text style={styles.rowSubtitle}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        <TouchableOpacity
          style={styles.row}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <Text style={styles.sectionHeader}>ABOUT</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>App Version</Text>
          <Text style={styles.rowValue}>{appVersion}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <Text style={styles.rowTitle}>App Name</Text>
          <Text style={styles.rowValue}>Scout</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 12,
  },
  section: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    color: '#94A3B8',
  },
  separator: {
    height: 1,
    backgroundColor: '#334155',
    marginLeft: 16,
  },
  statusGranted: {
    color: '#22C55E',
  },
  statusDenied: {
    color: '#F59E0B',
  },
  grantButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
