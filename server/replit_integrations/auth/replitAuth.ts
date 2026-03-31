import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage.ts";
import { pool } from "../../db.ts";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

function makeSessionUser(userId: string, provider: string) {
  return {
    claims: { sub: userId },
    expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    auth_provider: provider,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  if (process.env.GOOGLE_CLIENT_ID) {
    console.log('[Auth] Google Identity Services configured (client-side flow)');
  } else {
    console.log('[Auth] Google sign-in not configured (missing GOOGLE_CLIENT_ID)');
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const authProvider = (req.user as any)?.auth_provider;
    req.logout(() => {
      if (authProvider === 'google' || authProvider === 'email') {
        res.redirect('/');
      } else {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${protocol}://${req.hostname}`,
          }).href
        );
      }
    });
  });

  app.get("/api/auth/google/client-id", (_req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
  });

  app.get("/api/auth/google/redirect", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      res.status(400).send('Google sign-in not configured');
      return;
    }
    const rawProto = req.headers['x-forwarded-proto'];
    const protocol = (Array.isArray(rawProto) ? rawProto[0] : (rawProto || '')).split(',')[0].trim() || req.protocol || 'https';
    const redirectUri = `${protocol}://${req.hostname}/api/auth/google/callback`;
    console.log('[Auth] Google redirect URI:', redirectUri);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        res.redirect('/#/auth?error=google_failed');
        return;
      }
      const rawProto2 = req.headers['x-forwarded-proto'];
      const protocol = (Array.isArray(rawProto2) ? rawProto2[0] : (rawProto2 || '')).split(',')[0].trim() || req.protocol || 'https';
      const redirectUri = `${protocol}://${req.hostname}/api/auth/google/callback`;
      console.log('[Auth] Google callback redirect URI:', redirectUri);
      const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
      const { tokens } = await googleClient.getToken(code as string);
      if (!tokens.id_token) {
        res.redirect('/#/auth?error=google_failed');
        return;
      }
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        res.redirect('/#/auth?error=google_failed');
        return;
      }
      const email = normalizeEmail(payload.email);
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      const profileImageUrl = payload.picture || null;
      const existingByEmail = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
      let userId: string;
      if (existingByEmail.rows.length > 0) {
        userId = existingByEmail.rows[0].id;
        await pool.query(
          `UPDATE users SET first_name = COALESCE(NULLIF($1, ''), first_name), last_name = COALESCE(NULLIF($2, ''), last_name),
           profile_image_url = COALESCE($3, profile_image_url), auth_provider = COALESCE(auth_provider, 'google'), updated_at = now() WHERE id = $4`,
          [firstName, lastName, profileImageUrl, userId]
        );
      } else {
        const result = await pool.query(
          `INSERT INTO users (email, first_name, last_name, profile_image_url, auth_provider)
           VALUES ($1, $2, $3, $4, 'google') RETURNING id`,
          [email, firstName, lastName, profileImageUrl]
        );
        userId = result.rows[0].id;
      }
      const sessionUser = makeSessionUser(userId, 'google');
      req.login(sessionUser, (err) => {
        if (err) {
          console.error('[Auth] Google redirect login error:', err);
          res.redirect('/#/auth?error=google_failed');
          return;
        }
        console.log('[Auth] Google redirect login successful for:', email);
        res.redirect('/');
      });
    } catch (err: any) {
      console.error('[Auth] Google callback error:', err.message);
      res.redirect('/#/auth?error=google_failed');
    }
  });

  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential || !process.env.GOOGLE_CLIENT_ID) {
        res.status(400).json({ error: 'Missing credential or Google not configured' });
        return;
      }

      const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        res.status(400).json({ error: 'Invalid Google token' });
        return;
      }

      const email = normalizeEmail(payload.email);
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      const profileImageUrl = payload.picture || null;

      const existingByEmail = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
      let userId: string;

      if (existingByEmail.rows.length > 0) {
        userId = existingByEmail.rows[0].id;
        await pool.query(
          `UPDATE users SET first_name = COALESCE(NULLIF($1, ''), first_name), last_name = COALESCE(NULLIF($2, ''), last_name),
           profile_image_url = COALESCE($3, profile_image_url), auth_provider = COALESCE(auth_provider, 'google'), updated_at = now() WHERE id = $4`,
          [firstName, lastName, profileImageUrl, userId]
        );
      } else {
        const result = await pool.query(
          `INSERT INTO users (email, first_name, last_name, profile_image_url, auth_provider)
           VALUES ($1, $2, $3, $4, 'google') RETURNING id`,
          [email, firstName, lastName, profileImageUrl]
        );
        userId = result.rows[0].id;
      }

      const sessionUser = makeSessionUser(userId, 'google');
      req.login(sessionUser, (err) => {
        if (err) {
          console.error('[Auth] Google session creation error:', err);
          res.status(500).json({ error: 'Failed to create session' });
          return;
        }
        console.log('[Auth] Google Identity Services login successful for:', email);
        res.json({ success: true, user: sessionUser });
      });
    } catch (err: any) {
      console.error('[Auth] Google token verification error:', err.message);
      res.status(401).json({ error: 'Invalid Google credential' });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { password, firstName, lastName } = req.body;
      const email = req.body.email ? normalizeEmail(req.body.email) : '';
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }

      const existing = await pool.query('SELECT id, password_hash FROM users WHERE LOWER(email) = $1', [email]);
      if (existing.rows.length > 0) {
        if (existing.rows[0].password_hash) {
          res.status(409).json({ error: "An account with this email already exists. Try signing in instead." });
          return;
        }
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
          `UPDATE users SET password_hash = $1, first_name = COALESCE(NULLIF($2, ''), first_name),
           last_name = COALESCE(NULLIF($3, ''), last_name), auth_provider = 'email', updated_at = now() WHERE id = $4`,
          [hash, firstName || null, lastName || null, existing.rows[0].id]
        );
        const sessionUser = makeSessionUser(existing.rows[0].id, 'email');
        req.login(sessionUser, (err) => {
          if (err) { res.status(500).json({ error: "Login failed" }); return; }
          res.json({ success: true });
        });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (email, first_name, last_name, password_hash, auth_provider)
         VALUES ($1, $2, $3, $4, 'email') RETURNING id`,
        [email, firstName || null, lastName || null, hash]
      );
      const userId = result.rows[0].id;

      const sessionUser = makeSessionUser(userId, 'email');
      req.login(sessionUser, (err) => {
        if (err) { res.status(500).json({ error: "Login failed" }); return; }
        res.json({ success: true });
      });
    } catch (error: any) {
      console.error("[Auth] Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = req.body.email ? normalizeEmail(req.body.email) : '';
      const { password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const result = await pool.query('SELECT id, password_hash FROM users WHERE LOWER(email) = $1', [email]);
      if (result.rows.length === 0) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const user = result.rows[0];
      if (!user.password_hash) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
          `UPDATE users SET password_hash = $1, auth_provider = 'email', updated_at = now() WHERE id = $2`,
          [hash, user.id]
        );
      } else {
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          res.status(401).json({ error: "Invalid email or password" });
          return;
        }
      }

      const sessionUser = makeSessionUser(user.id, 'email');
      req.login(sessionUser, (err) => {
        if (err) { res.status(500).json({ error: "Login failed" }); return; }
        res.json({ success: true });
      });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.auth_provider === 'email' || user.auth_provider === 'google') {
    return next();
  }

  if (!user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
