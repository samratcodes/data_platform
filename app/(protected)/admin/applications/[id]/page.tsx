import type { Metadata } from "next";
import ApplicationReview from "@/components/admin/ApplicationReview";
import { requireAccess } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Application review" };

export default async function ApplicationReviewPage({ params }: PageProps<"/admin/applications/[id]">) {
  const { id } = await params;
  await requireAccess(`/admin/applications/${id}`);
  return <ApplicationReview key={id} id={id}/>;
}
