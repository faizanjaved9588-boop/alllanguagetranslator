import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Volume2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/AppShell";
import { LangSelect } from "@/components/LangSelect";
import { supabase } from "@/lib/supabase";
import { langName } from "@/lib/languages";
import { useTTS } from "@/hooks/useSpeech";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — All Language Translator" },
      { name: "description", content: "Search, replay and manage your saved translations and feedback." },
      { property: "og:title", content: "History — All Language Translator" },
      { property: "og:description", content: "Your saved translations and feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><History /></AppShell>,
});

type Row = { id: string; original_text: string; translated_text: string; source_language: string; target_language: string; created_at: string };
type Fb = { id: string; kind: string; input_text: string; feedback: string; created_at: string };

function History() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fbs, setFbs] = useState<Fb[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [asc, setAsc] = useState(false);
  const tts = useTTS();
  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from("translation_history").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("learning_feedback").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (a.error) toast.error(a.error.message);
    setRows((a.data as Row[]) ?? []); setFbs((b.data as Fb[]) ?? []);
  };
  useEffect(() => { load(); }, []);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    const f = rows.filter((r) => (lang === "all" || r.target_language === lang) && (!s || (r.original_text + r.translated_text).toLowerCase().includes(s)));
    return asc ? [...f].reverse() : f;
  }, [rows, q, lang, asc]);
  const del = async (id: string) => {
    if (!confirm("Delete this translation?")) return;
    const { error } = await supabase.from("translation_history").delete().eq("id", id);
    error ? toast.error(error.message) : setRows((r) => r.filter((x) => x.id !== id));
  };
  const clear = async () => {
    if (!confirm("Delete ALL translation and feedback history? This cannot be undone.")) return;
    const uid = (await supabase.auth.getUser()).data.user!.id;
    await supabase.from("translation_history").delete().eq("user_id", uid);
    await supabase.from("learning_feedback").delete().eq("user_id", uid);
    load();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">History</h1>
        <Input className="w-48" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="all">All languages</option>
        </select>
        {lang !== "all" || true ? <LangSelect value={lang === "all" ? "en" : lang} onChange={setLang} /> : null}
        <Button variant="outline" size="sm" onClick={() => setAsc(!asc)}>{asc ? "Oldest first" : "Newest first"}</Button>
        <Button variant="destructive" size="sm" onClick={clear}>Clear all</Button>
      </div>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">No translations yet.</p>}
        {list.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-xs text-muted-foreground">{langName(r.source_language)} → {langName(r.target_language)} · {new Date(r.created_at).toLocaleString()}</div>
            <p>{r.original_text}</p>
            <p className="mt-1 font-medium text-primary">{r.translated_text}</p>
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => tts.play(r.translated_text, r.target_language)}><Volume2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" asChild><Link to="/app" search={{ text: r.original_text, target: r.target_language, translated: r.translated_text }}><ExternalLink className="h-4 w-4" /></Link></Button>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      {fbs.length > 0 && <>
        <h2 className="mb-3 mt-8 text-2xl font-bold">Feedback</h2>
        <div className="space-y-3">{fbs.map((f) => (
          <details key={f.id} className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm"><b className="capitalize">{f.kind}</b> · {f.input_text?.slice(0, 80)} · <span className="text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span></summary>
            <div className="mt-2 whitespace-pre-wrap text-sm">{f.feedback}</div>
          </details>
        ))}</div>
      </>}
    </div>
  );
}
