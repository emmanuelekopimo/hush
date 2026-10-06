import type { ReactNode } from "react";
import type { SecretStatus } from "@/lib/rotation";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="field-error" role="alert">
      {message}
    </span>
  );
}

export function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

export function errorProps(name: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};
}

const STATUS_TEXT: Record<SecretStatus, string> = { ok: "Healthy", due: "Due soon", overdue: "Overdue", expired: "Expired" };

export function StatusBadge({ status, title }: { status: SecretStatus; title?: string }) {
  return (
    <span className={`badge ${status}`} title={title}>
      <span className="dot" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Empty({ art, title, children }: { art: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <img src={art} alt="" />
      <strong style={{ color: "var(--text)" }}>{title}</strong>
      {children}
    </div>
  );
}

export function PageHead({ title, sub, crumbs, children }: { title: string; sub?: string; crumbs?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
