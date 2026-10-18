import { useCallback, useEffect, useRef, useState } from "react";
import { speechCode } from "@/lib/languages";

export type MicStatus = "idle" | "listening" | "processing" | "completed" | "error";

const BLOCKED_MSG =
  "Microphone is blocked. Click the lock/tune icon in the address bar, allow the microphone for this site, then try again.";

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

/** Continuous speech recognition that keeps all final words and auto-restarts until the user stops. */
export function useRecognition(onDone: (text: string) => void) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [live, setLive] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<any>(null);
  const finals = useRef("");
  const stopped = useRef(true);

  // Stop recognition if the component unmounts mid-listen.
  useEffect(() => () => {
    stopped.current = true;
    try { rec.current?.stop(); } catch { /* ignore */ }
  }, []);

  const start = useCallback((lang: string, initial = "") => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome or Edge, or type instead.");
      setStatus("error");
      return;
    }
    finals.current = initial ? initial.trim() + " " : "";
    stopped.current = false;
    setError("");

    const launch = () => {
      const r = new SR();
      r.lang = lang === "auto" ? navigator.language : speechCode(lang);
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finals.current += t.trim() + " ";
          else interim += t;
        }
        setLive((finals.current + interim).trim());
      };
      r.onerror = (e: any) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        stopped.current = true;
        setError(micErrorMessage(e.error));
        setStatus("error");
      };
      r.onend = () => {
        if (!stopped.current) {
          // Recognition stops on its own after silences — restart it until the user presses Stop.
          try { launch(); } catch { /* ignore */ }
          return;
        }
        const text = finals.current.trim() || "";
        setLive(text);
        setStatus("completed");
        if (text) onDone(text);
      };
      rec.current = r;
      try {
        r.start();
      } catch {
        // A previous instance may still be closing; retry once shortly.
        setTimeout(() => { if (!stopped.current) { try { r.start(); } catch { /* ignore */ } } }, 150);
      }
    };

    setLive(initial);
    setStatus("listening");

    // Ask for mic permission first so a denial gives a clear message instead of a silent failure.
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => { stream.getTracks().forEach((t) => t.stop()); if (!stopped.current) launch(); })
        .catch(() => {
          stopped.current = true;
          setError(BLOCKED_MSG);
          setStatus("error");
        });
    } else {
      launch();
    }
  }, [onDone]);

  const stop = useCallback(() => {
    stopped.current = true;
    setStatus((s) => (s === "listening" ? "processing" : s));
    try { rec.current?.stop(); } catch { /* ignore */ }
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
