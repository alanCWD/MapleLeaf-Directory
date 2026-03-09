import type { Express } from "express";
import { authStorage } from "./storage.ts";
import { isAuthenticated } from "./replitAuth.ts";
import { getUserBadges } from "../../integrity/index.ts";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      const badges = await getUserBadges(userId);
      res.json({ ...user, badges });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
