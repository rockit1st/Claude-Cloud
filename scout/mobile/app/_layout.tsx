import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../contexts/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      // Notification received in foreground — handler above ensures it displays as alert
      console.log('Notification received:', notification.request.identifier);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // User tapped a notification
        console.log('Notification tapped:', response.notification.request.identifier);
      }
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <View style={styles.container}>
        <Slot />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
