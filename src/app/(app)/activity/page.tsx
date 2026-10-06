import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { dateTime } from "@/lib/format";
import { PageHead } from "@/components/ui";
import { ACTION_LABELS, listEvents } from "@/server/audit";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Activity" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "auth", label: "Sign-ins" },
  { value: "secret", label: "Secrets" },
  { value: "share", label: "Share links" },
  { value: "env", label: "Import and export" },
];

export default async function ActivityPage(props: PageProps<"/activity">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const filter = FILTERS.some((f) => f.value === sp.type) ? String(sp.type) : "";
  const events = await listEvents(getDb(), user.id, { action: filter || undefined, limit: 200 });
  const failed = events.filter((e) => !e.success).length;

  return (
    <>
      <PageHead title="Activity" sub="Every sign-in, reveal, export and share is recorded here." />
      <nav className="tabs" aria-label="Filter" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <Link key={f.label} href={f.value ? `/activity?type=${f.value}` : "/activity"} className="tab" aria-current={f.value === filter ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      {failed > 0 && (
        <div className="notice bad" style={{ marginBottom: 16 }}>{failed} failed or blocked sign-in attempt{failed === 1 ? "" : "s"} in this list. Check the IP addresses.</div>
      )}
      <div className="card">
        <table className="secret-table" data-testid="activity-table">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Event</th>
              <th>Target</th>
              <th style={{ width: 140 }}>IP address</th>
              <th style={{ width: 150 }}>When</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`badge ${e.success ? "" : "bad"}`} style={{ marginRight: 8 }}><span className="dot" /></span>
                  <span style={{ color: e.success ? "var(--text)" : "var(--bad)" }}>{ACTION_LABELS[e.action] ?? e.action}</span>
                </td>
                <td>
                  <span className="small">{e.target || "Account"}</span>
                  {e.detail && <div className="tiny muted">{e.detail}</div>}
                </td>
                <td className="mono tiny muted">{e.ip || "local"}</td>
                <td className="tiny muted">{dateTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="muted">No events yet.</p>}
      </div>
    </>
  );
}
