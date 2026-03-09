export type { StoreMedia, MediaStatus, MediaType, UploadCredentials } from '../../types';

export interface TrustWeight {
  base: number;
  videoBonus: number;
  scoutBonus: number;
  geoDeviation: number;
  final: number;
}

export interface IntegrityScoreCard {
  score: number;
  verifiedPresenceRatio: number;
  reviewStability: number;
  weightedAvgRating: number;
  contentRichness: number;
  lastAuditDate: string | null;
}

export interface ReviewSubmission {
  storeId: string;
  userId: string;
  rating: number;
  contentText: string;
  videoAssetId?: number;
  mediaType?: string;
}

export interface WeightedReview {
  id: number;
  storeId: string;
  userId: string;
  rating: number;
  contentText: string;
  videoAssetId: number | null;
  trustWeight: TrustWeight;
  hasVerifiedVideo: boolean;
  isFlagged: boolean;
  disclosures: Record<string, any> | null;
  createdAt: string;
}

export interface RecorderQuestion {
  id: string;
  prompt: string;
  maxDurationSeconds: number;
  isRequired: boolean;
}
