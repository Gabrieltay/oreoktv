export const PAGE_SIZE = 8;

/**
 * Language filter options. The KTV takes different values on different
 * servlets for the same human concept:
 *   - /SearchServlet `lang` uses language labels (国语 / 粤语 / ...)
 *   - /SingerServlet `singerType` uses region labels (大陆 / 港台 / 英语 / 日本 / 韩国)
 * We keep both values on each entry and pick the right one at the call site.
 * `value` (the `lang` value) is also used as the UI state key.
 */
export const LANGUAGES = [
  { value: "国语", singerType: "大陆", label: "Mandarin" },
  { value: "粤语", singerType: "港台", label: "Cantonese" },
  { value: "英语", singerType: "英语", label: "English" },
  { value: "日语", singerType: "日本", label: "Japanese" },
  { value: "韩语", singerType: "韩国", label: "Korean" },
] as const;
export type Language = (typeof LANGUAGES)[number]["value"];

/** Translate a `lang` value to the equivalent `singerType` for SingerServlet. */
export function langToSingerType(lang: string): string {
  if (!lang) return "全部";
  const entry = LANGUAGES.find((l) => l.value === lang);
  return entry?.singerType ?? "全部";
}
