export type FontPairing = 'system' | 'modern' | 'classic' | 'playful' | 'elegant';

export interface MicrositeSection {
  showHours?: boolean;
  showGallery?: boolean;
  showPosts?: boolean;
  showContact?: boolean;
}

export interface MicrositeTheme {
  brandColor?: string;
  accentColor?: string;
  logoUrl?: string;
  tagline?: string;
  subHeadline?: string;
  fontPairing?: FontPairing;
  sections?: MicrositeSection;
}

export type MicrositeStatus = 'active' | 'trialing' | 'inactive';

export interface MicrositeConfig {
  tenantId: string;
  name: string;
  type?: string;
  address?: string;
  province?: string;
  phone?: string;
  website?: string;
  rating?: number;
  hours?: Array<{ day: string; time: string }>;
  featuredOfferings?: string[];
  headerImageUrl?: string;
  storePhotos?: string[];
  themeConfig?: MicrositeTheme | null;
  customDomain?: string;
  domainVerified?: boolean;
  planStatus: MicrositeStatus;
  planExpiresAt?: string | null;
  stripeCustomerId?: string | null;
  isClaimed?: boolean;
  verificationStatus?: string;
  storeInsights?: {
    atmosphere?: string;
    community?: string;
    specialties?: string;
    sovereignty?: string;
    proTip?: string;
  } | null;
}
