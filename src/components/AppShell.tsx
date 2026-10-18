import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Languages, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);
  if (loading || !session) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <Languages className="h-5 w-5 text-primary" /> AllLang
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link to="/app" className="text-muted-foreground [&.active]:font-semibold [&.active]:text-foreground">Studio</Link>
            <Link to="/history" className="text-muted-foreground [&.active]:font-semibold [&.active]:text-foreground">History</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{session.user.email}</span>
            <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}
