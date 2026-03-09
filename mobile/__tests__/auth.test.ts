import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { loadUser, saveUser, USER_KEY } from '../lib/auth';
import type { User } from '../lib/auth';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    getCurrentUser: jest.fn(),
    getTokens: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPlayServices: jest.fn(),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/photo.jpg',
  accessToken: 'stale-token',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadUser — token refresh on cold start', () => {
  it('returns null when no user is stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const user = await loadUser();
    expect(user).toBeNull();
    expect(GoogleSignin.getCurrentUser).not.toHaveBeenCalled();
  });

  it('refreshes stale token when Google session is active', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
    (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue({ user: { id: '123' } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: 'fresh-token' });

    const user = await loadUser();

    expect(user!.accessToken).toBe('fresh-token');
    // Should persist the refreshed token
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      USER_KEY,
      expect.stringContaining('fresh-token'),
    );
  });

  it('keeps existing token when Google returns same token', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
    (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue({ user: { id: '123' } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: 'stale-token' });

    const user = await loadUser();

    expect(user!.accessToken).toBe('stale-token');
    // Should NOT re-save if token unchanged
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns user with stale token when Google session is gone', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
    (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue(null);

    const user = await loadUser();

    expect(user!.accessToken).toBe('stale-token');
    expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
  });

  it('returns user even if token refresh throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
    (GoogleSignin.getCurrentUser as jest.Mock).mockRejectedValue(new Error('SDK error'));

    const user = await loadUser();

    expect(user).not.toBeNull();
    expect(user!.accessToken).toBe('stale-token');
  });
});
