import { notFound } from "next/navigation";
import MatchPreview from "./MatchPreview";

export const metadata = {
  title: "Match design preview",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Development-only access to real components in otherwise hard-to-reach states. */
export default function MatchPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MatchPreview />;
}
