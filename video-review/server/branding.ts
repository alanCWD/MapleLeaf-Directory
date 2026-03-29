/**
 * video-review/server/branding.ts
 *
 * Self-contained branding engine: generates placeholder intro/outro clips
 * and a watermark using FFmpeg, then bakes them into processed video reviews.
 *
 * Placeholder assets are generated automatically on first use and stored in
 * `video-review/assets/branding/` (or the adapter-configured `assetsDir`).
 * Swap them out by pointing `BrandingConfig` at different file paths —
 * no code changes required to use a different niche.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { BrandingConfig } from '../types.ts';

export type { BrandingConfig };

const BRANDING_RES = '1280x720';
const BRANDING_FPS = 30;
const BRANDING_INTRO_DUR = 4;
const BRANDING_OUTRO_DUR = 4;

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg (branding) exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on('error', reject);
  });
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%');
}

function resolveAssets(config: BrandingConfig): {
  assetsDir: string;
  introPath: string;
  outroPath: string;
  watermarkPath: string;
} {
  const assetsDir =
    config.assetsDir ||
    path.resolve(process.cwd(), 'video-review', 'assets', 'branding');

  return {
    assetsDir,
    introPath: config.introVideoPath || path.join(assetsDir, 'intro.mp4'),
    outroPath: config.outroVideoPath || path.join(assetsDir, 'outro.mp4'),
    watermarkPath: config.watermarkImagePath || path.join(assetsDir, 'watermark.png'),
  };
}

async function generateIntroVideo(
  outputPath: string,
  config: BrandingConfig
): Promise<void> {
  const dur = config.introDurationSeconds ?? BRANDING_INTRO_DUR;
  const bgColor = `0x${(config.bgColor || '1a2e1a')}`;
  const brandColor = `0x${(config.brandColor || 'c8a84b')}`;
  const brandName = escapeDrawtext(config.brandName || 'LegacyLeaf');
  const tagline = escapeDrawtext(config.tagline || 'Authentic Cannabis Reviews');
  const fadeOut = (dur - 0.5).toFixed(2);

  const vf = [
    `drawtext=text='${brandName}':fontsize=72:fontcolor=${brandColor}:x=(w-text_w)/2:y=(h-text_h)/2-44:shadowcolor=black@0.5:shadowx=3:shadowy=3`,
    `drawtext=text='${tagline}':fontsize=32:fontcolor=white@0.85:x=(w-text_w)/2:y=(h-text_h)/2+52:shadowcolor=black@0.4:shadowx=2:shadowy=2`,
    `fade=t=in:st=0:d=0.5`,
    `fade=t=out:st=${fadeOut}:d=0.5`,
  ].join(',');

  await runFFmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${BRANDING_RES}:d=${dur}:r=${BRANDING_FPS}`,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', String(dur),
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest', outputPath,
  ]);
}

async function generateOutroVideo(
  outputPath: string,
  config: BrandingConfig
): Promise<void> {
  const dur = config.outroDurationSeconds ?? BRANDING_OUTRO_DUR;
  const bgColor = `0x${(config.bgColor || '1a2e1a')}`;
  const brandColor = `0x${(config.brandColor || 'c8a84b')}`;
  const brandName = escapeDrawtext(config.brandName || 'LegacyLeaf');
  const outroLine = escapeDrawtext('Thank you for your review');
  const fadeOut = (dur - 0.5).toFixed(2);

  const vf = [
    `drawtext=text='${outroLine}':fontsize=40:fontcolor=white@0.9:x=(w-text_w)/2:y=(h-text_h)/2-30:shadowcolor=black@0.4:shadowx=2:shadowy=2`,
    `drawtext=text='${brandName}':fontsize=52:fontcolor=${brandColor}:x=(w-text_w)/2:y=(h-text_h)/2+44:shadowcolor=black@0.5:shadowx=2:shadowy=2`,
    `fade=t=in:st=0:d=0.5`,
    `fade=t=out:st=${fadeOut}:d=0.5`,
  ].join(',');

  await runFFmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${BRANDING_RES}:d=${dur}:r=${BRANDING_FPS}`,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', String(dur),
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest', outputPath,
  ]);
}

async function generateWatermarkPng(
  outputPath: string,
  config: BrandingConfig
): Promise<void> {
  const bgColor = config.bgColor || '1a2e1a';
  const brandColor = `0x${(config.brandColor || 'c8a84b')}`;
  const text = escapeDrawtext(config.watermarkText || config.brandName || 'LegacyLeaf');

  await runFFmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x${bgColor}:s=260x56:r=1`,
    '-vf', `drawtext=text='${text}':fontsize=24:fontcolor=${brandColor}:x=(w-text_w)/2:y=(h-text_h)/2`,
    '-frames:v', '1',
    outputPath,
  ]);
}

const assetGenLocks = new Map<string, Promise<void>>();

/**
 * Ensure all branding assets exist in `assetsDir`, generating them via
 * FFmpeg if they are missing. Safe to call concurrently — generation of
 * the same directory is serialised via an in-process lock.
 */
