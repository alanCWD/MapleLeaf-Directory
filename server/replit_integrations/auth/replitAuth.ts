import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";

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

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const domains = (process.env.REPLIT_DOMAINS || '').split(',').filter(Boolean);
    const devDomain = process.env.REPLIT_DEV_DOMAIN || '';
    const primaryDomain = domains[0] || devDomain || 'localhost';
    const googleCallbackURL = `https://${primaryDomain}/api/auth/google/callback`;
    console.log(`[Auth] Google OAuth callback URL: ${googleCallbackURL}`);
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: googleCallbackURL,
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    }, async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email = normalizeEmail(profile.emails?.[0]?.value || '');
        if (!email) { done(new Error('No email from Google')); return; }
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || '';
        const lastName = profile.name?.familyName || '';
        const profileImageUrl = profile.photos?.[0]?.value || null;

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

        done(null, makeSessionUser(userId, 'google'));
      } catch (err) {
        done(err);
      }
    }));
    console.log('[Auth] Google OAuth strategy configured');
  } else {
    console.log('[Auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
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

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google/debug", (_req, res) => {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const maskedId = clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 20);
      res.json({
        clientIdFormat: maskedId,
        clientIdLength: clientId.length,
        endsWithGoogleusercontent: clientId.endsWith('.apps.googleusercontent.com'),
        callbackURL: googleCallbackURL,
        hasSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        secretLength: (process.env.GOOGLE_CLIENT_SECRET || '').length,
      });
    });

    app.get("/api/auth/google", (req, res, next) => {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID!)}&redirect_uri=${encodeURIComponent(googleCallbackURL)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&access_type=offline&prompt=consent`;
      console.log('[Auth] Google OAuth redirect URL:', authUrl);
      passport.authenticate("google", {
        scope: ["openid", "profile", "email"],
        accessType: "offline",
        prompt: "consent",
      })(req, res, next);
    });

    app.get("/api/auth/google/callback", (req, res, next) => {
      console.log('[Auth] Google OAuth callback received');
      if (req.query.error) {
        console.error('[Auth] Google OAuth error:', req.query.error, req.query.error_description);
        res.redirect("/#/auth");
        return;
      }
      passport.authenticate("google", {
        failureRedirect: "/#/auth",
        failureMessage: true,
      })(req, res, (err: any) => {
        if (err) {
          console.error('[Auth] Google OAuth authentication error:', err);
          res.redirect("/#/auth");
          return;
        }
        console.log('[Auth] Google OAuth login successful');
        res.redirect("/");
      });
    });
  }

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
        res.status(401).json({ error: "This account uses Google or Replit sign-in. Please use that method instead." });
        return;
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
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
