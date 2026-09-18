type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const tones: Record<string, Tone> = {
  pending: "warning", reviewing: "warning", contacted: "warning", draft: "neutral",
  approved: "success", accepted: "success", qualified: "success", verified: "success", physical: "success", online: "info",
  rejected: "danger", declined: "danger",
  new: "info", closed: "neutral", unverified: "neutral",
};
const labels: Record<string, string> = { approved: "Approved", pending: "Pending review", rejected: "Rejected", physical: "Physically verified", online: "Online verified", unverified: "Unverified" };

/** A consistent pill for review, request, and lead statuses. */
export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className="status-badge" data-tone={tones[status] ?? "neutral"}>{label ?? labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
