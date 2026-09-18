import type { ReactNode } from "react";

/** Placeholder shown when a list or table has nothing to display. */
export default function EmptyState({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return <div className="empty-panel">
    <span className="empty-panel-icon">{icon}</span>
    <strong>{title}</strong>
    {description && <p>{description}</p>}
    {children}
  </div>;
}
