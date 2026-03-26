
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
  distanceKm?: number;
  placesApiMatch: boolean;
  placesCategory?: string;

  headerImageUrl?: string;
  storePhotos?: string[];
  lastVerifiedAt?: string;
  updatedAt?: string;

  customDomain?: string;
  domainVerified?: boolean;
  themeConfig?: {
    brandColor?: string;
    accentColor?: string;
    logoUrl?: string;
    tagline?: string;
    subHeadline?: string;
    fontPairing?: 'system' | 'modern' | 'classic' | 'playful' | 'elegant';
    sections?: {
      showHours?: boolean;
      showGallery?: boolean;
      showPosts?: boolean;
      showContact?: boolean;
    };
  } | null;

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

export type ContentTier = 'clean' | 'raw';
export type PostStatus = 'draft' | 'pending_moderation' | 'published' | 'rejected';

export type BadgeType = 'explorer' | 'local_scout' | 'regional_builder' | 'cross_region_contributor' | 'provincial_connector' | 'bc_culture_guide' | 'founding_bc_architect';

export interface CreatorPost {
  id: number;
  userId: string;
  storeId: string | null;
  title: string;
  subtitle: string | null;
  bodyText: string | null;
  contentTier: ContentTier;
  status: PostStatus;
  moderationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorHandle?: string | null;
  authorImageUrl?: string;
  authorBadge?: string | null;
  storeName?: string;
  media?: PostMedia[];
}

export interface PostMedia {
  id: number;
  postId: number;
  mediaType: 'image' | 'video';
  bunnyId: string | null;
  cdnUrl: string;
  thumbnailUrl?: string | null;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
}
