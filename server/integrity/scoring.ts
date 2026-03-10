import type { TrustWeight, IntegrityScoreCard, WeightedReview } from './types';

export function calculateTrustWeight(params: {
  hasVerifiedVideo: boolean;
  isScout?: boolean;
  geoDeviationDetected?: boolean;
  hasVerifiedPresence?: boolean;
}): TrustWeight {
  const base = 0.5;
  const videoBonus = params.hasVerifiedVideo ? 0.2 : 0;
  const scoutBonus = params.isScout ? 0.3 : 0;
  const geoDeviation = params.geoDeviationDetected ? -0.4 : 0;
  const presenceBonus = params.hasVerifiedPresence ? 0.15 : 0;

  const raw = base + videoBonus + scoutBonus + geoDeviation + presenceBonus;
  const final = Math.max(0, Math.min(1, raw));

  return { base, videoBonus, scoutBonus, geoDeviation, presenceBonus, final };
}

export function calculateIntegrityScore(reviews: WeightedReview[]): IntegrityScoreCard {
  if (reviews.length === 0) {
    return {
      score: 0,
      verifiedPresenceRatio: 0,
      reviewStability: 1,
      weightedAvgRating: 0,
      contentRichness: 0,
      lastAuditDate: null,
    };
  }

  const nonFlagged = reviews.filter((r) => !r.isFlagged);

  if (nonFlagged.length === 0) {
    return {
      score: 0,
      verifiedPresenceRatio: 0,
      reviewStability: 0,
      weightedAvgRating: 0,
      contentRichness: 0,
      lastAuditDate: null,
    };
  }

  const weightedSum = nonFlagged.reduce(
    (sum, r) => sum + r.rating * r.trustWeight.final,
    0
  );
  const weightTotal = nonFlagged.reduce(
    (sum, r) => sum + r.trustWeight.final,
    0
  );
  const weightedAvgRating = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const verifiedPresenceRatio = assessVerifiedPresence(nonFlagged);
  const reviewStability = assessReviewStability(nonFlagged);
  const contentRichness = calculateContentRichness(nonFlagged);

  const normalizedRating = (weightedAvgRating - 1) / 4;
  const score =
    (normalizedRating * 0.4 +
    verifiedPresenceRatio * 0.2 +
    reviewStability * 0.2 +
    contentRichness * 0.2) * 10;

  const clampedScore = Math.max(0, Math.min(10, Math.round(score * 100) / 100));

  const sortedDates = nonFlagged
    .map((r) => r.createdAt)
    .sort()
    .reverse();

  return {
    score: clampedScore,
    verifiedPresenceRatio,
    reviewStability,
    weightedAvgRating: Math.round(weightedAvgRating * 100) / 100,
    contentRichness,
    lastAuditDate: sortedDates[0] || null,
  };
}

function assessVerifiedPresence(reviews: WeightedReview[]): number {
  if (reviews.length === 0) return 0;
  const verified = reviews.filter((r) => r.hasVerifiedVideo).length;
  return Math.round((verified / reviews.length) * 100) / 100;
}

export function assessReviewStability(reviews: WeightedReview[]): number {
  if (reviews.length < 2) return 1;

  const sorted = [...reviews].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const ratings = sorted.map((r) => r.rating);
  const mean = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  const variance =
    ratings.reduce((s, r) => s + (r - mean) ** 2, 0) / ratings.length;
  const stdDev = Math.sqrt(variance);

  const normalizedStability = Math.max(0, 1 - stdDev / 2);

  const now = Date.now();
  const oneDay = 86400000;
  const recentWindow = 7 * oneDay;
  const recentReviews = sorted.filter(
    (r) => now - new Date(r.createdAt).getTime() < recentWindow
  );

  let burstPenalty = 0;
  if (recentReviews.length > reviews.length * 0.5 && reviews.length >= 4) {
    burstPenalty = 0.3;
  }

  return Math.round(Math.max(0, Math.min(1, normalizedStability - burstPenalty)) * 100) / 100;
}

export function calculateContentRichness(reviews: WeightedReview[]): number {
  if (reviews.length === 0) return 0;

  let richCount = 0;
  for (const review of reviews) {
    if (review.hasVerifiedVideo) {
      richCount++;
    } else if (review.contentText && review.contentText.length > 100) {
      richCount += 0.5;
    }
  }

  return Math.round(Math.min(1, richCount / reviews.length) * 100) / 100;
}
