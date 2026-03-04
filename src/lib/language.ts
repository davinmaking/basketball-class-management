/**
 * Detect language preference from a person's name.
 * If the name contains CJK characters, returns "zh" (Chinese).
 * Otherwise returns "ms" (Bahasa Malaysia).
 */
export function detectLanguage(name: string): "zh" | "ms" {
  return /[\u4e00-\u9fff]/.test(name) ? "zh" : "ms";
}

/**
 * Get display label for a language code.
 */
export function getLanguageLabel(lang: string | null): string {
  switch (lang) {
    case "zh":
      return "中文";
    case "ms":
      return "BM";
    default:
      return "BM";
  }
}
