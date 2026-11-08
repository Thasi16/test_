import { dictionary, getLocale, pageMetadata } from "@/lib/i18n";
import { ImmersiveMotion } from "@/components/landing/immersive/motion";
import {
  ImmersiveHero,
  EmotionalStory,
  InteractiveJourney,
  FeatureBento,
  EmotionalStage,
  FinalInvitation,
} from "@/components/landing/immersive/sections";
import "@/styles/immersive.css";

export async function generateMetadata() {
  const metadata = await pageMetadata("home");
  const title = dictionary(await getLocale())["immersive.meta.title"];
  return { ...metadata, title, openGraph: { ...metadata.openGraph, title } };
}
export default async function Home() {
  const locale = await getLocale();
  return (
    <ImmersiveMotion
      pause={dictionary(locale)["immersive.motion.pause"]}
      resume={dictionary(locale)["immersive.motion.resume"]}
    >
      <ImmersiveHero locale={locale} />
      <EmotionalStory locale={locale} />
      <InteractiveJourney locale={locale} />
      <FeatureBento locale={locale} />
      <EmotionalStage locale={locale} />
      <FinalInvitation locale={locale} />
    </ImmersiveMotion>
  );
}
