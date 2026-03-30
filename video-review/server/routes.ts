import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../server/db.ts';
import { deleteReviewsByMediaId } from '../../server/integrity/models.ts';
import {
  BunnyApiError,
  createVideo,
  deleteVideo,
  downloadVideo,
  generateTusCredentials,
  getEmbedUrl,
  getThumbnailUrl,
  isStreamConfigured,
  uploadVideoBuffer,
} from './bunnyStream.ts';
import { createJobDir, stitchClips, uploadStitchedVideo, cleanupJobDir } from './videoStitcher.ts';
import { createVideoReviewMediaService } from './media.ts';
import { applyBranding, ensureBrandingAssets } from './branding.ts';
import type { VideoReviewAdapter } from '../adapter.ts';
import type { RecorderQuestion, BrandingConfig } from '../types.ts';

/**
 * Tracks video IDs that have already had branding baked in via the
 * webhook post-processing path (single TUS uploads). The second Bunny
 * webhook that fires after we re-upload the branded video is safely
 * skipped when the ID appears in this set.
 */
const brandedVideoIds = new Set<string>();
// Branding queue — only one FFmpeg job runs at a time (CPU-limited containers).
// When a job is already running the next video's Bunny ID is pushed here and
// automatically dequeued when the current job finishes.
let currentBrandingVideoId: string | null = null;
const brandingQueue: string[] = [];


const ALLOWED_VIDEO_MIMES = [
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'application/octet-stream',
];

/**
 * createVideoReviewRouter — factory that returns a fully-wired Express Router
 * containing all video-review API routes.
 *
 * Mount this on your main router:
 *   mainRouter.use('/', createVideoReviewRouter(adapter));
 */
