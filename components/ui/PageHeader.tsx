import type { ReactNode } from "react";

/** Standard page heading used across workspace, supplier, and admin pages. */
export default function PageHeader({ eyebrow, title, description, actions, children }: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return <header className="page-header">
    <div className="page-header-copy">
      <span className="page-header-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>;
}
