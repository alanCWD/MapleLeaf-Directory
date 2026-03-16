import { pool } from './db';
import type { CreatorPost, PostMedia, ContentTier, PostStatus } from '../types';

function postSnakeToCamel(row: Record<string, any>): CreatorPost {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id || null,
    title: row.title,
    subtitle: row.subtitle || null,
    bodyText: row.body_text || null,
    contentTier: row.content_tier as ContentTier,
    status: row.status as PostStatus,
    moderationNotes: row.moderation_notes || null,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    authorName: row.author_name || undefined,
    authorImageUrl: row.author_image_url || undefined,
    storeName: row.store_name || undefined,
  };
}

function mediaSnakeToCamel(row: Record<string, any>): PostMedia {
  return {
    id: row.id,
    postId: row.post_id,
    mediaType: row.media_type,
    bunnyId: row.bunny_id || null,
    cdnUrl: row.cdn_url,
    caption: row.caption || null,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

export async function createPost(data: {
  userId: string;
  storeId?: string | null;
  title: string;
  subtitle?: string | null;
  bodyText?: string | null;
  contentTier: ContentTier;
  status: PostStatus;
  moderationNotes?: string | null;
}): Promise<CreatorPost> {
  const result = await pool.query(
    `INSERT INTO creator_posts (user_id, store_id, title, subtitle, body_text, content_tier, status, moderation_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.userId,
      data.storeId || null,
      data.title,
      data.subtitle || null,
      data.bodyText || null,
      data.contentTier,
      data.status,
      data.moderationNotes || null,
    ]
  );
  return postSnakeToCamel(result.rows[0]);
}

export async function getPostById(id: number): Promise<CreatorPost | null> {
  const result = await pool.query(
    `SELECT p.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Anonymous') as author_name,
            u.profile_image_url as author_image_url,
            s.name as store_name
     FROM creator_posts p
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN stores s ON p.store_id = s.id
     WHERE p.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const post = postSnakeToCamel(result.rows[0]);
  post.media = await getPostMedia(id);
  return post;
}

export async function listPublishedPosts(options: {
  storeId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ posts: CreatorPost[]; total: number }> {
  const conditions = [`p.status = 'published'`];
  const params: any[] = [];
  let idx = 1;

  if (options.storeId) {
    conditions.push(`p.store_id = $${idx++}`);
    params.push(options.storeId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = options.limit || 20;
  const offset = ((options.page || 1) - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM creator_posts p ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const postsResult = await pool.query(
    `SELECT p.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Anonymous') as author_name,
            u.profile_image_url as author_image_url,
            s.name as store_name
     FROM creator_posts p
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN stores s ON p.store_id = s.id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const posts = postsResult.rows.map(postSnakeToCamel);
  for (const post of posts) {
    post.media = await getPostMedia(post.id);
  }

  return { posts, total };
}

export async function listUserPosts(userId: string): Promise<CreatorPost[]> {
  const result = await pool.query(
    `SELECT p.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Anonymous') as author_name,
            u.profile_image_url as author_image_url,
            s.name as store_name
     FROM creator_posts p
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN stores s ON p.store_id = s.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  const posts = result.rows.map(postSnakeToCamel);
  for (const post of posts) {
    post.media = await getPostMedia(post.id);
  }
  return posts;
}

export async function listPendingPosts(): Promise<CreatorPost[]> {
  const result = await pool.query(
    `SELECT p.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Anonymous') as author_name,
            u.profile_image_url as author_image_url,
            s.name as store_name
     FROM creator_posts p
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN stores s ON p.store_id = s.id
     WHERE p.status = 'pending_moderation'
     ORDER BY p.created_at ASC`
  );
  const posts = result.rows.map(postSnakeToCamel);
  for (const post of posts) {
    post.media = await getPostMedia(post.id);
  }
  return posts;
}

export async function updatePostStatus(
  id: number,
  status: PostStatus,
  moderationNotes?: string
): Promise<CreatorPost | null> {
  const result = await pool.query(
    `UPDATE creator_posts SET status = $1, moderation_notes = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, moderationNotes || null, id]
  );
  if (result.rows.length === 0) return null;
  return postSnakeToCamel(result.rows[0]);
}

export async function deletePost(id: number, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM creator_posts WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function adminDeletePost(id: number): Promise<boolean> {
  const result = await pool.query(`DELETE FROM creator_posts WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function addPostMedia(data: {
  postId: number;
  mediaType: 'image' | 'video';
  bunnyId?: string | null;
  cdnUrl: string;
  caption?: string | null;
  displayOrder?: number;
}): Promise<PostMedia> {
  const result = await pool.query(
    `INSERT INTO post_media (post_id, media_type, bunny_id, cdn_url, caption, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.postId, data.mediaType, data.bunnyId || null, data.cdnUrl, data.caption || null, data.displayOrder ?? 0]
  );
  return mediaSnakeToCamel(result.rows[0]);
}

export async function getPostMedia(postId: number): Promise<PostMedia[]> {
  const result = await pool.query(
    `SELECT * FROM post_media WHERE post_id = $1 ORDER BY display_order ASC, id ASC`,
    [postId]
  );
  return result.rows.map(mediaSnakeToCamel);
}

export async function deletePostMedia(id: number): Promise<boolean> {
  const result = await pool.query(`DELETE FROM post_media WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function isUserCreator(userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT is_creator FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows.length > 0 && result.rows[0].is_creator === true;
}

export async function setUserCreatorStatus(userId: string, isCreator: boolean): Promise<void> {
  await pool.query(
    `UPDATE users SET is_creator = $1, updated_at = NOW() WHERE id = $2`,
    [isCreator, userId]
  );
}

const PROFANITY_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'piss',
  'cock', 'cunt', 'bastard', 'slut', 'whore', 'nigger', 'faggot',
];

export function moderateCleanContent(title: string, subtitle?: string | null, bodyText?: string | null): {
  passed: boolean;
  reason?: string;
} {
  const fullText = [title, subtitle, bodyText].filter(Boolean).join(' ').toLowerCase();

  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(fullText)) {
      return { passed: false, reason: `Content contains prohibited language.` };
    }
  }

  if (fullText.length < 5) {
    return { passed: false, reason: 'Content is too short.' };
  }

  return { passed: true };
}
