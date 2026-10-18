import { useCallback, useEffect, useRef, useState } from "react";
import { speechCode } from "@/lib/languages";

export type MicStatus = "idle" | "listening" | "processing" | "completed" | "error";

const BLOCKED_MSG =
  "Microphone is blocked. Allow microphone access in your browser's site settings, then try again. If you are using the embedded preview, open the app in a new tab first.";

function micErrorMessage(err: string): string {
  switch (err) {
    case "not-allowed":
    case "service-not-allowed":
      return BLOCKED_MSG;
    case "audio-capture":
      return "No microphone was found. Plug in a microphone and try again.";
    case "network":
      return "Voice input needs an internet connection. Check your connection and try again.";
    case "language-not-supported":
      return "This language isn't supported for voice input in your browser — try typing instead.";
    default:
      return `Voice input error: ${err}. Your text is kept — you can type instead.`;
  }
}

/** One cancellable recognition session, shared by every speaking input. */
export function useRecognition(onDone: (text: string) => void) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [live, setLive] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<any>(null);
  const finals = useRef("");
  const interim = useRef("");
  const stopped = useRef(true);
  const session = useRef(0);
  const callback = useRef(onDone);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  callback.current = onDone;

  useEffect(() => () => {
    session.current += 1;
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    try { rec.current?.abort(); } catch { /* already closed */ }
  }, []);

  const start = useCallback((lang: string, initial = "") => {
    if (!stopped.current) return;
    const id = ++session.current;
    if (timer.current) clearTimeout(timer.current);
    try { rec.current?.abort(); } catch { /* already closed */ }
    rec.current = null;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setError("");
    setLive(initial);
    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome or Edge, or type instead.");
      setStatus("error");
      return;
    }
    finals.current = initial ? initial.trim() + " " : "";
    interim.current = "";
    stopped.current = false;
    let emptyEnds = 0;
    const fail = (message: string) => {
      if (session.current !== id || stopped.current) return;
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      setError(message);
      setStatus("error");
      const text = (finals.current + interim.current).trim();
      setLive(text);
      // Preserve dictated text without submitting a failed recording.
      try { rec.current?.abort(); } catch { /* already closed */ }
    };

    const launch = () => {
      if (session.current !== id || stopped.current) return;
      const r = new SR();
      r.lang = lang === "auto" ? navigator.language : speechCode(lang);
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e: any) => {
        if (session.current !== id || stopped.current) return;
        emptyEnds = 0;
        let pending = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finals.current += t.trim() + " ";
          else pending += t;
        }
        interim.current = pending;
        setLive((finals.current + pending).trim());
      };
      r.onerror = (e: any) => {
        if (e.error === "no-speech") return;
        fail(micErrorMessage(e.error));
      };
      r.onend = () => {
        if (session.current !== id || stopped.current) return;
        // Some browsers end with an interim result instead of a final one.
        if (interim.current.trim()) {
          finals.current += interim.current.trim() + " ";
          interim.current = "";
        }
        if (!stopped.current) {
          emptyEnds += 1;
          if (emptyEnds > 3) {
            fail("No speech was detected. Check your microphone, move closer, and press Speak to try again.");
          } else {
            timer.current = setTimeout(launch, 300);
          }
        }
      };
      rec.current = r;
      try {
        r.start();
      } catch (e) {
        fail(e instanceof DOMException && e.name === "NotAllowedError"
          ? BLOCKED_MSG
          : "The microphone could not start. Close other voice recordings and press Speak to try again.");
      }
    };

    setStatus("listening");
    // Start directly from the click: recognition requests its own permission.
    // A separate getUserMedia request can lose the required user gesture.
    try { launch(); } catch { fail("The microphone could not start. Press Speak to try again."); }
  }, []);

  const stop = useCallback(() => {
    if (stopped.current) return;
    stopped.current = true;
    session.current += 1;
    if (timer.current) clearTimeout(timer.current);
    const text = (finals.current + interim.current).trim();
    setLive(text);
    setStatus("completed");
    try { rec.current?.stop(); } catch { /* ignore */ }
    rec.current = null;
    if (text) callback.current(text);
  }, []);

  return { status, live, error, start, stop };
}

export function useTTS() {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [msg, setMsg] = useState("");
  const play = (text: string, lang: string) => {
    if (!("speechSynthesis" in window)) { setMsg("Text-to-speech isn't supported in this browser."); return; }
    speechSynthesis.cancel();
    const code = speechCode(lang);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = code;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(code.split("-")[0] ?? code));
    if (voice) u.voice = voice;
    setMsg(voice || speechSynthesis.getVoices().length === 0 ? "" : `No ${code} voice installed — the browser default voice is used.`);
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    speechSynthesis.speak(u);
    setState("playing");
  };
  const pause = () => { speechSynthesis.pause(); setState("paused"); };
  const resume = () => { speechSynthesis.resume(); setState("playing"); };
  const stop = () => { speechSynthesis.cancel(); setState("idle"); };
  return { state, msg, play, pause, resume, stop };
}
