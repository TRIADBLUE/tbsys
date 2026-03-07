import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import {
  adminUsers,
  adminSessions,
  passwordResetTokens,
} from "../../shared/schema";
import { constantTimeCompare } from "../middleware/auth";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createAuthRoutes(db: NodePgDatabase) {
  const router = Router();

  console.log(`[auth] Routes registered. RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "SET" : "NOT SET"}`);

  // Startup: list admin users so we know what's in the DB
  (async () => {
    try {
      const result = await db.select({ id: adminUsers.id, email: adminUsers.email, isActive: adminUsers.isActive }).from(adminUsers);
      console.log(`[auth] Admin users in DB:`, result.map(u => `${u.id}:${u.email}(active=${u.isActive})`).join(", ") || "NONE");
    } catch (e) {
      console.error(`[auth] Failed to list admin users:`, e);
    }
  })();

  // Helper: send magic login link via Resend
  async function sendMagicLink(email: string, loginUrl: string) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.log(`[auth] No RESEND_API_KEY — login link: ${loginUrl}`);
      return;
    }

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Console.Blue <dev@console.blue>",
      to: email,
      subject: "Sign in to Console.Blue",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 24px; font-weight: bold;">
              <span style="color: #FF44CC;">Console.</span><span style="color: #0000FF;">Blue</span>
            </span>
          </div>
          <h2 style="color: #111; font-size: 20px; margin-bottom: 16px;">Sign in to Console.Blue</h2>
          <p style="color: #555; line-height: 1.6;">
            Click the button below to sign in. This link expires in 15 minutes.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="background-color: #0000FF; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Sign In
            </a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">
            If you didn't request this, you can ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #bbb; font-size: 12px; text-align: center;">
            Console.Blue — Project Management Hub
          </p>
        </div>
      `,
    });
    console.log(`[auth] Magic link email sent to ${email}`);
  }

  // POST /api/auth/send-magic-link
  // User enters email, we send them a login link
  router.post("/send-magic-link", async (req, res) => {
    console.log(`[auth] /send-magic-link hit, body:`, req.body);
    try {
      const { email } = req.body;
      const successMsg = "If an account exists, we sent you a sign-in link.";

      if (!email) {
        return res.json({ success: true, message: successMsg });
      }

      let user;
      try {
        const results = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.email, email.toLowerCase()))
          .limit(1);
        user = results[0];
        console.log(`[auth] DB query returned ${results.length} results for ${email.toLowerCase()}`);
      } catch (dbErr) {
        console.error(`[auth] DB query FAILED:`, dbErr);
        return res.json({ success: true, message: successMsg });
      }

      if (!user) {
        console.log(`[auth] No user found for email: ${email.toLowerCase()}`);
        return res.json({ success: true, message: successMsg });
      }

      console.log(`[auth] User found: id=${user.id}, isActive=${user.isActive}`);

      if (!user.isActive) {
        console.log(`[auth] User is inactive, skipping`);
        return res.json({ success: true, message: successMsg });
      }

      // Generate token (reuse passwordResetTokens table)
      const token = randomBytes(32).toString("hex");
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });

      // Build login URL
      const baseUrl =
        process.env.FRONTEND_URL ||
        (req.headers.origin || `${req.protocol}://${req.get("host")}`);
      const loginUrl = `${baseUrl}/api/auth/verify-magic-link?token=${token}`;

      console.log(`[auth] Sending magic link to ${email}, URL: ${loginUrl}`);
      try {
        await sendMagicLink(email, loginUrl);
        console.log(`[auth] Magic link sent successfully to ${email}`);
      } catch (emailErr) {
        console.error("[auth] Failed to send magic link:", emailErr);
      }

      res.json({ success: true, message: successMsg });
    } catch (err) {
      console.error("Magic link error:", err);
      res.status(500).json({ error: "An error occurred" });
    }
  });

  // GET /api/auth/verify-magic-link
  // User clicks the link in their email, we log them in
  router.get("/verify-magic-link", async (req, res) => {
    try {
      const token = req.query.token as string;
      const baseUrl =
        process.env.FRONTEND_URL ||
        (req.headers.origin || `${req.protocol}://${req.get("host")}`);

      if (!token) {
        return res.redirect(`${baseUrl}/login?error=invalid`);
      }

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!resetToken || resetToken.usedAt) {
        return res.redirect(`${baseUrl}/login?error=expired`);
      }

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Get user
      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, resetToken.userId))
        .limit(1);

      if (!user || !user.isActive) {
        return res.redirect(`${baseUrl}/login?error=invalid`);
      }

      // Create session
      const sessionToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(adminSessions).values({
        userId: user.id,
        sessionToken,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        expiresAt,
      });

      await db
        .update(adminUsers)
        .set({
          failedLoginAttempts: 0,
          accountLocked: false,
          lockedUntil: null,
          lastLogin: new Date(),
        })
        .where(eq(adminUsers.id, user.id));

      // Store in express session
      req.session.userId = user.id;
      req.session.sessionToken = sessionToken;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect(`${baseUrl}/login?error=session`);
        }
        // Redirect to dashboard
        res.redirect(baseUrl + "/");
      });
    } catch (err) {
      console.error("Verify magic link error:", err);
      const baseUrl =
        process.env.FRONTEND_URL ||
        (req.headers.origin || `${req.protocol}://${req.get("host")}`);
      res.redirect(`${baseUrl}/login?error=server`);
    }
  });

  // POST /api/auth/logout
  router.post("/logout", async (req, res) => {
    try {
      if (req.session.sessionToken) {
        await db
          .delete(adminSessions)
          .where(eq(adminSessions.sessionToken, req.session.sessionToken));
      }

      req.session.destroy((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ error: "Failed to logout" });
        }
        res.json({ success: true });
      });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // GET /api/auth/me
  router.get("/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const [user] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        displayName: adminUsers.displayName,
        role: adminUsers.role,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.session.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user });
  });

  // POST /api/auth/seed-admin (initial setup only)
  router.post("/seed-admin", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const existing = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ error: "Admin user already exists" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.default.hash(password, 12);
      const [user] = await db
        .insert(adminUsers)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          displayName: displayName || email.split("@")[0],
          role: "super_admin",
        })
        .returning();

      res.json({
        success: true,
        message: "Admin user created",
        user: { email: user.email, role: user.role },
      });
    } catch (err) {
      console.error("Seed admin error:", err);
      res.status(500).json({ error: "Failed to create admin user" });
    }
  });

  return router;
}