export function createVideoReviewRouter(adapter: VideoReviewAdapter): Router {
  const isAuthenticated = adapter.requireAuth();
  const requireAdmin = adapter.requireAdminAccess();

  const paramId = (params: any): string => String(params.id);

  const mediaService = createVideoReviewMediaService(adapter);

  // Eagerly generate placeholder branding assets at router creation (server start)
  // so they are ready before the first video is processed.
  const brandingConfig = adapter.getBrandingConfig?.();
  if (!brandingConfig) {
    console.log('[VideoReview:branding] Adapter returned no branding config — branding disabled for this adapter.');
  } else {
    ensureBrandingAssets(brandingConfig)
      .then((assets) => {
        if (!brandingConfig.generatePlaceholders) {
          // For custom adapters (no placeholder generation), warn about any
          // missing asset files so operators know they need to supply them.
          if (!assets.introExists && brandingConfig.introVideoPath) {
            console.warn(`[VideoReview:branding] Startup: introVideoPath not found: ${brandingConfig.introVideoPath}`);
          }
          if (!assets.outroExists && brandingConfig.outroVideoPath) {
            console.warn(`[VideoReview:branding] Startup: outroVideoPath not found: ${brandingConfig.outroVideoPath}`);
          }
          if (!assets.watermarkExists && brandingConfig.watermarkImagePath) {
            console.warn(`[VideoReview:branding] Startup: watermarkImagePath not found: ${brandingConfig.watermarkImagePath}`);
          }
        }
      })
      .catch((err: any) => {
        console.warn('[VideoReview:branding] Startup asset check failed:', err.message);
      });
  }

  const clipUpload = multer({
    dest: '/tmp/video-stitch/uploads',
    limits: { fileSize: 200 * 1024 * 1024 },
  });

  const requireStream: RequestHandler = (_req, res, next) => {
    if (!mediaService.isBunnyConfigured()) {
      res.status(503).json({ error: 'Video service not configured' });
      return;
    }
    next();
  };

  const router = Router();

  router.post(
    '/stores/:id/media/init',
    isAuthenticated,
    requireStream,
    async (req: any, res) => {
      try {
        const subjectId = paramId(req.params);
        const userId = adapter.extractUserId(req)!;
        const { title, mediaType } = req.body;
        if (!title || typeof title !== 'string') {
          res.status(400).json({ error: 'Title is required' });
          return;
        }
        const credentials = await mediaService.initUpload(
          subjectId,
          userId,
          title,
          mediaType || 'video'
        );
        res.json(credentials);
      } catch (error: any) {
        console.error('[VideoReview] Error initializing media upload:', error);
        res.status(500).json({ error: 'Failed to initialize upload' });
      }
    }
  );

  router.post(
    '/stores/:id/media/stitch',
    isAuthenticated,
    requireStream,
    (req: any, res: any, next: any) => {
      clipUpload.array('clips', 10)(req, res, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large. Maximum 200MB per clip.' });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many clips. Maximum 10 clips.' });
          }
          return res.status(400).json({ error: err.message || 'Upload error' });
        }
        next();
      });
    },
    async (req: any, res: any) => {
      let jobDir: string | null = null;
      try {
        const subjectId = paramId(req.params);
        const userId = adapter.extractUserId(req)!;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          res.status(400).json({ error: 'No clips provided' });
          return;
        }

        for (const file of files) {
          const baseMime = file.mimetype.split(';')[0].trim();
          if (!ALLOWED_VIDEO_MIMES.includes(baseMime) && !baseMime.startsWith('video/')) {
            res.status(400).json({
              error: `Invalid file type: ${file.mimetype}. Only video files are accepted.`,
            });
            return;
          }
        }

        let questions: { id: string; prompt: string }[] = [];
        try {
          questions = JSON.parse(req.body.questions || '[]');
        } catch {
          questions = [];
        }

        const storeName =
          req.body.storeName ||
          (await adapter.resolveSubjectName(subjectId)) ||
          'Store Review';
        const title = req.body.title || `Video Review - ${storeName}`;

        jobDir = createJobDir();

        const clipInputs = files.map((file, idx) => {
          const destPath = path.join(
            jobDir!,
            `clip_${idx}${path.extname(file.originalname) || '.webm'}`
          );
          fs.renameSync(file.path, destPath);
          const q = questions[idx];
          return {
            filePath: destPath,
            questionPrompt: q?.prompt || `Part ${idx + 1}`,
            index: idx,
          };
        });

        console.log(
          `[VideoReview:stitch] Starting job for subject ${subjectId}: ${clipInputs.length} clips`
        );

        const stitchResult = await stitchClips({
          clips: clipInputs,
          subjectName: storeName,
          transitionDuration: 0.5,
          titleCardDuration: 2.5,
        });

        // Apply branding (intro/outro + watermark) before uploading
        let uploadPath = stitchResult.outputPath;
        const brandingConfig = adapter.getBrandingConfig?.();
        if (brandingConfig && jobDir) {
          const brandedPath = path.join(jobDir, 'branded_output.mp4');
          try {
            await applyBranding(stitchResult.outputPath, brandedPath, brandingConfig, jobDir);
            uploadPath = brandedPath;
            console.log('[VideoReview:stitch] Branding applied successfully');
          } catch (brandErr: any) {
            console.warn(
              '[VideoReview:stitch] Branding failed, uploading unbranded video:',
              brandErr.message
            );
          }
        }

        const config = adapter.getStreamConfig();
        const bunnyVideo = await createVideo(title, config);

        let media: any = null;
        try {
          media = await adapter.createMedia({
            subjectId,
            userId,
            bunnyVideoId: bunnyVideo.guid,
            bunnyLibraryId: String(bunnyVideo.videoLibraryId),
            title,
            embedUrl: getEmbedUrl(bunnyVideo.guid, config),
            thumbnailUrl: getThumbnailUrl(bunnyVideo.guid, config),
            mediaType: 'review',
            status: 'processing',
          });

          await uploadStitchedVideo(uploadPath, bunnyVideo.guid, config);
        } catch (uploadErr: any) {
          console.error('[VideoReview:stitch] Upload/DB error, cleaning up asset:', uploadErr);
          // Delete the orphaned Bunny video so storage isn't wasted
          try {
            await deleteVideo(bunnyVideo.guid, config);
          } catch (delErr: any) {
            console.error('[VideoReview:stitch] Failed to delete orphaned Bunny video:', delErr);
          }
          if (media) {
            try {
              await adapter.updateMediaProcessing(bunnyVideo.guid, 'failed', {});
            } catch {}
          }
          throw uploadErr;
        } finally {
          if (jobDir) cleanupJobDir(jobDir);
          jobDir = null;
        }

        console.log(
          `[VideoReview:stitch] Complete: mediaId=${media.id}, videoId=${bunnyVideo.guid}`
        );

        res.json({
          mediaId: media.id,
          videoId: bunnyVideo.guid,
          bunnyVideoId: bunnyVideo.guid,
          embedUrl: media.embedUrl,
          thumbnailUrl: media.thumbnailUrl,
          durationSeconds: stitchResult.durationSeconds,
          fileSizeBytes: stitchResult.fileSizeBytes,
        });
      } catch (error: any) {
        if (jobDir) cleanupJobDir(jobDir);
        console.error('[VideoReview:stitch] Error:', error);
        res.status(500).json({ error: error.message || 'Video stitching failed' });
      }
    }
  );

  router.get('/stores/:id/media', async (req, res) => {
    try {
      const media = await mediaService.getSubjectMedia(paramId(req.params));
      res.json(media);
    } catch (error) {
      console.error('[VideoReview] Error fetching store media:', error);
      res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  router.get('/stores/:id/media/:mediaId', async (req: any, res) => {
    try {
      const mediaId = parseInt(req.params.mediaId);
      if (isNaN(mediaId)) {
        res.status(400).json({ error: 'Invalid media ID' });
        return;
      }
      const media = await mediaService.getSingleMedia(mediaId);
      if (!media) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }
      res.json(media);
    } catch (error) {
      console.error('[VideoReview] Error fetching media:', error);
      res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  router.delete(
    '/stores/:id/media/:mediaId',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const mediaId = parseInt(req.params.mediaId);
        if (isNaN(mediaId)) {
          res.status(400).json({ error: 'Invalid media ID' });
          return;
        }
        const userId = adapter.extractUserId(req)!;
        const isAdmin = await adapter.isAdminUser(userId);
        const media = await mediaService.getSingleMedia(mediaId);
        if (!media) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }
        if (media.subjectId !== paramId(req.params)) {
          res.status(404).json({ error: 'Media not found for this store' });
          return;
        }

        const isMediaOwner = media.userId === userId;
        let isStoreOwner = false;
        if (!isAdmin) {
          const ownedStores = await adapter.getSubjectsOwnedBy(userId);
          isStoreOwner = ownedStores.includes(paramId(req.params));
        }

        if (!isMediaOwner && !isStoreOwner && !isAdmin) {
          res.status(403).json({ error: 'Not authorized to delete this media' });
          return;
        }

        const deleted = await mediaService.removeMedia(mediaId, userId);
        if (!deleted) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }
        res.json({ success: true });
      } catch (error) {
        console.error('[VideoReview] Error deleting media:', error);
        res.status(500).json({ error: 'Failed to delete media' });
      }
    }
  );

  router.get('/stores/:id/recorder-questions', async (req: any, res) => {
    try {
      const subjectId = paramId(req.params);
      const subjectName = await adapter.resolveSubjectName(subjectId);
      if (!subjectName) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }

      const questions: RecorderQuestion[] = [
        {
          id: 'q1',
          prompt: `What brought you to ${subjectName} today?`,
          maxDurationSeconds: 30,
          isRequired: true,
        },
        {
          id: 'q2',
          prompt: 'What makes this spot special or unique?',
          maxDurationSeconds: 45,
          isRequired: true,
        },
        {
          id: 'q3',
          prompt: 'Would you recommend this place to others? Why?',
          maxDurationSeconds: 30,
          isRequired: false,
        },
      ];

      const extras = await adapter.getExtraQuestions?.(subjectId.toString()) ?? [];
      questions.push(...extras);

      res.json(questions);
    } catch (error) {
      console.error('[VideoReview] Error fetching recorder questions:', error);
      res.status(500).json({ error: 'Failed to fetch recorder questions' });
    }
  });

  router.get(
    '/admin/media/video-reviews',
    isAuthenticated,
    requireAdmin,
    async (_req, res) => {
      try {
        const reviews = await mediaService.listVideoReviews();
        res.json(reviews);
      } catch (error) {
        console.error('[VideoReview] Error fetching video reviews:', error);
        res.status(500).json({ error: 'Failed to fetch video reviews' });
      }
    }
  );

  router.post(
    '/admin/media/:id/moderate',
    isAuthenticated,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid media ID' });
          return;
        }

        const { moderationStatus, contentRating, moderationNotes } = req.body;

        const validStatuses = ['approved', 'disapproved'];
        const validRatings = ['clean', 'raw'];

        if (moderationStatus && !validStatuses.includes(moderationStatus)) {
          res.status(400).json({ error: 'moderationStatus must be approved or disapproved' });
          return;
        }
        if (contentRating && !validRatings.includes(contentRating)) {
          res.status(400).json({ error: 'contentRating must be clean or raw' });
          return;
        }

        const existing = await mediaService.getSingleMedia(id);
        if (!existing) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }
        if (existing.mediaType !== 'review') {
          res.status(400).json({
            error: 'Only video reviews can be moderated via this endpoint',
          });
          return;
        }

        const updated = await adapter.updateMediaModeration(id, {
          moderationStatus,
          contentRating,
          moderationNotes,
        });
        if (!updated) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }

        const adminId = adapter.extractUserId(req)!;
        if (adapter.logAudit) {
          await adapter.logAudit(adminId, 'media_moderate', 'store_media', String(id), {
            moderationStatus: moderationStatus ?? null,
            contentRating: contentRating ?? null,
            moderationNotes: moderationNotes ?? null,
          });
        }

        res.json(updated);
      } catch (error) {
        console.error('[VideoReview] Error moderating media:', error);
        res.status(500).json({ error: 'Failed to moderate media' });
      }
    }
  );

  router.delete(
    '/admin/media/:id',
    isAuthenticated,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid media ID' });
          return;
        }

        const existing = await mediaService.getSingleMedia(id);
        if (!existing) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }

        // Cascade: remove any integrity_reviews that reference this media so
        // they don't linger as ghost reviews on the store page.
        const cascadeCount = await deleteReviewsByMediaId(id);
        if (cascadeCount > 0) {
          console.log(`[VideoReview] Cascade-deleted ${cascadeCount} review(s) for media ${id}`);
        }

        const deleted = await adapter.deleteMedia(id);
        if (!deleted) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }

        const adminId = adapter.extractUserId(req)!;
        if (adapter.logAudit) {
          await adapter.logAudit(adminId, 'media_delete', 'store_media', String(id), {
            title: existing.title ?? null,
            storeId: existing.storeId ?? null,
            mediaType: existing.mediaType ?? null,
          });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('[VideoReview] Error deleting media:', error);
        res.status(500).json({ error: 'Failed to delete media' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Branding status — lets the client poll for progress after a video upload
  // so it can show a toast when a video is queued or branding is complete.
  // ---------------------------------------------------------------------------

  /**
   * GET /stores/:storeId/media/:mediaId/branding-status
   * Returns the branding status of a specific media record.
   * brandingStatus: 'pending_encoding' | 'queued' | 'branding' | 'done'
   */
  router.get(
    '/stores/:storeId/media/:mediaId/branding-status',
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const mediaId = parseInt(req.params.mediaId, 10);
        if (isNaN(mediaId)) {
          res.status(400).json({ error: 'Invalid mediaId' });
          return;
        }
        const result = await pool.query<{
          bunny_video_id: string;
          status: string;
          branding_applied_at: Date | null;
        }>(
          'SELECT bunny_video_id, status, branding_applied_at FROM store_media WHERE id = $1',
          [mediaId]
        );
        const row = result.rows[0];
        if (!row) {
          res.status(404).json({ error: 'Media not found' });
          return;
        }
        let brandingStatus: 'pending_encoding' | 'queued' | 'branding' | 'done';
        if (row.branding_applied_at) {
          brandingStatus = 'done';
        } else if (currentBrandingVideoId === row.bunny_video_id) {
          brandingStatus = 'branding';
        } else if (brandingQueue.includes(row.bunny_video_id)) {
          brandingStatus = 'queued';
        } else {
          brandingStatus = 'pending_encoding';
        }
        res.json({ brandingStatus, bunnyStatus: row.status });
      } catch (err: any) {
        console.error('[VideoReview] branding-status error:', err.message);
        res.status(500).json({ error: 'Internal error' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Reconciliation routes — fix videos stuck in uploading/processing status
  // when Bunny webhooks were missed (e.g. server restart, unconfigured URL).
  // ---------------------------------------------------------------------------

  /**
   * POST /admin/video-reviews/sync-status
   * Body: { bunnyVideoId: string }
   * Queries Bunny for the real status of a single video and updates our DB.
   * Also fires the branding background job if the video is now ready and
   * has not yet been branded.
   */
  router.post(
    '/admin/video-reviews/sync-status',
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        if (!mediaService.isBunnyConfigured()) {
          res.status(503).json({ error: 'Stream provider is not configured' });
          return;
        }

        const { bunnyVideoId } = req.body;
        if (!bunnyVideoId || typeof bunnyVideoId !== 'string') {
          res.status(400).json({ error: 'bunnyVideoId is required' });
          return;
        }

        let updated: Awaited<ReturnType<typeof mediaService.syncVideoStatus>>;
        try {
          updated = await mediaService.syncVideoStatus(bunnyVideoId);
        } catch (err: any) {
          if (err instanceof BunnyApiError && err.statusCode === 404) {
            res.status(404).json({ error: 'Video not found in Bunny Stream' });
            return;
          }
          throw err;
        }

        if (!updated) {
          res.status(404).json({ error: 'No local media record found for that bunnyVideoId' });
          return;
        }

        if (updated.status === 'ready') {
          maybeApplyBranding(bunnyVideoId, adapter);
        }

        res.json({ synced: true, media: updated });
      } catch (error: any) {
        console.error('[VideoReview:sync] sync-status error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  /**
   * POST /admin/video-reviews/sync-all-stuck
   * No body required.
   * Finds every media record in uploading/processing status, queries Bunny
   * for each, and updates any that are now ready. Returns a summary.
   */
  router.post(
    '/admin/video-reviews/sync-all-stuck',
    isAuthenticated,
    requireAdmin,
    async (_req: any, res: any) => {
      try {
        if (!mediaService.isBunnyConfigured()) {
          res.status(503).json({ error: 'Stream provider is not configured' });
          return;
        }

        const all = await mediaService.listVideoReviews();
        const stuck = all.filter(
          (r) => r.status === 'uploading' || r.status === 'processing'
        );

        let fixed = 0;
        let stillPending = 0;
        let failed = 0;
        const errors: Array<{ bunnyVideoId: string; error: string }> = [];

        await Promise.allSettled(
          stuck.map(async (record) => {
            try {
              const updated = await mediaService.syncVideoStatus(record.bunnyVideoId);
              if (updated === null) {
                errors.push({
                  bunnyVideoId: record.bunnyVideoId,
                  error: 'No local media record found (orphaned Bunny video?)',
                });
              } else if (updated.status === 'ready') {
                fixed++;
                maybeApplyBranding(record.bunnyVideoId, adapter);
              } else if (updated.status === 'failed') {
                failed++;
              } else {
                stillPending++;
              }
            } catch (err: any) {
              const msg =
                err instanceof BunnyApiError && err.statusCode === 404
                  ? 'Video not found in Bunny Stream'
                  : err.message;
              errors.push({ bunnyVideoId: record.bunnyVideoId, error: msg });
            }
          })
        );

        // Also trigger branding for any already-ready videos that were never
        // successfully branded (branding_applied_at IS NULL).
        const unbrandedRes = await pool.query<{ bunny_video_id: string }>(
          `SELECT bunny_video_id FROM store_media
           WHERE status = 'ready' AND branding_applied_at IS NULL AND bunny_video_id IS NOT NULL
           ORDER BY id ASC`
        );
        let brandingQueued = 0;
        for (const row of unbrandedRes.rows) {
          maybeApplyBranding(row.bunny_video_id, adapter);
          brandingQueued++;
        }
        if (brandingQueued > 0) {
          console.log(`[VideoReview:sync] Queued branding for ${brandingQueued} unbranded ready video(s)`);
        }

        console.log(
          `[VideoReview:sync] sync-all-stuck: ${fixed} fixed, ${stillPending} still pending, ${failed} failed, ${errors.length} errors, ${brandingQueued} branding queued`
        );
        res.json({ fixed, stillPending, failed, errors, brandingQueued });
      } catch (error: any) {
        console.error('[VideoReview:sync] sync-all-stuck error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // POST /stores/:id/video-reviews — submit a video review for a subject
  router.post(
    '/stores/:id/video-reviews',
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const subjectId = paramId(req.params);
        const userId = adapter.extractUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        const { rating, contentText, videoAssetId, lat, lng } = req.body;
        const result = await adapter.submitVideoReview(
          subjectId,
          userId,
          { rating, contentText, videoAssetId },
          { lat, lng }
        );
        res.status(201).json(result);
      } catch (error: any) {
        console.error('[VideoReview] Error submitting video review:', error);
        const status = error.message?.includes('Rating must be') ? 400 : 500;
        res.status(status).json({ error: error.message || 'Failed to submit review' });
      }
    }
  );

  return router;
}

/**
 * mountVideoReviewWebhook — registers a Bunny.net webhook route on the given
 * Express app instance. Call this in server/index.ts after the app is created.
 *
 * For single TUS uploads, when Bunny signals a video is ready, this handler
 * transparently downloads the video, applies branding, and re-uploads it.
 * The second webhook Bunny fires after re-upload is safely skipped via the
 * module-level `brandedVideoIds` set.
 */
export function mountVideoReviewWebhook(
  app: any,
  adapter: VideoReviewAdapter,
  webhookPath = '/webhooks/bunny'
): void {
  const mediaService = createVideoReviewMediaService(adapter);

  app.post(webhookPath, async (req: any, res: any) => {
    try {
      const result = await mediaService.handleWebhook(req.body);
      res.json({ success: true, media: result });

      if (result?.status === 'ready') {
        maybeApplyBranding(result.bunnyVideoId, adapter);
      }
    } catch (error: any) {
      console.error('[VideoReview] Bunny webhook error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log(`[VideoReview] Bunny webhook mounted at ${webhookPath}`);

  // Startup recovery: re-queue any videos that were interrupted mid-branding
  // (e.g. server restarted while FFmpeg was running). Runs after a short delay
  // to let the rest of the server finish initializing.
  setTimeout(async () => {
    try {
      const res = await pool.query<{ bunny_video_id: string }>(
        `SELECT bunny_video_id FROM store_media
         WHERE status = 'ready' AND branding_applied_at IS NULL AND bunny_video_id IS NOT NULL
         ORDER BY id ASC`
      );
      if (res.rows.length > 0) {
        console.log(`[VideoReview:branding] Startup recovery: ${res.rows.length} unbranded video(s) queued`);
        for (const row of res.rows) {
          maybeApplyBranding(row.bunny_video_id, adapter);
        }
      }
    } catch (err: any) {
      console.warn('[VideoReview:branding] Startup recovery failed:', err.message);
    }
  }, 5000);
}

/**
 * maybeApplyBranding — fires the branding background job for a video that
 * just became ready, if the adapter has a branding config and the video has
 * not already been processed. Safe to call from both the webhook handler and
 * the reconciliation routes.
 */
function isBrandingEffectivelyDisabled(config: BrandingConfig): boolean {
  return (
    !config.introVideoPath &&
    !config.outroVideoPath &&
    !config.watermarkImagePath &&
    !config.generatePlaceholders
  );
}

function maybeApplyBranding(videoId: string, adapter: VideoReviewAdapter): void {
  const brandingConfig = adapter.getBrandingConfig?.();
  if (!brandingConfig) return;

  // Short-circuit: avoid downloading and re-uploading when branding would
  // immediately no-op (all three asset paths absent and no placeholder gen).
  if (isBrandingEffectivelyDisabled(brandingConfig)) {
    console.log(`[VideoReview:branding] Branding effectively disabled — skipping re-upload for ${videoId}`);
    return;
  }

  if (brandedVideoIds.has(videoId)) {
    brandedVideoIds.delete(videoId);
    console.log(`[VideoReview:branding] Skipping re-brand for ${videoId} (already branded)`);
    return;
  }

  // Prevent concurrent FFmpeg jobs — containers have limited CPU.
  // Push to queue so the job starts automatically when the current one finishes.
  if (currentBrandingVideoId !== null) {
    if (!brandingQueue.includes(videoId)) {
      brandingQueue.push(videoId);
      console.log(`[VideoReview:branding] Queued ${videoId.slice(0,8)} — current job: ${currentBrandingVideoId.slice(0,8)} (will start automatically when done)`);
    }
    return;
  }

  currentBrandingVideoId = videoId;
  brandedVideoIds.add(videoId);
  applyBrandingToUploadedVideo(videoId, adapter, brandingConfig)
    .catch((err: any) => {
      console.error('[VideoReview:branding] Branding failed:', err.message);
      brandedVideoIds.delete(videoId);
    })
    .finally(() => {
      currentBrandingVideoId = null;
      // Drain queue — start the next waiting video automatically.
      const next = brandingQueue.shift();
      if (next) {
        console.log(`[VideoReview:branding] Dequeuing next job: ${next.slice(0,8)}`);
        maybeApplyBranding(next, adapter);
      }
    });
}

async function applyBrandingToUploadedVideo(
  videoId: string,
  adapter: VideoReviewAdapter,
  brandingConfig: BrandingConfig
): Promise<void> {
  const short = videoId.slice(0, 8);
  const streamConfig = adapter.getStreamConfig();
  const tmpDir = fs.mkdtempSync(path.join('/tmp', `brand-${short}-`));
  const t0 = Date.now();
  try {
    const downloadPath = path.join(tmpDir, 'original.mp4');
    console.log(`[VideoReview:branding] [${short}] Step 1/4 — downloading from CDN…`);
    await downloadVideo(videoId, streamConfig, downloadPath);
    const dlSize = Math.round(fs.statSync(downloadPath).size / 1024);
    console.log(`[VideoReview:branding] [${short}] Step 1/4 — downloaded ${dlSize} KB in ${Date.now() - t0}ms`);

    const brandedPath = path.join(tmpDir, 'branded.mp4');
    console.log(`[VideoReview:branding] [${short}] Step 2-4/4 — applying branding (FFmpeg)…`);
    const t1 = Date.now();
    await applyBranding(downloadPath, brandedPath, brandingConfig, tmpDir);
    const brandSize = Math.round(fs.statSync(brandedPath).size / 1024);
    console.log(`[VideoReview:branding] [${short}] Step 2-4/4 — branding done in ${Date.now() - t1}ms, ${brandSize} KB`);

    // Bunny refuses to re-upload to a video that has already been processed.
    // Strategy: create a new video object, upload the branded file there,
    // then update our DB row to point at the new ID, and delete the old one.
    const titleRow = await pool.query<{ title: string; branding_applied_at: Date | null }>(
      'SELECT title, branding_applied_at FROM store_media WHERE bunny_video_id = $1',
      [videoId]
    );

    // Guard: if the video was already branded (e.g. server restarted between
    // re-upload and Bunny's second webhook), skip the pipeline entirely.
    if (titleRow.rows[0]?.branding_applied_at) {
      console.log(`[VideoReview:branding] [${short}] Already branded — skipping`);
      return;
    }

    const title = titleRow.rows[0]?.title || 'Branded Video';

    console.log(`[VideoReview:branding] [${short}] Creating new Bunny video for branded upload…`);
    const newVideo = await createVideo(title, streamConfig);
    const newId = newVideo.guid;
    // Pre-register the new ID so the webhook it triggers does not re-brand.
    brandedVideoIds.add(newId);

    console.log(`[VideoReview:branding] [${short}] Uploading branded video to new ID ${newId.slice(0,8)}…`);
    const t2 = Date.now();
    await uploadVideoBuffer(brandedPath, newId, streamConfig);
    console.log(`[VideoReview:branding] [${short}] Upload done in ${Date.now() - t2}ms`);

    const newEmbedUrl = getEmbedUrl(newId, streamConfig);
    const newThumbUrl = getThumbnailUrl(newId, streamConfig);
    await pool.query(
      `UPDATE store_media
       SET bunny_video_id = $1, embed_url = $2, thumbnail_url = $3, branding_applied_at = NOW()
       WHERE bunny_video_id = $4`,
      [newId, newEmbedUrl, newThumbUrl, videoId]
    );

    try {
      await deleteVideo(videoId, streamConfig);
      console.log(`[VideoReview:branding] [${short}] Deleted original video ${short}`);
    } catch (e: any) {
      console.warn(`[VideoReview:branding] [${short}] Could not delete original video (non-fatal): ${e.message}`);
    }

    console.log(`[VideoReview:branding] [${short}] ✓ Branded and re-uploaded in ${Date.now() - t0}ms total`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
