import { useState } from "react";
import { Link } from "wouter";
import { useForgotPassword } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BRAND_ASSETS } from "@/lib/assets";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await forgotPassword.mutateAsync(email);
    setSent(true);
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
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-gray-500">
                If an account exists for <strong>{email}</strong>, we sent a
                password reset link. Check your inbox.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Sign in
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 text-center mb-4">
                Enter your email and we'll send you a link to reset your
                password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  disabled={forgotPassword.isPending}
                >
                  {forgotPassword.isPending
                    ? "Sending..."
                    : "Send Reset Link"}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 inline mr-1" />
                    Back to Sign in
                  </Link>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
