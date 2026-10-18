import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Copy, Mic, Square, Volume2, Pause, Play, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell, getToken } from "@/components/AppShell";
import { LangSelect } from "@/components/LangSelect";
import { useRecognition, useTTS } from "@/hooks/useSpeech";
import { runAI } from "@/lib/ai.functions";
import { supabase } from "@/lib/supabase";
import { langName } from "@/lib/languages";

type Search = { text?: string | undefined; target?: string | undefined; translated?: string | undefined };
export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    text: s["text"] as string | undefined, target: s["target"] as string | undefined, translated: s["translated"] as string | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Studio — All Language Translator" },
      { name: "description", content: "Translate, practice speaking, correct grammar and chat with an AI partner." },
      { property: "og:title", content: "Studio — All Language Translator" },
      { property: "og:description", content: "Your translation and practice studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Tabs defaultValue="translate">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="translate">Translate</TabsTrigger>
          <TabsTrigger value="practice">Speaking</TabsTrigger>
          <TabsTrigger value="grammar">Grammar</TabsTrigger>
          <TabsTrigger value="chat">Conversation</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <TabsContent value="translate"><Translator /></TabsContent>
        <TabsContent value="practice"><Practice /></TabsContent>
        <TabsContent value="grammar"><Grammar /></TabsContent>
        <TabsContent value="chat"><Chat /></TabsContent>
        <TabsContent value="progress"><Progress /></TabsContent>
      </Tabs>
    </AppShell>
  ),
});

type AIArgs = { mode: "translate" | "grammar" | "speaking" | "chat"; text: string; source?: string; target: string; expected?: string; history?: { role: "user" | "assistant"; content: string }[] };
async function ai(args: AIArgs) {
  return runAI({ data: { ...args, token: await getToken() } as any });
}
async function uid() { return (await supabase.auth.getUser()).data.user!.id; }

const statusLabel = { idle: "", listening: "Listening… speak freely, press Stop when done", processing: "Processing…", completed: "Completed", error: "" };

