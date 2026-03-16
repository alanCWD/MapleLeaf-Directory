export { calculateTrustWeight, calculateIntegrityScore, assessReviewStability, calculateContentRichness } from './scoring';

export {
  ensureIntegrityTables,
  createStoreMedia,
  getStoreMedia,
  getMediaById,
  updateMediaStatus,
  deleteStoreMedia,
  createReview,
  getReviewsByStore,
  getReviewsByUser,
  flagReview,
  awardBadge,
  revokeBadge,
  getUserBadges,
  getUsersWithBadge,
  getReviewsWithBadges,
} from './models';

export type { UserBadge } from './models';

export {
  evaluateUserBadges,
  checkExplorer,
  checkLocalScout,
  checkRegionalBuilder,
  checkCrossRegionContributor,
  checkProvincialConnector,
  checkBcCultureGuide,
  checkFoundingBcArchitect,
  getUserStats,
} from './badges';

export { initUpload, handleWebhook, removeMedia, getStoreMediaList, getSingleMedia, isBunnyConfigured } from './media';

export {
  generateQRSecret,
  getCurrentQRPayload,
  validateQRCode,
  calculateDistance,
  verifyPresence,
  getStoreCheckins,
  getUserCheckins,
  hasRecentCheckin,
} from './presence';

export type {
  BadgeType,
  UserBadge as UserBadgeType,
  TrustWeight,
  IntegrityScoreCard,
  ReviewSubmission,
  WeightedReview,
  RecorderQuestion,
  StoreMedia,
  MediaStatus,
  MediaType,
  UploadCredentials,
} from './types';

export async function initIntegrityEngine(): Promise<void> {
  const { ensureIntegrityTables } = await import('./models');
  console.log('[IntegrityEngine] Initializing...');
  await ensureIntegrityTables();
  console.log('[IntegrityEngine] Tables ensured (store_media, integrity_reviews, user_badges, presence_qr_codes, presence_checkins)');

  const { isBunnyConfigured } = await import('../bunnyStream');
  if (isBunnyConfigured()) {
    console.log('[IntegrityEngine] Bunny Stream configured ✓');
  } else {
    console.log('[IntegrityEngine] Bunny Stream NOT configured — video uploads disabled');
  }

  console.log('[IntegrityEngine] Ready');
}
