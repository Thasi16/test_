import { getLocale, dictionary, pageMetadata } from "@/lib/i18n";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import NotFound from "./not-found";
import { manrope } from "@/lib/fonts";
import "@/styles/globals.css";

// Route-level 404s must include real HTML even before hydration.
export async function generateMetadata() {
  return pageMetadata("error");
}
export default async function GlobalNotFound() {
  const locale = await getLocale();
  return (
    <html lang={locale} className={manrope.variable}>
      <body>
        <a className="skip-link" href="#main">
          {dictionary(locale)["a11y.skip"]}
        </a>
        <Header locale={locale} />
        <NotFound />
        <Footer locale={locale} />
      </body>
    </html>
  );
}
