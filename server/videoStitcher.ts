import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STITCH_DIR = '/tmp/video-stitch';

interface ClipInput {
  filePath: string;
  questionPrompt: string;
  index: number;
}

interface StitchOptions {
  clips: ClipInput[];
  storeName: string;
  transitionDuration?: number;
  titleCardDuration?: number;
  outputFormat?: string;
}

interface StitchResult {
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

function ensureStitchDir(): string {
  if (!fs.existsSync(STITCH_DIR)) {
    fs.mkdirSync(STITCH_DIR, { recursive: true });
  }
  return STITCH_DIR;
}

export function createJobDir(): string {
  ensureStitchDir();
  const jobId = crypto.randomBytes(8).toString('hex');
  const jobDir = path.join(STITCH_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  return jobDir;
}

export function cleanupJobDir(jobDir: string): void {
  try {
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[VideoStitcher] Cleanup error:', err);
  }
}

function runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

function runFFprobe(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        const dur = parseFloat(stdout.trim());
        resolve(isNaN(dur) ? 0 : dur);
      } else {
        reject(new Error(`FFprobe failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

async function createTitleCard(
  jobDir: string,
  text: string,
  index: number,
  durationSeconds: number = 2.5
): Promise<string> {
  const outputPath = path.join(jobDir, `title_${index}.mp4`);

  const escapedText = text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x1a1a1a:s=1280x720:d=${durationSeconds}:r=30`,
    '-f', 'lavfi',
    '-i', `anullsrc=r=48000:cl=stereo`,
    '-t', String(durationSeconds),
    '-vf', `drawtext=text='${escapedText}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black:shadowx=2:shadowy=2`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    outputPath,
  ];

  await runFFmpeg(args);
  return outputPath;
}

async function normalizeClip(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-movflags', '+faststart',
    outputPath,
  ];

  await runFFmpeg(args);
}

export async function stitchClips(options: StitchOptions): Promise<StitchResult> {
  const {
    clips,
    storeName,
    transitionDuration = 0.5,
    titleCardDuration = 2.5,
  } = options;

  if (clips.length === 0) {
    throw new Error('No clips provided for stitching');
  }

  const jobDir = path.dirname(clips[0].filePath);

  console.log(`[VideoStitcher] Starting stitch: ${clips.length} clips for "${storeName}"`);

  const segments: string[] = [];

  const introPath = await createTitleCard(
    jobDir,
    `Video Review\\n${storeName}`,
    999,
    3
  );
  segments.push(introPath);

  for (const clip of clips) {
    const titlePath = await createTitleCard(
      jobDir,
      clip.questionPrompt,
      clip.index,
      titleCardDuration
    );
    segments.push(titlePath);

    const normalizedPath = path.join(jobDir, `normalized_${clip.index}.mp4`);
    await normalizeClip(clip.filePath, normalizedPath);
    segments.push(normalizedPath);
  }

  console.log(`[VideoStitcher] Created ${segments.length} segments, concatenating with transitions`);

  const outputPath = path.join(jobDir, 'stitched_output.mp4');

  if (segments.length <= 1) {
    if (segments.length === 1) {
      fs.copyFileSync(segments[0], outputPath);
    }
  } else if (segments.length <= 12) {
    await stitchWithCrossfade(segments, outputPath, transitionDuration);
  } else {
    await stitchWithConcat(segments, outputPath, transitionDuration);
  }

  const stats = fs.statSync(outputPath);
  const duration = await runFFprobe(outputPath);

  console.log(`[VideoStitcher] Stitch complete: ${(stats.size / (1024 * 1024)).toFixed(1)}MB, ${duration.toFixed(1)}s`);

  return {
    outputPath,
    durationSeconds: duration,
    fileSizeBytes: stats.size,
  };
}

async function stitchWithCrossfade(
  segments: string[],
  outputPath: string,
  crossfadeDuration: number
): Promise<void> {
  const inputs: string[] = [];
  segments.forEach((seg) => {
    inputs.push('-i', seg);
  });

  const n = segments.length;

  let filterComplex = '';
  const audioInputs: string[] = [];

  for (let i = 0; i < n; i++) {
    filterComplex += `[${i}:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,format=yuv420p[v${i}];`;
    filterComplex += `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}];`;
  }

  let currentVideo = 'v0';
  let xfadeCount = 0;

  let offset = 0;
  const durations: number[] = [];
  for (const seg of segments) {
    const dur = await runFFprobe(seg);
    durations.push(dur);
  }

  for (let i = 1; i < n; i++) {
    offset += durations[i - 1] - crossfadeDuration;
    if (offset < 0) offset = 0;

    const outLabel = `xf${xfadeCount}`;
    filterComplex += `[${currentVideo}][v${i}]xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset.toFixed(2)}[${outLabel}];`;
    currentVideo = outLabel;
    xfadeCount++;
  }

  for (let i = 0; i < n; i++) {
    audioInputs.push(`[a${i}]`);
  }
  filterComplex += `${audioInputs.join('')}concat=n=${n}:v=0:a=1[aout]`;

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', `[${currentVideo}]`,
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ];

  await runFFmpeg(args);
}

async function stitchWithConcat(
  segments: string[],
  outputPath: string,
  _crossfadeDuration: number
): Promise<void> {
  const jobDir = path.dirname(outputPath);
  const fadeSegments: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const dur = await runFFprobe(segments[i]);
    const fadeSeg = path.join(jobDir, `fade_seg_${i}.mp4`);
    const fadeOutStart = Math.max(0, dur - 0.3);

    await runFFmpeg([
      '-y',
      '-i', segments[i],
      '-vf', `fade=t=in:st=0:d=0.3,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.3,fps=30,scale=1280:720,format=yuv420p`,
      '-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.3`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      fadeSeg,
    ]);
    fadeSegments.push(fadeSeg);
  }

  const listFile = path.join(jobDir, 'concat_list.txt');
  const listContent = fadeSegments.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  await runFFmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export async function uploadStitchedToBunny(
  filePath: string,
  videoId: string
): Promise<void> {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || '';
  const apiKey = process.env.BUNNY_STREAM_API_KEY || '';

  if (!libraryId || !apiKey) {
    throw new Error('Bunny Stream not configured');
  }

  const stats = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);

  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stats.size),
      },
      body: fileStream as any,
      duplex: 'half' as any,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }

  console.log(`[VideoStitcher] Uploaded stitched video to Bunny: ${videoId}`);
}
