import { createFileRoute, Link } from "@tanstack/react-router";
import { Languages, Mic, Volume2, MessageCircle, SpellCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "All Language Translator & Editor — translate, speak, learn" },
      { name: "description", content: "Translate between 28 languages, hear it aloud, practice speaking and chat with an AI partner." },
      { property: "og:title", content: "All Language Translator & Editor" },
      { property: "og:description", content: "AI translation, voice practice and a conversation partner in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  [Languages, "Translate", "Auto-detect and translate whole passages, keeping names and numbers."],
  [Mic, "Speak", "Dictate with your microphone and edit before translating."],
  [Volume2, "Listen", "Hear translations read aloud in the right language."],
  [SpellCheck, "Correct", "Grammar fixes, vocabulary and better phrasings, explained simply."],
  [MessageCircle, "Converse", "Practice real conversations with an AI partner."],
  [BarChart3, "Track", "Your history and progress, saved across devices."],
] as const;

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-display text-xl font-bold">
          <Languages className="h-6 w-6 text-primary" /> AllLang
        </span>
        <Button asChild variant="outline" size="sm"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">All Language Translator & Editor</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Say it in any language. <span className="text-primary">Then learn to say it yourself.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">Translate, listen, practice speaking and get friendly AI feedback — all in one simple studio.</p>
        <Button asChild size="lg" className="mt-8"><Link to="/auth">Start free</Link></Button>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([Icon, t, d]) => (
          <div key={t} className="rounded-xl border bg-card p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-xl font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
