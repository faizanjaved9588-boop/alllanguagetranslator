import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — All Language Translator" },
      { name: "description", content: "Sign in with Google, phone number or email to save your translations and practice." },
      { property: "og:title", content: "Sign in — All Language Translator" },
      { property: "og:description", content: "Sign in with Google, your phone number or email to access your translation studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

type Provider = "google" | "apple" | "microsoft";

const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
};

function ProviderIcon({ provider }: { provider: Provider }) {
  switch (provider) {
    case "google":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="#EA4335" d="M12 5.3c1.7 0 3.2.6 4.4 1.7l3.2-3.2C17.6 1.9 15 .8 12 .8 7.4.8 3.4 3.4 1.5 7.3l3.8 3c.9-2.8 3.5-5 6.7-5z" />
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
          <path fill="#FBBC05" d="M5.3 13.7a7 7 0 0 1 0-4.4l-3.8-3a11.6 11.6 0 0 0 0 10.4l3.8-3z" />
          <path fill="#34A853" d="M12 23.2c3 0 5.5-1 7.4-2.7l-3.7-2.9c-1 .7-2.3 1.1-3.7 1.1-3.2 0-5.8-2.2-6.7-5l-3.8 3c1.9 3.9 5.9 6.5 10.5 6.5z" />
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="currentColor" d="M16.6 12.9c0-2.4 2-3.6 2-3.6-1.1-1.6-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-0.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.9zM14.1 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.5z" />
        </svg>
      );
    case "microsoft":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
          <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
          <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
          <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
        </svg>
      );
  }
}

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const nav = useNavigate();

  // Social sign-in returns here with a live session, so the studio is one step away.
  useEffect(() => { if (session) nav({ to: "/app" }); }, [session, nav]);

  const finish = (error: { message: string } | null) => {
    setBusy(false);
    if (error) {
      toast.error(
        /provider|unsupported|not enabled|disabled/i.test(error.message)
          ? "This sign-in option isn't switched on yet. Turn it on under More → Users → Auth settings."
          : error.message
      );
      return false;
    }
    return true;
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
    if (!finish(error)) return;
    if (mode === "up" && !data.session) toast.success("Check your email to confirm your account.");
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim(), options: { channel: "sms" } });
    if (!finish(error)) return;
    setCodeSent(true);
    toast.success("We sent a 6-digit code by SMS. Enter it below.");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: code.trim(), type: "sms" });
    finish(error);
  };

  const signInWithProvider = async (provider: Provider) => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      finish(result.error);
      return;
    }
    if (result.redirected) return; // the browser is on its way to the provider
    // Tokens arrived and the session is already set — the effect above opens the studio.
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8">
        <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
        <div>
          <h1 className="text-3xl font-bold">{mode === "in" ? "Welcome back" : "Create account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Continue with a social account, your phone number or email.</p>
        </div>

        {/* Social sign-in options */}
        <div className="grid gap-2">
          {(["google", "apple", "microsoft"] as Provider[]).map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => signInWithProvider(p)}
              className="w-full justify-center gap-2"
            >
              <ProviderIcon provider={p} />
              Continue with {PROVIDER_LABELS[p]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Email / Phone switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border p-1 text-sm">
          {(["email", "phone"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={channel === c}
              onClick={() => { setChannel(c); setCodeSent(false); setCode(""); }}
              className={`rounded-md px-3 py-1.5 ${channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {c === "email" ? "Email & password" : "Phone (SMS code)"}
            </button>
          ))}
        </div>

        {channel === "email" ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" required minLength={6} placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
            <button type="button" className="w-full text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {!codeSent ? (
              <form onSubmit={sendCode} className="space-y-3">
                <Input
                  type="tel"
                  required
                  placeholder="Phone number with country code, e.g. +923001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Button className="w-full" disabled={busy}>{busy ? "Sending…" : "Send SMS code"}</Button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-3">
                <p className="text-sm text-muted-foreground">Code sent to {phone}. It may take a minute to arrive.</p>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-[0.4em]"
                />
                <Button className="w-full" disabled={busy}>{busy ? "Checking…" : "Verify and sign in"}</Button>
                <button type="button" className="w-full text-sm text-primary" onClick={() => { setCodeSent(false); setCode(""); }}>
                  Wrong number? Change it
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
