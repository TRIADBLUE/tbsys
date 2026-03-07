import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BRAND_ASSETS } from "@/lib/assets";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Check for error from magic link redirect
  const params = new URLSearchParams(window.location.search);
  const urlError = params.get("error");

  async function sendLink(targetEmail?: string) {
    const addr = targetEmail || email;
    if (!addr) return;
    setError("");
    setSending(true);
    try {
      await apiClient.post("/auth/send-magic-link", { email: addr });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src={BRAND_ASSETS.consoleblue.logoLockup}
            alt="Console.Blue"
            className="mx-auto mb-4 h-12"
          />
        </CardHeader>
        <CardContent>
          {urlError && !sent && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200 mb-4">
              {urlError === "expired"
                ? "That link has expired. Request a new one."
                : urlError === "session"
                  ? "Session error. Please try again."
                  : "Invalid link. Request a new one."}
            </div>
          )}

          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a sign-in link to <strong>{email}</strong>.
                Click the link in the email to sign in.
              </p>
              <p className="text-xs text-gray-400">
                The link expires in 15 minutes.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => sendLink(email)}
                  disabled={sending}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Resend link"}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => { setSent(false); setEmail(""); setError(""); }}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Try a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter your email and we'll send you a link to sign in.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send Sign-In Link"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
