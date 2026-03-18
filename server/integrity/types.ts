export type { StoreMedia, MediaStatus, MediaType, UploadCredentials } from '../../types';

export type BadgeType =
  | 'explorer'
  | 'local_scout'
  | 'regional_builder'
  | 'cross_region_contributor'
  | 'provincial_connector'
  | 'bc_culture_guide'
  | 'founding_bc_architect';

export interface UserBadge {
  id: number;
  userId: string;
  badgeType: BadgeType;
  awardedAt: string;
  metadata: Record<string, any> | null;
}

export interface TrustWeight {
  base: number;
  videoBonus: number;
  scoutBonus: number;
  geoDeviation: number;
  presenceBonus: number;
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
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  contentRating?: string | null;
  moderationStatus?: string | null;
}

export interface RecorderQuestion {
  id: string;
  prompt: string;
  maxDurationSeconds: number;
  isRequired: boolean;
}
