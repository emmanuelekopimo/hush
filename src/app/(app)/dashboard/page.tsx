import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Copy, FolderLock, KeyRound, Link2 } from "lucide-react";
import { getDb } from "@/db";
import { getNow, getToday } from "@/lib/dates";
import { greeting, timeAgo } from "@/lib/format";
import { HealthRing } from "@/components/health-ring";
import { StatusBadge } from "@/components/ui";
import { ACTION_LABELS, listEvents } from "@/server/audit";
import { vaultKey } from "@/server/keys";
import { requireUser } from "@/server/session";
import { listShares } from "@/server/shares";
import { attentionList, listProjects, overallHealth, reusedCount } from "@/server/vault";

export const metadata: Metadata = { title: "Overview" };

export default async function Dashboard() {
  const user = await requireUser();
  const db = getDb();
  const today = getToday();
  const now = getNow();
  const [health, projects, attention, shares, events, reused] = await Promise.all([
    overallHealth(db, user.id, today),
    listProjects(db, user.id, today),
    attentionList(db, user.id, vaultKey(), today),
    listShares(db, user.id, now),
    listEvents(db, user.id, { limit: 6 }),
    reusedCount(db, user.id),
  ]);
  const activeShares = shares.filter((s) => s.status === "active").length;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head" style={{ marginBottom: 4 }}>
        <div>
          <h1>{greeting(now)}, {firstName}</h1>
          <p>Here is the state of your vault today.</p>
        </div>
        <Link href="/projects" className="btn btn-primary">Open projects <ArrowRight size={16} /></Link>
      </div>

      <div className="split">
        <div className="card" data-testid="health-card">
          <div className="row" style={{ gap: 24, flexWrap: "nowrap" }}>
            <HealthRing score={health.score} grade={health.grade} />
            <div className="stack" style={{ gap: 8, minWidth: 0 }}>
              <h2>Vault health</h2>
              <p className="muted small">Based on how many secrets are past their rotation date or expired.</p>
              <div className="row">
                <span className="badge ok"><span className="dot" />{health.ok} healthy</span>
                <span className="badge due"><span className="dot" />{health.due} due</span>
                <span className="badge overdue"><span className="dot" />{health.overdue} overdue</span>
                <span className="badge expired"><span className="dot" />{health.expired} expired</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="card stat"><span className="label"><KeyRound size={15} />Secrets</span><span className="value">{health.total}</span></div>
          <div className="card stat"><span className="label"><FolderLock size={15} />Projects</span><span className="value">{projects.length}</span></div>
          <div className="card stat"><span className="label"><Link2 size={15} />Active links</span><span className="value">{activeShares}</span></div>
          <div className="card stat"><span className="label"><Copy size={15} />Reused values</span><span className="value">{reused}</span></div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <p>Rotate these first.</p>
            </div>
            <AlertTriangle size={18} className="muted" />
          </div>
          {attention.length === 0 ? (
            <p className="muted">Nothing needs attention. Nice work.</p>
          ) : (
            <div className="list" data-testid="attention-list">
              {attention.map((s) => (
                <Link key={s.id} href={`/projects/${s.projectId}/secrets/${s.id}`} className="list-item">
                  <div className="grow">
                    <div className="secret-key truncate">{s.key}</div>
                    <div className="tiny muted truncate">{s.projectName} / {s.environment} · {s.rotation.label}</div>
                  </div>
                  <StatusBadge status={s.rotation.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Recent activity</h2>
            <Link href="/activity" className="small muted">See all</Link>
          </div>
          <div className="list">
            {events.map((e) => (
              <div key={e.id} className="list-item">
                <div className="grow">
                  <div className="small truncate" style={{ color: e.success ? "var(--text)" : "var(--bad)" }}>{ACTION_LABELS[e.action] ?? e.action}</div>
                  <div className="tiny muted truncate">{e.target || e.ip || "Account"}</div>
                </div>
                <span className="tiny dim">{timeAgo(e.createdAt, now)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
