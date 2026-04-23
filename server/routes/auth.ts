import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import {
  adminUsers,
  adminSessions,
  passwordResetTokens,
} from "../../shared/schema";
import { createAuthMiddleware } from "../middleware/auth";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createAuthRoutes(db: NodePgDatabase) {
  const router = Router();
  const authRequired = createAuthMiddleware(db);

  // Helper: send magic login link via Resend
  async function sendMagicLink(email: string, loginUrl: string) {
    const resendKey = process.env.RESEND_CONSOLEBLUE_API_KEY || process.env.RESEND_API_KEY;
    if (!resendKey) {
      // No email service — log link for dev only
      if (process.env.NODE_ENV !== "production") {
        console.log(`[auth] Dev mode — login link generated`);
      }
      return;
    }

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Console.Blue <noreply@console.blue>",
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
            Console.Blue — Internal Operations
          </p>
        </div>
      `,
    });
  }

  // POST /api/auth/send-magic-link
  router.post("/send-magic-link", async (req, res) => {
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
      } catch (dbErr) {
        return res.json({ success: true, message: successMsg });
      }

      if (!user || !user.isActive) {
        return res.json({ success: true, message: successMsg });
      }

      // Generate token
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

      try {
        await sendMagicLink(email, loginUrl);
      } catch (emailErr) {
        // Silently fail — don't reveal whether email exists
      }

      res.json({ success: true, message: successMsg });
    } catch (err) {
      res.status(500).json({ error: "An error occurred" });
    }
  });

  // GET /api/auth/verify-magic-link
  // The URL inside the email lands here. We do NOT consume the token on GET —
  // email clients, Resend's click tracker, and corporate anti-phishing scanners
  // routinely prefetch GET URLs to check them for malware, which would burn a
  // one-time token before the human ever clicks it. Instead we render a small
  // HTML page with a POST form; only the user's click submits it, and only the
  // POST actually consumes the token.
  router.get("/verify-magic-link", async (req, res) => {
    try {
      const token = req.query.token as string;
      const baseUrl =
        process.env.FRONTEND_URL ||
        (req.headers.origin || `${req.protocol}://${req.get("host")}`);

      if (!token) {
        return res.redirect(`${baseUrl}/login?error=invalid`);
      }

      // Validate token without consuming it.
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

      // Token is valid and unused — render a prefetch-safe confirmation page.
      const safeToken = token.replace(/[^a-f0-9]/gi, ""); // defense in depth
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Sign in to triadblue.systems</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #E9ECF0; margin: 0; padding: 40px 20px; color: #09080E; }
    .card { max-width: 420px; margin: 8vh auto; background: #fff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(9,8,14,0.08); text-align: center; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #09080E; }
    p { color: #555; line-height: 1.55; margin: 0 0 24px; }
    button { background: #001BB2; color: #fff; border: 0; border-radius: 8px; padding: 14px 36px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; }
    button:hover { background: #001490; }
    .foot { color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to triadblue.systems</h1>
    <p>Click the button to complete sign-in. This extra step confirms it's a human clicking, not an automated link scanner.</p>
    <form method="POST" action="/api/auth/verify-magic-link" autocomplete="off">
      <input type="hidden" name="token" value="${safeToken}" />
      <button type="submit">Sign In</button>
    </form>
    <p class="foot">If you didn't request this, close this page and nothing will happen.</p>
  </div>
</body>
</html>`);
    } catch (err) {
      console.error("Verify magic link (GET) error:", err);
      const baseUrl =
        process.env.FRONTEND_URL ||
        (req.headers.origin || `${req.protocol}://${req.get("host")}`);
      res.redirect(`${baseUrl}/login?error=server`);
    }
  });

  // POST /api/auth/verify-magic-link
  // Actually consumes the token, creates a session, and redirects to the
  // dashboard. Called by the confirmation page's form — automated prefetchers
  // and link scanners do not submit POST forms, so the token is safe from
  // premature consumption.
  router.post("/verify-magic-link", async (req, res) => {
    try {
      const token =
        (req.body && typeof req.body.token === "string" ? req.body.token : "") ||
        (typeof req.query.token === "string" ? req.query.token : "");
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
        res.redirect(baseUrl + "/");
      });
    } catch (err) {
      console.error("Verify magic link (POST) error:", err);
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

  // POST /api/auth/change-password (requires active session)
  router.post("/change-password", authRequired, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.userId!))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const bcrypt = await import("bcrypt");

      // If user has an existing password, verify current password
      if (user.passwordHash && user.passwordHash !== "") {
        if (!currentPassword) {
          return res.status(400).json({ error: "Current password is required" });
        }
        const valid = await bcrypt.default.compare(currentPassword, user.passwordHash);
        if (!valid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      // Hash and save new password
      const newHash = await bcrypt.default.hash(newPassword, 12);
      await db
        .update(adminUsers)
        .set({ passwordHash: newHash })
        .where(eq(adminUsers.id, user.id));

      res.json({ success: true, message: "Password updated" });
    } catch (err) {
      res.status(500).json({ error: "Failed to change password" });
    }
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