function Translator() {
  const s = Route.useSearch();
  const [src, setSrc] = useState("auto");
  const [tgt, setTgt] = useState(s.target ?? "ur");
  const [text, setText] = useState(s.text ?? "");
  const [out, setOut] = useState(s.translated ?? "");
  const [detected, setDetected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const tts = useTTS();

  const translate = useCallback(async (t: string) => {
    if (!t.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await ai({ mode: "translate", text: t, source: src, target: tgt });
      setOut(r.text); setDetected(r.detected);
      const { error } = await supabase.from("translation_history").insert({
        user_id: await uid(), original_text: t, source_language: r.detected ?? src, target_language: tgt, translated_text: r.text,
      });
      if (error) toast.error("Translated, but couldn't save to history: " + error.message);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }, [src, tgt, busy]);

  const mic = useRecognition(useCallback((t: string) => { setText(t); translate(t); }, [translate]));
  const listening = mic.status === "listening";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <LangSelect value={src} onChange={setSrc} auto />
          <Button size="icon" variant="ghost" title="Swap" onClick={() => { if (src !== "auto") { setSrc(tgt); setTgt(src); } else if (detected) { setSrc(tgt); setTgt(detected); } setText(out); setOut(text); }}><ArrowLeftRight className="h-4 w-4" /></Button>
          <LangSelect value={tgt} onChange={setTgt} />
        </div>
        <Textarea rows={8} value={listening ? mic.live : text} readOnly={listening} onChange={(e) => setText(e.target.value)} placeholder="Type or press the mic…" maxLength={5000} />
        <div className="mt-1 text-xs text-muted-foreground">{text.length}/5000 {statusLabel[mic.status]}</div>
        {mic.error && <p className="mt-1 text-sm text-destructive">{mic.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {listening
            ? <Button variant="destructive" onClick={mic.stop}><Square className="h-4 w-4" /> Stop</Button>
            : <Button variant="secondary" onClick={() => mic.start(src, text)}><Mic className="h-4 w-4" /> Speak</Button>}
          <Button variant="ghost" onClick={() => { setText(""); setOut(""); }}><X className="h-4 w-4" /> Clear</Button>
          <Button className="ml-auto" disabled={busy || listening || !text.trim()} onClick={() => translate(text)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Translate
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-secondary p-4">
        <div className="mb-3 text-sm text-muted-foreground">{detected && src === "auto" ? `Detected: ${langName(detected)} → ` : ""}{langName(tgt)}</div>
        <div className="min-h-48 whitespace-pre-wrap text-lg">{busy ? "Translating…" : out || <span className="text-muted-foreground">Translation appears here</span>}</div>
        {err && <p className="mt-2 text-sm text-destructive">{err} <button className="underline" onClick={() => translate(text)}>Retry</button></p>}
        {tts.msg && <p className="mt-2 text-xs text-muted-foreground">{tts.msg}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="outline" disabled={!out} onClick={() => { navigator.clipboard.writeText(out); toast.success("Copied"); }}><Copy className="h-4 w-4" /> Copy</Button>
          <TTSButtons tts={tts} text={out} lang={tgt} />
        </div>
      </div>
    </div>
  );
}

export function TTSButtons({ tts, text, lang }: { tts: ReturnType<typeof useTTS>; text: string; lang: string }) {
  return (
    <>
      <Button variant="outline" disabled={!text} onClick={() => tts.play(text, lang)}><Volume2 className="h-4 w-4" /> Listen</Button>
      {tts.state === "playing" && <Button variant="ghost" size="icon" onClick={tts.pause}><Pause className="h-4 w-4" /></Button>}
      {tts.state === "paused" && <Button variant="ghost" size="icon" onClick={tts.resume}><Play className="h-4 w-4" /></Button>}
      {tts.state !== "idle" && <Button variant="ghost" size="icon" onClick={tts.stop}><Square className="h-4 w-4" /></Button>}
    </>
  );
}

function Feedback({ text }: { text: string }) {
  return text ? <div className="mt-4 whitespace-pre-wrap rounded-lg bg-secondary p-4 text-sm">{text}</div> : null;
}

function Practice() {
  const [lang, setLang] = useState("en");
  const [target, setTarget] = useState("Hi, my name is Faizan. I am from Pakistan. Where are you?");
  const [fb, setFb] = useState("");
  const [busy, setBusy] = useState(false);
  const tts = useTTS();
  const evaluate = useCallback(async (said: string) => {
    setBusy(true);
    try {
      const r = await ai({ mode: "speaking", text: said, expected: target, target: lang });
      setFb(r.text);
      const user_id = await uid();
      const { data } = await supabase.from("speaking_sessions").insert({ user_id, language: lang, target_sentence: target, transcript: said }).select("id").single();
      await supabase.from("learning_feedback").insert({ user_id, session_id: data?.id, kind: "speaking", input_text: said, feedback: r.text });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }, [target, lang]);
  const mic = useRecognition(evaluate);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2"><span className="text-sm">Practice language</span><LangSelect value={lang} onChange={setLang} /></div>
      <Textarea rows={2} value={target} onChange={(e) => setTarget(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        <TTSButtons tts={tts} text={target} lang={lang} />
        {mic.status === "listening"
          ? <Button variant="destructive" onClick={mic.stop}><Square className="h-4 w-4" /> Stop</Button>
          : <Button onClick={() => mic.start(lang)} disabled={busy}><Mic className="h-4 w-4" /> Say it</Button>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{statusLabel[mic.status]} {busy && "Getting feedback…"}</p>
      {mic.error && <p className="text-sm text-destructive">{mic.error}</p>}
      {mic.live && <p className="mt-2"><b>You said:</b> {mic.live}</p>}
      <Feedback text={fb} />
      <p className="mt-3 text-xs text-muted-foreground">Pronunciation notes are estimates from speech recognition, not precise scoring.</p>
    </div>
  );
}

function Grammar() {
  const [lang, setLang] = useState("en");
  const [text, setText] = useState("");
  const [fb, setFb] = useState("");
  const [busy, setBusy] = useState(false);
  const mic = useRecognition(useCallback((t: string) => setText(t), []));
  const go = async () => {
    setBusy(true);
    try {
      const r = await ai({ mode: "grammar", text, target: lang });
      setFb(r.text);
      await supabase.from("learning_feedback").insert({ user_id: await uid(), kind: "grammar", input_text: text, feedback: r.text });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3"><LangSelect value={lang} onChange={setLang} /></div>
      <Textarea rows={4} value={mic.status === "listening" ? mic.live : text} readOnly={mic.status === "listening"} onChange={(e) => setText(e.target.value)} placeholder="Write or speak a sentence to check…" maxLength={2000} />
      <div className="mt-3 flex flex-wrap gap-2">
        {mic.status === "listening"
          ? <Button variant="destructive" onClick={mic.stop}><Square className="h-4 w-4" /> Stop</Button>
          : <Button variant="secondary" onClick={() => mic.start(lang, text)}><Mic className="h-4 w-4" /> Speak</Button>}
        <Button disabled={busy || !text.trim()} onClick={go}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Check grammar</Button>
      </div>
      {mic.error && <p className="mt-1 text-sm text-destructive">{mic.error}</p>}
      <Feedback text={fb} />
    </div>
  );
}

type Msg = { role: "user" | "assistant"; content: string };
function Chat() {
  const [lang, setLang] = useState("es");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const tts = useTTS();
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("conversation_history").select("role,content").eq("language", lang).order("created_at").limit(50);
      if (error) { toast.error("Couldn't load past messages: " + error.message); setMsgs([]); return; }
      setMsgs((data as Msg[]) ?? []);
    })();
  }, [lang]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [msgs]);
  const send = async () => {
    const t = input.trim(); if (!t || busy) return;
    const history = msgs.slice(-12);
    setMsgs((m) => [...m, { role: "user", content: t }]); setInput(""); setBusy(true);
    try {
      const r = await ai({ mode: "chat", text: t, target: lang, history });
      setMsgs((m) => [...m, { role: "assistant", content: r.text }]);
      const user_id = await uid();
      await supabase.from("conversation_history").insert([
        { user_id, role: "user", content: t, language: lang }, { user_id, role: "assistant", content: r.text, language: lang },
      ]);
    } catch (e: any) { toast.error(e.message); setInput(t); setMsgs((m) => m.slice(0, -1)); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2"><span className="text-sm">Practice in</span><LangSelect value={lang} onChange={setLang} /></div>
      <div className="h-96 space-y-3 overflow-y-auto rounded-lg bg-muted p-3">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">Say hello in {langName(lang)} to start.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-lg bg-primary p-3 text-primary-foreground" : "max-w-[80%] whitespace-pre-wrap"}>
            {m.content}
            {m.role === "assistant" && <button className="ml-2 align-middle text-muted-foreground" onClick={() => tts.play(m.content.split("💡")[0] ?? "", lang)}><Volume2 className="inline h-4 w-4" /></button>}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Typing…</p>}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message…" maxLength={2000} />
        <Button disabled={busy}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function Progress() {
  const [c, setC] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const tables = ["translation_history", "speaking_sessions", "learning_feedback", "conversation_history"];
      const res = await Promise.all(tables.map((t) => supabase.from(t).select("id", { count: "exact", head: true })));
      setC(Object.fromEntries(tables.map((t, i) => [t, res[i]?.count ?? 0])));
    })();
  }, []);
  const items = [["Translations", c["translation_history"]], ["Speaking sessions", c["speaking_sessions"]], ["Feedback received", c["learning_feedback"]], ["Chat messages", c["conversation_history"]]];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([l, n]) => (
        <div key={l as string} className="rounded-xl border bg-card p-6">
          <div className="font-display text-4xl font-bold text-primary">{n ?? "–"}</div>
          <div className="mt-1 text-sm text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}
