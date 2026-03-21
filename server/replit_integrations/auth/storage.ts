import { pool } from "../../db.ts";

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  handle: string | null;
  avatarUrl: string | null;
  role: string;
  isCreator: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  socialLinkPlatform: string | null;
  socialLinkUrl: string | null;
  socialLinkPublic: boolean;
  socialLinkVerified: boolean;
}

export interface UpsertUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

function resolveAvatarUrl(row: any): string | null {
  return row.custom_profile_image_url || row.profile_image_url || null;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      profileImageUrl: row.profile_image_url,
      handle: row.handle || null,
      avatarUrl: resolveAvatarUrl(row),
      role: row.role || 'user',
      isCreator: row.is_creator ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      socialLinkPlatform: row.social_link_platform || null,
      socialLinkUrl: row.social_link_url || null,
      socialLinkPublic: row.social_link_public ?? false,
      socialLinkVerified: row.social_link_verified ?? false,
    };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (id, email, first_name, last_name, profile_image_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         first_name = COALESCE(EXCLUDED.first_name, users.first_name),
         last_name = COALESCE(EXCLUDED.last_name, users.last_name),
         profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
         updated_at = now()
       RETURNING *`,
      [
        userData.id,
        userData.email || null,
        userData.firstName || null,
        userData.lastName || null,
        userData.profileImageUrl || null,
      ]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      profileImageUrl: row.profile_image_url,
      handle: row.handle || null,
      avatarUrl: resolveAvatarUrl(row),
      role: row.role || 'user',
      isCreator: row.is_creator ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      socialLinkPlatform: row.social_link_platform || null,
      socialLinkUrl: row.social_link_url || null,
      socialLinkPublic: row.social_link_public ?? false,
      socialLinkVerified: row.social_link_verified ?? false,
    };
  }
}

export const authStorage = new AuthStorage();
