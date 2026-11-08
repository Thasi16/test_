import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getLocale, dictionary, localized } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
export default async function NotFound() {
  const locale = await getLocale();
  const t = dictionary(locale);
  return (
    <main id="main" className="state-page shell">
      <Image
        src="/assets/mascot.png"
        width={1351}
        height={1164}
        sizes="240px"
        alt={t["a11y.mascot"]}
      />
      <p className="eyebrow">404 · {t["error.eyebrow"]}</p>
      <h1>{t["error.title"]}</h1>
      <p>{t["error.body"]}</p>
      <Button asChild>
        <a href={localized("/", locale)}>
          <ArrowLeft aria-hidden="true" />
          {t["action.home"]}
        </a>
      </Button>
    </main>
  );
}
