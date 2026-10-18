import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  token: z.string().min(10),
  mode: z.enum(["translate", "grammar", "speaking", "chat"]),
  text: z.string().max(5000).default(""),
  source: z.string().max(10).default("auto"),
  target: z.string().max(10).default("en"),
  expected: z.string().max(2000).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
});

const hits = new Map<string, number[]>();
function rateLimit(id: string) {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 30) throw new Error("Too many requests. Please wait a minute.");
  arr.push(now);
  hits.set(id, arr);
}

export const runAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const sbUrl = process.env["SUPABASE_URL"];
    const sbKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!sbUrl || !sbKey) throw new Error("The backend isn't configured on the server.");
    const u = await fetch(`${sbUrl}/auth/v1/user`, { headers: { apikey: sbKey, Authorization: `Bearer ${data.token}` } });
    if (!u.ok) throw new Error("Please sign in again.");
    const user = (await u.json()) as { id: string };
    rateLimit(user.id);

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured: LOVABLE_API_KEY is missing on the server.");

    let system = "";
    let prompt = data.text;
    if (data.mode === "translate") {
      system = `You are a precise translator. Translate the user's text ${data.source === "auto" ? "(auto-detect the source language)" : `from ${data.source}`} into language code "${data.target}". Translate the COMPLETE text. Keep every name, number and punctuation. Reply ONLY in this format:\nDETECTED: <ISO 639-1 code of source>\n<translation>`;
    } else if (data.mode === "grammar") {
      system = `You are a friendly language teacher. For the user's sentence (language "${data.target}"): 1) give the corrected sentence, 2) explain each mistake simply, 3) suggest 3 useful vocabulary words, 4) give 2 more natural alternatives. Use short headings and bullet points. Reply in English.`;
    } else if (data.mode === "speaking") {
      system = `You are a speaking coach. Compare the learner's speech-recognition transcript with the target sentence (language "${data.target}"). List missing or wrong words, grammar issues and likely pronunciation trouble spots inferred from recognition differences (state these are estimates, not precise scoring). Give an encouraging tip. Be short. Reply in English.`;
      prompt = `Target: ${data.expected}\nTranscript: ${data.text}`;
    } else {
      system = `You are a friendly conversation partner helping someone practice language "${data.target}". Reply ONLY in that language, in 1-3 short sentences, natural and simple. Keep the conversation going with a question. If the user made a clear mistake, add one line at the end starting with "💡" explaining it in English.`;
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const messages =
      data.mode === "chat"
        ? [...(data.history ?? []), { role: "user" as const, content: prompt }]
        : [{ role: "user" as const, content: prompt }];
    try {
      const result = streamText({
        model: openai.responses("openai/gpt-6-astra"),
        system,
        messages,
        maxRetries: 0,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      const text = (await result.text).trim();
      if (data.mode === "translate") {
        const m = text.match(/^DETECTED:\s*([a-zA-Z-]+)\s*\n?([\s\S]*)$/);
        return { text: m ? (m[2] ?? "").trim() : text, detected: m ? (m[1] ?? "").toLowerCase() : data.source };
      }
      return { text, detected: null as string | null };
    } catch (e: any) {
      const s = e?.statusCode ?? e?.status;
      if (s === 429) throw new Error("AI is busy right now. Please retry in a moment.");
      if (s === 402) throw new Error("AI credits are used up. Add credits in workspace settings.");
      throw new Error("AI request failed. Please retry.");
    }
  });
