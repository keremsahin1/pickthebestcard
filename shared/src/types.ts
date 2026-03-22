export interface Card {
  id: number;
  name: string;
  issuer: string;
  color: string;
  rewardType: string;
  baseRate: number;
  pointsValue?: number;
  benefitsUrl?: string | null;
}

export interface Recommendation {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  rate: number;
  effectiveRate: number;
  benefitType: string;
  rewardType: string;
  category: string | null;
  notes: string | null;
  spendCap: number | null;
  capPeriod: string | null;
  requiresActivation: boolean;
  validUntil: string | null;
  isRotating: boolean;
  baseRate: number;
  benefitsUrl: string | null;
}

export interface Protection {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  protectionType: 'car_rental_insurance' | 'extended_warranty';
  coverageDetails: string;
  coverageTier: 'primary' | 'secondary' | 'unknown';
  notes: string | null;
  benefitsUrl: string | null;
}

export interface MerchantMatch {
  merchantId: number | null;
  merchantName: string;
  categoryId: number | null;
  categoryName: string | null;
  isOnline: boolean;
}

export type MerchantTag = 'car_rental' | 'extended_warranty_eligible';

export interface Merchant {
  id: number;
  name: string;
  domain: string;
  category_name: string;
  category_icon: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface NearbyPlace {
  name: string;
  merchantId: number | null;
  categoryId: number | null;
  placeId: string;
}