export async function ensureBrandingAssets(config: BrandingConfig): Promise<{
  introPath: string;
  outroPath: string;
  watermarkPath: string;
  introExists: boolean;
  outroExists: boolean;
  watermarkExists: boolean;
}> {
  const { assetsDir, introPath, outroPath, watermarkPath } = resolveAssets(config);

  const existing = {
    introExists: fs.existsSync(introPath),
    outroExists: fs.existsSync(outroPath),
    watermarkExists: fs.existsSync(watermarkPath),
  };

  const needsGen =
    !existing.introExists ||
    !existing.outroExists ||
    !existing.watermarkExists;

  if (needsGen) {
    if (!assetGenLocks.has(assetsDir)) {
      const promise = (async () => {
        fs.mkdirSync(assetsDir, { recursive: true });
        console.log(`[VideoReview:branding] Generating placeholder assets in ${assetsDir}`);

        if (!existing.introExists) {
          await generateIntroVideo(introPath, config);
          console.log('[VideoReview:branding] Generated intro.mp4');
        }
        if (!existing.outroExists) {
          await generateOutroVideo(outroPath, config);
          console.log('[VideoReview:branding] Generated outro.mp4');
        }
        if (!existing.watermarkExists) {
          await generateWatermarkPng(watermarkPath, config);
          console.log('[VideoReview:branding] Generated watermark.png');
        }
      })().finally(() => assetGenLocks.delete(assetsDir));

      assetGenLocks.set(assetsDir, promise);
    }

    await assetGenLocks.get(assetsDir);
  }

  return {
    introPath,
    outroPath,
    watermarkPath,
    introExists: fs.existsSync(introPath),
    outroExists: fs.existsSync(outroPath),
    watermarkExists: fs.existsSync(watermarkPath),
  };
}

async function normalizeForBranding(inputPath: string, outputPath: string): Promise<void> {
  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-vf', `scale=${BRANDING_RES}:force_original_aspect_ratio=decrease,pad=${BRANDING_RES}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${BRANDING_FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

async function concatSegments(segments: string[], outputPath: string): Promise<void> {
  const listFile = outputPath + '.concat.txt';
  fs.writeFileSync(listFile, segments.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  try {
    await runFFmpeg([
      '-y',
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);
  } finally {
    try { fs.unlinkSync(listFile); } catch {}
  }
}

function getWatermarkCoords(
  position: BrandingConfig['watermarkPosition'],
  useText: boolean
): { x: string; y: string } {
  switch (position) {
    case 'top-left':
      return { x: '16', y: '16' };
    case 'top-right':
      return { x: useText ? 'w-text_w-16' : 'W-w-16', y: '16' };
    case 'bottom-left':
      return { x: '16', y: useText ? 'h-text_h-16' : 'H-h-16' };
    case 'bottom-right':
    default:
      return { x: useText ? 'w-text_w-16' : 'W-w-16', y: useText ? 'h-text_h-16' : 'H-h-16' };
  }
}

async function overlayWatermarkImage(
  inputPath: string,
  watermarkPath: string,
  outputPath: string,
  config: BrandingConfig
): Promise<void> {
  const opacity = config.watermarkOpacity ?? 0.5;
  const { x, y } = getWatermarkCoords(config.watermarkPosition, false);

  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-i', watermarkPath,
    '-filter_complex',
    `[1:v]scale=220:-1,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=x=${x}:y=${y}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

async function overlayWatermarkText(
  inputPath: string,
  outputPath: string,
  config: BrandingConfig
): Promise<void> {
  const opacity = config.watermarkOpacity ?? 0.5;
  const text = escapeDrawtext(config.watermarkText || config.brandName || 'LegacyLeaf');
  const { x, y } = getWatermarkCoords(config.watermarkPosition, true);

  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-vf', `drawtext=text='${text}':fontsize=28:fontcolor=white@${opacity}:x=${x}:y=${y}:shadowcolor=black@0.6:shadowx=2:shadowy=2:box=1:boxcolor=black@0.3:boxborderw=6`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

/**
 * applyBranding — bake intro/outro clips and watermark into a video file.
 *
 * @param inputPath   Source video file path (any supported format/dimensions).
 * @param outputPath  Destination path for the branded video.
 * @param config      Branding configuration from the adapter.
 * @param tmpDir      Directory for intermediate files (defaults to outputPath dir).
 */
export async function applyBranding(
  inputPath: string,
  outputPath: string,
  config: BrandingConfig,
  tmpDir?: string
): Promise<void> {
  const workDir = tmpDir || path.dirname(outputPath);
  const stamp = Date.now();

  const assets = await ensureBrandingAssets(config);

  const normalizedPath = path.join(workDir, `branding_norm_${stamp}.mp4`);
  await normalizeForBranding(inputPath, normalizedPath);

  let workPath = normalizedPath;

  if (assets.introExists || assets.outroExists) {
    const segments = [
      ...(assets.introExists ? [assets.introPath] : []),
      normalizedPath,
      ...(assets.outroExists ? [assets.outroPath] : []),
    ];
    const concatPath = path.join(workDir, `branding_concat_${stamp}.mp4`);
    await concatSegments(segments, concatPath);
    workPath = concatPath;
  }

  if (assets.watermarkExists) {
    const wmPath = path.join(workDir, `branding_wm_${stamp}.mp4`);
    await overlayWatermarkImage(workPath, assets.watermarkPath, wmPath, config);
    if (workPath !== normalizedPath) {
      try { fs.unlinkSync(workPath); } catch {}
    }
    workPath = wmPath;
  } else if (config.watermarkText || config.brandName) {
    const wmPath = path.join(workDir, `branding_wm_${stamp}.mp4`);
    await overlayWatermarkText(workPath, wmPath, config);
    if (workPath !== normalizedPath) {
      try { fs.unlinkSync(workPath); } catch {}
    }
    workPath = wmPath;
  }

  fs.renameSync(workPath, outputPath);

  if (fs.existsSync(normalizedPath) && normalizedPath !== outputPath) {
    try { fs.unlinkSync(normalizedPath); } catch {}
  }
}
