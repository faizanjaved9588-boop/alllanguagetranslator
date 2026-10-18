import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecognition } from "@/hooks/useSpeech";

class Recognition {
  static instances: Recognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
  constructor() { Recognition.instances.push(this); }
  result(text: string, final = true) {
    const result = Object.assign([{ transcript: text }], { isFinal: final });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}
function latest() {
  const instance = Recognition.instances.at(-1);
  if (!instance) throw new Error("Recognition did not start");
  return instance;
}
beforeEach(() => {
  vi.useFakeTimers();
  Recognition.instances = [];
  vi.stubGlobal("SpeechRecognition", Recognition);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Speaking microphone", () => {
  it("keeps blocked access as an error after recognition ends", () => {
    const done = vi.fn();
    const { result } = renderHook(() => useRecognition(done));
    act(() => result.current.start("en"));
    act(() => { latest().onerror?.({ error: "not-allowed" }); latest().onend?.(); });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Microphone is blocked");
    expect(done).not.toHaveBeenCalled();
  });
  it("retains final and interim words on Stop and completes exactly once", () => {
    const done = vi.fn();
    const { result } = renderHook(() => useRecognition(done));
    act(() => result.current.start("en", "Hello"));
    act(() => { latest().result("my name is"); latest().result("Faizan", false); });
    act(() => { result.current.stop(); result.current.stop(); });
    expect(done).toHaveBeenCalledExactlyOnceWith("Hello my name is Faizan");
    expect(result.current.status).toBe("completed");
  });
  it("Stop before any speech never submits or gets stuck", () => {
    const done = vi.fn();
    const { result } = renderHook(() => useRecognition(done));
    act(() => result.current.start("ur"));
    expect(latest().lang).toBe("ur-PK");
    act(() => result.current.stop());
    expect(result.current.status).toBe("completed");
    expect(done).not.toHaveBeenCalled();
  });
  it("restarts after silence but cancels scheduled restarts on Stop", () => {
    const { result } = renderHook(() => useRecognition(vi.fn()));
    act(() => result.current.start("en"));
    act(() => latest().onend?.());
    act(() => vi.advanceTimersByTime(300));
    expect(Recognition.instances).toHaveLength(2);
    act(() => { latest().onend?.(); result.current.stop(); vi.runAllTimers(); });
    expect(Recognition.instances).toHaveLength(2);
  });
  it("uses the current callback after language or sentence changes", () => {
    const first = vi.fn(); const second = vi.fn();
    const { result, rerender } = renderHook(({ done }) => useRecognition(done), { initialProps: { done: first } });
    act(() => result.current.start("en"));
    rerender({ done: second });
    act(() => { latest().result("Hi"); result.current.stop(); });
    expect(second).toHaveBeenCalledExactlyOnceWith("Hi");
    expect(first).not.toHaveBeenCalled();
  });
  it("ignores old events and cleans up on tab unmount", () => {
    const done = vi.fn();
    const { result, unmount } = renderHook(() => useRecognition(done));
    act(() => result.current.start("en"));
    const old = latest();
    act(() => { result.current.stop(); result.current.start("es"); old.result("old text"); });
    expect(result.current.live).toBe("");
    unmount();
    act(() => { latest().onend?.(); vi.runAllTimers(); });
    expect(latest().abort).toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
});