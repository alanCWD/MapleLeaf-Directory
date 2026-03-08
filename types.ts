
export enum Province {
  AB = "Alberta",
  BC = "British Columbia",
  MB = "Manitoba",
  NB = "New Brunswick",
  NL = "Newfoundland and Labrador",
  NS = "Nova Scotia",
  NT = "Northwest Territories",
  NU = "Nunavut",
  ON = "Ontario",
  PE = "Prince Edward Island",
  QC = "Quebec",
  SK = "Saskatchewan",
  YT = "Yukon"
}

export type StoreType = 'Sovereign' | 'Local Gem';

export type VerificationStatus = 'verified' | 'ai_suggested' | 'historically_closed' | 'rejected';

export interface EvidenceSource {
  type: 'google_maps' | 'google_places' | 'news_article' | 'directory' | 'community_report' | 'indigenous_directory' | 'user_submission' | 'web_search';
  name: string;
  url?: string;
  date?: string;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface OperatingHours {
  day: string;
  time: string;
}

export interface Store {
  id: string;
  name: string;
  type: StoreType;
  province: Province;
  address: string;
  rating?: number;
  featuredOfferings?: string[];
  isClaimed: boolean;
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  sourceUrl?: string;
  reviews?: Review[];
  hours?: OperatingHours[];

  verificationStatus: VerificationStatus;
  confidenceScore: number;
  evidenceSources: EvidenceSource[];
  evidenceCount: number;
  flagCount: number;
  adminReviewed: boolean;
  adminNotes?: string;

  lat?: number;
  lng?: number;
  placesApiMatch: boolean;
  placesCategory?: string;

  lastVerifiedAt?: string;

  storeInsights?: {
    atmosphere?: string;
    community?: string;
    specialties?: string;
    sovereignty?: string;
    proTip?: string;
  } | null;
}

export type FlagReason = 'does_not_exist' | 'wrong_location' | 'permanently_closed' | 'duplicate' | 'other';

export interface StoreFlag {
  id: number;
  storeId: string;
  reason: FlagReason;
  comment?: string;
  createdAt: string;
}

export interface UserProfile {
  email?: string;
  preferences?: {
    priority?: string;
    vibe?: string;
    method?: string;
  };
  lastSeenProvince?: Province;
}

export interface ServicePackage {
  id: string;
  title: string;
  description: string;
  category: 'Digital' | 'Logistics' | 'Growth';
  icon: string;
}

export type MediaStatus = 'uploading' | 'processing' | 'encoding' | 'ready' | 'failed';
export type MediaType = 'video' | 'walkthrough' | 'review';

export interface StoreMedia {
  id: number;
  storeId: string;
  userId: string | null;
  bunnyVideoId: string;
  bunnyLibraryId: string;
  title: string;
  description: string | null;
  status: MediaStatus;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  mediaType: MediaType;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadCredentials {
  videoId: string;
  libraryId: string;
  expirationTime: number;
  signature: string;
  mediaId: number;
  embedUrl: string;
}
