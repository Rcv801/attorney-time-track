import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot" | "magic";

const Login = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const resetState = () => {
    setError(null);
    setMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(mapError(error.message));
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(mapError(error.message));
    } else {
      setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset email sent. Check your inbox.");
    }
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      const lower = error.message.toLowerCase();
      if (
        lower.includes("signups not allowed for otp") ||
        lower.includes("should be registered") ||
        lower.includes("user not found")
      ) {
        setError("No account exists for that email. Use Sign Up first.");
      } else {
        setError(error.message);
      }
    } else {
      setMessage("Magic link sent! Check your email.");
    }
    setLoading(false);
  };

  const mapError = (msg: string) => {
    if (msg.includes("Invalid login credentials")) return "Invalid email or password.";
    if (msg.includes("User already registered")) return "An account with this email already exists.";
    if (msg.includes("Email not confirmed")) return "Please confirm your email before signing in.";
    if (msg.includes("Password should be at least")) return "Password must be at least 6 characters.";
    return msg;
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, hsl(220 40% 12%) 0%, hsl(215 45% 16%) 40%, hsl(220 35% 10%) 100%)' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Brand Logo Section */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl"
               style={{ background: 'linear-gradient(135deg, hsl(42 95% 65%) 0%, hsl(38 90% 50%) 100%)' }}>
            <span className="text-2xl font-extrabold text-slate-900">6M</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">SixMin Legal</h1>
            <p className="text-[14px] font-medium" style={{ color: 'hsl(215 20% 55%)' }}>Legal time tracking, simplified.</p>
          </div>
        </div>

        {/* Card */}
        <Card className="bg-white shadow-2xl rounded-2xl" style={{ border: '1px solid hsl(215 20% 90%)' }}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold text-slate-800">TimeTrack</CardTitle>
          </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { setMode("signin"); resetState(); }}>
                Back to sign in
              </Button>
            </form>
          ) : mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="mr-2 h-4 w-4" />
                Send Magic Link
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { setMode("signin"); resetState(); }}>
                Back to sign in
              </Button>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(v) => { setMode(v as AuthMode); resetState(); }}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                  <div className="flex justify-between text-sm">
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => { setMode("forgot"); resetState(); }}>
                      Forgot password?
                    </Button>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => { setMode("magic"); resetState(); }}>
                      Magic link
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Login;
