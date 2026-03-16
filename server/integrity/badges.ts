import { pool } from '../db';
import { awardBadge, revokeBadge, getUserBadges } from './models';
import type { UserBadge } from './models';

interface BadgeCheck {
  qualified: boolean;
  metadata: Record<string, any>;
}

interface UserStats {
  uniqueStoreReviews: number;
  distinctStores: number;
  culturePosts: number;
  regionsCount: number;
  repeatVisitCount: number;
  repeatVisitStores: number;
  qualityAverage: number;
  seasonalRevisits: number;
  timePeriodRevisits: number;
  singleStoreMaxPct: number;
}

async function getUserStats(userId: string): Promise<UserStats> {
  const reviewResult = await pool.query(
    `SELECT
       COUNT(*) as total_reviews,
       COUNT(DISTINCT store_id) as distinct_stores,
       AVG((trust_weight->>'final')::numeric) as avg_quality
     FROM integrity_reviews
     WHERE user_id = $1 AND is_flagged = false`,
    [userId]
  );

  const uniqueStoreReviews = parseInt(reviewResult.rows[0].total_reviews) || 0;
  const distinctStores = parseInt(reviewResult.rows[0].distinct_stores) || 0;
  const qualityAverage = reviewResult.rows[0].avg_quality
    ? parseFloat(reviewResult.rows[0].avg_quality)
    : 0;

  const regionResult = await pool.query(
    `SELECT COUNT(DISTINCT s.bc_region) as regions_count
     FROM integrity_reviews ir
     JOIN stores s ON s.id = ir.store_id
     WHERE ir.user_id = $1 AND s.bc_region IS NOT NULL AND is_flagged = false`,
    [userId]
  );
  const regionsCount = parseInt(regionResult.rows[0].regions_count) || 0;

  const repeatResult = await pool.query(
    `SELECT COUNT(*) as repeat_count, COUNT(DISTINCT store_id) as repeat_stores
     FROM (
       SELECT ir1.store_id
       FROM integrity_reviews ir1
       JOIN integrity_reviews ir2
         ON ir1.store_id = ir2.store_id
         AND ir1.user_id = ir2.user_id
         AND ir1.id <> ir2.id
         AND ir2.created_at > ir1.created_at + INTERVAL '30 days'
       WHERE ir1.user_id = $1 AND ir1.is_flagged = false AND ir2.is_flagged = false
       GROUP BY ir1.store_id
     ) sub`,
    [userId]
  );
  const repeatVisitCount = parseInt(repeatResult.rows[0].repeat_count) || 0;
  const repeatVisitStores = parseInt(repeatResult.rows[0].repeat_stores) || 0;

  const seasonalResult = await pool.query(
    `SELECT COUNT(DISTINCT store_id) as seasonal_stores
     FROM (
       SELECT ir1.store_id
       FROM integrity_reviews ir1
       JOIN integrity_reviews ir2
         ON ir1.store_id = ir2.store_id
         AND ir1.user_id = ir2.user_id
         AND ir1.id <> ir2.id
         AND EXTRACT(QUARTER FROM ir1.created_at) <> EXTRACT(QUARTER FROM ir2.created_at)
       WHERE ir1.user_id = $1 AND ir1.is_flagged = false AND ir2.is_flagged = false
       GROUP BY ir1.store_id
     ) sub`,
    [userId]
  );
  const seasonalRevisits = parseInt(seasonalResult.rows[0].seasonal_stores) || 0;

  const timePeriodResult = await pool.query(
    `SELECT COUNT(DISTINCT store_id) as tp_stores
     FROM (
       SELECT ir1.store_id, COUNT(DISTINCT DATE_TRUNC('month', ir1.created_at)) as month_count
       FROM integrity_reviews ir1
       WHERE ir1.user_id = $1 AND ir1.is_flagged = false
       GROUP BY ir1.store_id
       HAVING COUNT(DISTINCT DATE_TRUNC('month', ir1.created_at)) >= 3
     ) sub`,
    [userId]
  );
  const timePeriodRevisits = parseInt(timePeriodResult.rows[0].tp_stores) || 0;

  const maxPctResult = await pool.query(
    `SELECT CASE WHEN COUNT(*) = 0 THEN 0
            ELSE MAX(store_count::numeric / COUNT(*) OVER ())
            END as max_pct
     FROM (
       SELECT store_id, COUNT(*) as store_count
       FROM integrity_reviews
       WHERE user_id = $1 AND is_flagged = false
       GROUP BY store_id
     ) sub`,
    [userId]
  );
  const singleStoreMaxPct = maxPctResult.rows[0].max_pct
    ? parseFloat(maxPctResult.rows[0].max_pct)
    : 0;

  let culturePosts = 0;
  try {
    const cultureResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM store_media WHERE user_id = $1`,
      [userId]
    );
    culturePosts = parseInt(cultureResult.rows[0].cnt) || 0;
  } catch {}

  return {
    uniqueStoreReviews,
    distinctStores,
    culturePosts,
    regionsCount,
    repeatVisitCount,
    repeatVisitStores,
    qualityAverage,
    seasonalRevisits,
    timePeriodRevisits,
    singleStoreMaxPct,
  };
}

export async function checkExplorer(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified = stats.uniqueStoreReviews >= 1 && stats.culturePosts >= 1;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      culturePosts: stats.culturePosts,
    },
  };
}

export async function checkLocalScout(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 5 &&
    stats.distinctStores >= 3 &&
    stats.culturePosts >= 3 &&
    stats.qualityAverage >= 0.9;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      culturePosts: stats.culturePosts,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
    },
  };
}

export async function checkRegionalBuilder(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 12 &&
    stats.distinctStores >= 8 &&
    stats.culturePosts >= 8 &&
    stats.repeatVisitStores >= 2 &&
    stats.qualityAverage >= 1.0;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      culturePosts: stats.culturePosts,
      repeatVisitStores: stats.repeatVisitStores,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
    },
  };
}

export async function checkCrossRegionContributor(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 18 &&
    stats.distinctStores >= 12 &&
    stats.regionsCount >= 2 &&
    stats.culturePosts >= 15 &&
    stats.repeatVisitCount >= 3 &&
    stats.repeatVisitStores >= 3 &&
    stats.qualityAverage >= 1.05;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      regionsCount: stats.regionsCount,
      culturePosts: stats.culturePosts,
      repeatVisitStores: stats.repeatVisitStores,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
    },
  };
}

export async function checkProvincialConnector(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 30 &&
    stats.distinctStores >= 20 &&
    stats.regionsCount >= 3 &&
    stats.culturePosts >= 25 &&
    stats.repeatVisitCount >= 5 &&
    stats.repeatVisitStores >= 5 &&
    stats.qualityAverage >= 1.1 &&
    stats.singleStoreMaxPct <= 0.2;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      regionsCount: stats.regionsCount,
      culturePosts: stats.culturePosts,
      repeatVisitStores: stats.repeatVisitStores,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
      singleStoreMaxPct: Math.round(stats.singleStoreMaxPct * 100),
    },
  };
}

export async function checkBcCultureGuide(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 45 &&
    stats.distinctStores >= 30 &&
    stats.regionsCount >= 4 &&
    stats.culturePosts >= 40 &&
    stats.repeatVisitCount >= 8 &&
    stats.repeatVisitStores >= 8 &&
    stats.seasonalRevisits >= 3 &&
    stats.qualityAverage >= 1.15 &&
    stats.singleStoreMaxPct <= 0.15;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      regionsCount: stats.regionsCount,
      culturePosts: stats.culturePosts,
      repeatVisitStores: stats.repeatVisitStores,
      seasonalRevisits: stats.seasonalRevisits,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
      singleStoreMaxPct: Math.round(stats.singleStoreMaxPct * 100),
    },
  };
}

export async function checkFoundingBcArchitect(userId: string, stats: UserStats): Promise<BadgeCheck> {
  const qualified =
    stats.uniqueStoreReviews >= 60 &&
    stats.distinctStores >= 40 &&
    stats.regionsCount >= 5 &&
    stats.culturePosts >= 60 &&
    stats.repeatVisitCount >= 12 &&
    stats.repeatVisitStores >= 10 &&
    stats.timePeriodRevisits >= 1 &&
    stats.qualityAverage >= 1.2 &&
    stats.singleStoreMaxPct <= 0.12;
  return {
    qualified,
    metadata: {
      storeReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      regionsCount: stats.regionsCount,
      culturePosts: stats.culturePosts,
      repeatVisitStores: stats.repeatVisitStores,
      timePeriodRevisits: stats.timePeriodRevisits,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
      singleStoreMaxPct: Math.round(stats.singleStoreMaxPct * 100),
    },
  };
}

export async function evaluateUserBadges(userId: string): Promise<UserBadge[]> {
  const stats = await getUserStats(userId);

  const checks: { badgeType: string; check: (u: string, s: UserStats) => Promise<BadgeCheck> }[] = [
    { badgeType: 'explorer', check: checkExplorer },
    { badgeType: 'local_scout', check: checkLocalScout },
    { badgeType: 'regional_builder', check: checkRegionalBuilder },
    { badgeType: 'cross_region_contributor', check: checkCrossRegionContributor },
    { badgeType: 'provincial_connector', check: checkProvincialConnector },
    { badgeType: 'bc_culture_guide', check: checkBcCultureGuide },
    { badgeType: 'founding_bc_architect', check: checkFoundingBcArchitect },
  ];

  for (const { badgeType, check } of checks) {
    const result = await check(userId, stats);
    if (result.qualified) {
      await awardBadge(userId, badgeType, result.metadata);
    } else {
      await revokeBadge(userId, badgeType);
    }
  }

  return getUserBadges(userId);
}

export { getUserStats };
