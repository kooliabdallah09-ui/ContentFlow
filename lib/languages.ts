// Languages the UGC builder supports.
// `code` matches OpenAI Whisper ISO-639-1 codes for transcription hints.
// `name` is what Claude / Sora see in prompts.
// `nativeLabel` is what the user sees in the dropdown — native script per language.

export interface UGCLanguage {
  code: string
  name: string
  nativeLabel: string
}

export const LANGUAGES: UGCLanguage[] = [
  { code: 'en', name: 'English',    nativeLabel: 'English' },
  { code: 'es', name: 'Spanish',    nativeLabel: 'Español' },
  { code: 'fr', name: 'French',     nativeLabel: 'Français' },
  { code: 'de', name: 'German',     nativeLabel: 'Deutsch' },
  { code: 'it', name: 'Italian',    nativeLabel: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeLabel: 'Português' },
  { code: 'nl', name: 'Dutch',      nativeLabel: 'Nederlands' },
  { code: 'pl', name: 'Polish',     nativeLabel: 'Polski' },
  { code: 'ru', name: 'Russian',    nativeLabel: 'Русский' },
  { code: 'tr', name: 'Turkish',    nativeLabel: 'Türkçe' },
  { code: 'ar', name: 'Arabic',     nativeLabel: 'العربية' },
  { code: 'hi', name: 'Hindi',      nativeLabel: 'हिन्दी' },
  { code: 'ja', name: 'Japanese',   nativeLabel: '日本語' },
  { code: 'ko', name: 'Korean',     nativeLabel: '한국어' },
  { code: 'zh', name: 'Chinese',    nativeLabel: '中文' },
  { code: 'id', name: 'Indonesian', nativeLabel: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  { code: 'th', name: 'Thai',       nativeLabel: 'ไทย' },
]

export const DEFAULT_LANGUAGE_CODE = 'en'
export const LANGUAGE_CODES = LANGUAGES.map(l => l.code)

export function getLanguage(code?: string): UGCLanguage {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0]
}
