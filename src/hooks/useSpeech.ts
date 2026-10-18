import { useCallback, useRef, useState } from "react";
import { speechCode } from "@/lib/languages";

export type MicStatus = "idle" | "listening" | "processing" | "completed" | "error";

/** Continuous speech recognition that keeps all final words and auto-restarts until the user stops. */
export function useRecognition(onDone: (text: string) => void) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [live, setLive] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<any>(null);
  const finals = useRef("");
  const stopped = useRef(true);

  const start = useCallback((lang: string, initial = "") => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Voice input isn't supported in this browser. Try Chrome or Edge, or type instead."); setStatus("error"); return; }
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
        setError(e.error === "not-allowed" ? "Microphone permission was denied." : `Voice input error: ${e.error}. Your text is kept — you can type instead.`);
        setStatus("error");
      };
      r.onend = () => {
        if (!stopped.current) { try { launch(); } catch { /* ignore */ } return; }
        const text = finals.current.trim() || "";
        setLive(text);
        setStatus("completed");
        if (text) onDone(text);
      };
      rec.current = r;
      r.start();
    };
    setLive(initial);
    setStatus("listening");
    launch();
  }, [onDone]);

  const stop = useCallback(() => {
    stopped.current = true;
    setStatus("processing");
    rec.current?.stop();
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
