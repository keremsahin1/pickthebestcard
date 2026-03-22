import { requestForegroundPermissionsAsync, getCurrentPositionAsync } from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Mirrors the logic in handleMerchantFocus
async function fetchNearbyIfAllowed(): Promise<{ coords: { latitude: number; longitude: number } } | null> {
  const { status } = await requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return getCurrentPositionAsync({});
}

describe('location permission handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not call getCurrentPositionAsync when permission denied', async () => {
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const result = await fetchNearbyIfAllowed();

    expect(result).toBeNull();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('calls getCurrentPositionAsync when permission granted', async () => {
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 37.7749, longitude: -122.4194 },
    });

    const result = await fetchNearbyIfAllowed();

    expect(result).not.toBeNull();
    expect(result?.coords.latitude).toBe(37.7749);
    expect(getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });
});
