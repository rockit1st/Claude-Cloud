import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { updateFcmToken } from '../services/api';

interface UseNotificationsResult {
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
}

export const useNotifications = (): UseNotificationsResult => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const tokenSentRef = useRef(false);

  const registerForPushNotifications = async (): Promise<boolean> => {
    if (!Device.isDevice) {
      // Push notifications do not work on simulators
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      if (!tokenSentRef.current) {
        tokenSentRef.current = true;
        await updateFcmToken(pushToken);
      }
    } catch {
      // Non-fatal: token registration failed, notifications won't work but app continues
    }

    return true;
  };

  useEffect(() => {
    const checkPermissions = async () => {
      if (!Device.isDevice) return;

      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted';
      setPermissionGranted(granted);

      if (granted && !tokenSentRef.current) {
        await registerForPushNotifications();
      }
    };

    checkPermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    const granted = await registerForPushNotifications();
    setPermissionGranted(granted);
    return granted;
  };

  return { permissionGranted, requestPermission };
};

export default useNotifications;
