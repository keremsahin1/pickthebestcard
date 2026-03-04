import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

export const USER_KEY = 'user_session';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export async function fetchGoogleUser(accessToken: string): Promise<User> {
  const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function saveUser(user: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<User | null> {
  const val = await AsyncStorage.getItem(USER_KEY);
  return val ? JSON.parse(val) : null;
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
