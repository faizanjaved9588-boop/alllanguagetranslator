import { LANGUAGES } from "@/lib/languages";

export function LangSelect({ value, onChange, auto }: { value: string; onChange: (v: string) => void; auto?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border bg-card px-2 text-sm"
    >
      {auto && <option value="auto">Detect language</option>}
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  );
}
