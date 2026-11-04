export interface Language {
  code: string
  name: string
  script: 'Latin' | 'Cyrillic'
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', script: 'Latin' },
  { code: 'uk', name: 'Ukrainian', script: 'Cyrillic' },
  { code: 'es', name: 'Spanish', script: 'Latin' },
  { code: 'de', name: 'German', script: 'Latin' },
  { code: 'fr', name: 'French', script: 'Latin' },
  { code: 'it', name: 'Italian', script: 'Latin' },
  { code: 'pl', name: 'Polish', script: 'Latin' },
]

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((language) => language.code === code)
}
