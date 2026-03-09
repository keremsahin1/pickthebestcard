import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_KEY = 'user_session';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken?: string;
}

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    iosClientId: '517026320231-5qj1rochv8lr6qj3k98q6qh2p6nahhb7.apps.googleusercontent.com',
  });
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    const user: User = {
      id: userInfo.data?.user.id ?? '',
      email: userInfo.data?.user.email ?? '',
      name: userInfo.data?.user.name ?? '',
      picture: userInfo.data?.user.photo ?? '',
      accessToken: tokens.accessToken,
    };
    await saveUser(user);
    return user;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  }
}

export async function signOutGoogle() {
  await GoogleSignin.signOut();
  await clearUser();
}

export async function saveUser(user: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<User | null> {
  const val = await AsyncStorage.getItem(USER_KEY);
  if (!val) return null;

  const user: User = JSON.parse(val);

  // Silently refresh the Google access token — stored tokens expire after ~1 hour
  // but the Google Sign-In SDK can refresh them without user interaction.
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    if (currentUser) {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken && tokens.accessToken !== user.accessToken) {
        user.accessToken = tokens.accessToken;
        await saveUser(user);
      }
    }
  } catch {
    // Token refresh failed — user will need to sign in again
  }

  return user;
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
