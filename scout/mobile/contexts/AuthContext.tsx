import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, login as apiLogin, register as apiRegister, setUnauthorizedCallback } from '../services/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async (): Promise<void> => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        const tokenValue = storedToken[1];
        const userValue = storedUser[1];

        if (tokenValue && userValue) {
          setToken(tokenValue);
          setUser(JSON.parse(userValue) as User);
        }
      } catch {
        // Failed to restore session — start fresh
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    setUnauthorizedCallback(() => {
      logout();
    });
  }, [logout]);

  const login = async (email: string, password: string): Promise<void> => {
    const { user: loggedInUser, token: authToken } = await apiLogin(email, password);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, authToken],
      [USER_KEY, JSON.stringify(loggedInUser)],
    ]);
    setToken(authToken);
    setUser(loggedInUser);
  };

  const register = async (email: string, password: string): Promise<void> => {
    const { user: newUser, token: authToken } = await apiRegister(email, password);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, authToken],
      [USER_KEY, JSON.stringify(newUser)],
    ]);
    setToken(authToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
