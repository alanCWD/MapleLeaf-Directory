import { pool } from '../db';
import { awardBadge, revokeBadge, getUserBadges } from './models';
import type { UserBadge } from './models';

interface BadgeCheck {
  qualified: boolean;
  metadata: Record<string, any>;
}

export async function checkVerifiedScout(userId: string): Promise<BadgeCheck> {
  const result = await pool.query(
    `SELECT COUNT(*) as review_count, COUNT(DISTINCT store_id) as store_count
     FROM integrity_reviews
     WHERE user_id = $1 AND has_verified_video = true`,
    [userId]
  );
  const reviewCount = parseInt(result.rows[0].review_count);
  const storeCount = parseInt(result.rows[0].store_count);

  return {
    qualified: reviewCount >= 3 && storeCount >= 2,
    metadata: { videoReviewCount: reviewCount, distinctStores: storeCount },
  };
}

export async function checkLegacyArchivist(userId: string): Promise<BadgeCheck> {
  const reviewResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM integrity_reviews WHERE user_id = $1`,
    [userId]
  );
  const reviewCount = parseInt(reviewResult.rows[0].cnt);

  const submissionResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM store_claims WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  const submissionCount = parseInt(submissionResult.rows[0].cnt);

  const mediaResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM store_media WHERE user_id = $1`,
    [userId]
  );
  const mediaCount = parseInt(mediaResult.rows[0].cnt);

  return {
    qualified: reviewCount >= 10 || submissionCount >= 5 || mediaCount >= 3,
    metadata: { reviewCount, communitySubmissions: submissionCount, mediaUploads: mediaCount },
  };
}

export async function checkIntegrityAnchor(userId: string): Promise<BadgeCheck> {
  const result = await pool.query(
    `SELECT COUNT(*) as review_count,
            AVG((trust_weight->>'final')::numeric) as avg_trust,
            SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END) as flagged_count
     FROM integrity_reviews
     WHERE user_id = $1`,
    [userId]
  );
  const reviewCount = parseInt(result.rows[0].review_count);
  const avgTrust = result.rows[0].avg_trust ? parseFloat(result.rows[0].avg_trust) : 0;
  const flaggedCount = parseInt(result.rows[0].flagged_count);

  return {
    qualified: reviewCount >= 8 && avgTrust >= 0.7 && flaggedCount === 0,
    metadata: {
      reviewCount,
      avgTrustWeight: Math.round(avgTrust * 1000) / 1000,
      flaggedCount,
    },
  };
}

export async function evaluateUserBadges(userId: string): Promise<UserBadge[]> {
  const checks: { badgeType: string; check: Promise<BadgeCheck> }[] = [
    { badgeType: 'verified_scout', check: checkVerifiedScout(userId) },
    { badgeType: 'legacy_archivist', check: checkLegacyArchivist(userId) },
    { badgeType: 'integrity_anchor', check: checkIntegrityAnchor(userId) },
  ];

  for (const { badgeType, check } of checks) {
    const result = await check;
    if (result.qualified) {
      await awardBadge(userId, badgeType, result.metadata);
    } else {
      await revokeBadge(userId, badgeType);
    }
  }

  return getUserBadges(userId);
}
