import { pool } from "../../db.ts";

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  createdAt: Date | null;
  updatedAt: Date | null;
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
      role: row.role || 'user',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      role: row.role || 'user',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const authStorage = new AuthStorage();
