import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'http://localhost:3000/api';

export interface User {
  id: string;
  email: string;
  created_at: string;
  notifications_enabled: boolean;
}

export interface Scout {
  id: string;
  name: string;
  keywords: string[];
  min_price?: number;
  max_price?: number;
  marketplaces: string[];
  active: boolean;
  notifications_enabled: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  scout_id: string;
  marketplace: 'ebay' | 'reddit' | 'chrono24' | 'facebook';
  title: string;
  price?: number;
  url: string;
  image_url?: string;
  description?: string;
  seller?: string;
  found_at: string;
}

export interface CreateScoutData {
  name: string;
  keywords: string[];
  min_price?: number;
  max_price?: number;
  marketplaces: string[];
  active: boolean;
  notifications_enabled: boolean;
}

export interface ListingsParams {
  page?: number;
  limit?: number;
  scout_id?: string;
  marketplace?: string;
}

type UnauthorizedCallback = () => void;
let onUnauthorized: UnauthorizedCallback | null = null;

export const setUnauthorizedCallback = (callback: UnauthorizedCallback): void => {
  onUnauthorized = callback;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = async (
  email: string,
  password: string
): Promise<{ user: User; token: string }> => {
  const response = await apiClient.post<{ user: User; token: string }>('/auth/login', {
    email,
    password,
  });
  return response.data;
};

export const register = async (
  email: string,
  password: string
): Promise<{ user: User; token: string }> => {
  const response = await apiClient.post<{ user: User; token: string }>('/auth/register', {
    email,
    password,
  });
  return response.data;
};

export const updateFcmToken = async (token: string): Promise<void> => {
  await apiClient.post('/auth/fcm-token', { token });
};

export const updateNotificationSettings = async (enabled: boolean): Promise<User> => {
  const response = await apiClient.patch<{ user: User }>('/auth/notifications', { enabled });
  return response.data.user;
};

// Scouts
export const getScouts = async (): Promise<Scout[]> => {
  const response = await apiClient.get<{ scouts: Scout[] }>('/scouts');
  return response.data.scouts;
};

export const createScout = async (data: CreateScoutData): Promise<Scout> => {
  const response = await apiClient.post<{ scout: Scout }>('/scouts', data);
  return response.data.scout;
};

export const updateScout = async (
  id: string,
  data: Partial<CreateScoutData>
): Promise<Scout> => {
  const response = await apiClient.patch<{ scout: Scout }>(`/scouts/${id}`, data);
  return response.data.scout;
};

export const deleteScout = async (id: string): Promise<void> => {
  await apiClient.delete(`/scouts/${id}`);
};

export const runScout = async (id: string): Promise<void> => {
  await apiClient.post(`/scouts/${id}/run`);
};

// Listings
export const getListings = async (
  params?: ListingsParams
): Promise<{ listings: Listing[]; total: number; page: number }> => {
  const response = await apiClient.get<{ listings: Listing[]; total: number; page: number }>(
    '/listings',
    { params }
  );
  return response.data;
};

export const getScoutListings = async (
  scoutId: string,
  params?: Omit<ListingsParams, 'scout_id'>
): Promise<{ listings: Listing[]; total: number; page: number }> => {
  const response = await apiClient.get<{ listings: Listing[]; total: number; page: number }>(
    `/scouts/${scoutId}/listings`,
    { params }
  );
  return response.data;
};

export const dismissListing = async (id: string): Promise<void> => {
  await apiClient.delete(`/listings/${id}`);
};

export default apiClient;
