import "server-only";
import { headers } from "next/headers";
import vi from "@/locales/vi.json";
import en from "@/locales/en.json";

export type Locale = "vi" | "en";
export type TranslationKey = keyof typeof vi;
export type Dictionary = Record<TranslationKey, string>;
const dictionaries: Record<Locale, Dictionary> = { vi, en };
export async function getLocale(): Promise<Locale> {
  return (await headers()).get("x-sh-locale") === "en" ? "en" : "vi";
}
export function dictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
export function localized(path: string, locale: Locale) {
  const [route, hash] = path.split("#");
  return `${route}${route.includes("?") ? "&" : "?"}lang=${locale}${hash ? `#${hash}` : ""}`;
}
export async function pageMetadata(
  kind: "home" | "app" | "error" | "features",
) {
  const locale = await getLocale();
  const t = dictionary(locale);
  return {
    title: t[`meta.${kind}.title`],
    description: t[`meta.${kind}.description`],
    openGraph: {
      title: t[`meta.${kind}.title`],
      description: t[`meta.${kind}.description`],
      locale: locale === "vi" ? "vi_VN" : "en_US",
      type: "website" as const,
    },
  };
}
