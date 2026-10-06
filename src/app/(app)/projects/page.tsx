import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { getToday } from "@/lib/dates";
import { initials } from "@/lib/format";
import { Empty, PageHead } from "@/components/ui";
import { requireUser } from "@/server/session";
import { listProjects } from "@/server/vault";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(getDb(), user.id, getToday());
  return (
    <>
      <PageHead title="Projects" sub="Each project keeps its own development, staging and production variables." />
      <div className="split">
        <div className="grid grid-2">
          {projects.length === 0 && (
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <Empty art="/illustrations/empty-box.svg" title="No projects yet">Create your first project to start adding secrets.</Empty>
            </div>
          )}
          {projects.map((p) => {
            const color = p.health.score >= 80 ? "var(--ok)" : p.health.score >= 50 ? "var(--due)" : "var(--bad)";
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="card project-card" data-testid="project-card">
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <div className="project-mark">{initials(p.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="truncate">{p.name}</h3>
                    <p className="tiny muted truncate">{p.description || "No description"}</p>
                  </div>
                </div>
                <div className="row small muted">
                  <span>{p.secretCount} secrets</span>
                  <span>·</span>
                  <span>{p.environments} environments</span>
                </div>
                <div>
                  <div className="row tiny muted" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Health</span>
                    <span style={{ color }}>{p.health.score}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${p.health.score}%`, background: color }} /></div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="card">
          <div className="card-head"><h2>New project</h2></div>
          <ProjectForm />
        </div>
      </div>
    </>
  );
}
