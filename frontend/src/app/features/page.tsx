import { FeatureGuide } from "@/components/features/feature-guide";
import { getLocale, pageMetadata } from "@/lib/i18n";
import "@/styles/features.css";

export async function generateMetadata() {
  return pageMetadata("features");
}

export default async function FeaturesPage() {
  return <FeatureGuide locale={await getLocale()} />;
}
