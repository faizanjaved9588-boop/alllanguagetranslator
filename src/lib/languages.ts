export const LANGUAGES: { code: string; name: string; speech: string }[] = [
  ["en", "English", "en-US"], ["ur", "Urdu", "ur-PK"], ["hi", "Hindi", "hi-IN"], ["ar", "Arabic", "ar-SA"],
  ["es", "Spanish", "es-ES"], ["fr", "French", "fr-FR"], ["de", "German", "de-DE"], ["it", "Italian", "it-IT"],
  ["pt", "Portuguese", "pt-BR"], ["ru", "Russian", "ru-RU"], ["zh", "Chinese", "zh-CN"], ["ja", "Japanese", "ja-JP"],
  ["ko", "Korean", "ko-KR"], ["tr", "Turkish", "tr-TR"], ["fa", "Persian", "fa-IR"], ["bn", "Bengali", "bn-IN"],
  ["pa", "Punjabi", "pa-IN"], ["id", "Indonesian", "id-ID"], ["nl", "Dutch", "nl-NL"], ["pl", "Polish", "pl-PL"],
  ["sv", "Swedish", "sv-SE"], ["el", "Greek", "el-GR"], ["he", "Hebrew", "he-IL"], ["th", "Thai", "th-TH"],
  ["vi", "Vietnamese", "vi-VN"], ["uk", "Ukrainian", "uk-UA"], ["ms", "Malay", "ms-MY"], ["sw", "Swahili", "sw-KE"],
].map(([code, name, speech]) => ({ code, name, speech }));

export const langName = (c?: string | null) => LANGUAGES.find((l) => l.code === c)?.name ?? c ?? "Auto";
export const speechCode = (c: string) => LANGUAGES.find((l) => l.code === c)?.speech ?? c;
