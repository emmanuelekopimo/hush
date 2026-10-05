import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Trash2, Upload, Plus, AlertCircle } from "lucide-react";
import { getDb } from "@/db";
import { getToday } from "@/lib/dates";
import { diffKeys } from "@/lib/envfile";
import { ENVIRONMENTS } from "@/lib/validation";
import { Empty, PageHead, StatusBadge } from "@/components/ui";
import { SecretValue } from "@/components/reveal";
import { createSecretAction, deleteProjectAction, importEnvAction } from "@/app/actions/vault";
import { vaultKey } from "@/server/keys";
import { requireUser } from "@/server/session";
import { environmentCounts, getProject, keysByEnvironment, listSecrets } from "@/server/vault";
import { SecretForm } from "./secret-form";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const projectId = Number(id);
  const db = getDb();
  const project = await getProject(db, user.id, projectId);
  if (!project) notFound();

  const env = (ENVIRONMENTS as readonly string[]).includes(String(sp.env)) ? String(sp.env) : "production";
  const today = getToday();
  const [secrets, counts, keys] = await Promise.all([
    listSecrets(db, user.id, projectId, env, vaultKey(), today),
    environmentCounts(db, user.id, projectId),
    keysByEnvironment(db, user.id, projectId),
  ]);
  const compareTo = env === "production" ? "staging" : "production";
  const diff = diffKeys(keys[env] ?? [], keys[compareTo] ?? []);

  return (
    <>
      <PageHead
        title={project.name}
        sub={project.description || undefined}
        crumbs={<><Link href="/projects">Projects</Link><span>/</span><span>{project.name}</span></>}
      >
        <a href={`/api/projects/${project.id}/export?env=${env}`} className="btn" download>
          <Download size={16} /> Export .env
        </a>
      </PageHead>

      <div className="row" style={{ marginBottom: 16 }}>
        <nav className="tabs" aria-label="Environments">
          {ENVIRONMENTS.map((e) => (
            <Link key={e} href={`/projects/${project.id}?env=${e}`} className="tab" aria-current={e === env ? "page" : undefined}>
              {e} <span className="count">{counts[e] ?? 0}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="split wide">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Variables in {env}</h2>
                <p>Values are encrypted. Revealing one is recorded in the activity log.</p>
              </div>
            </div>
            {secrets.length === 0 ? (
              <Empty art="/illustrations/empty-box.svg" title={`No variables in ${env}`}>Add one with the form, or import a .env file.</Empty>
            ) : (
              <table className="secret-table" data-testid="secret-table">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Key</th>
                    <th>Value</th>
                    <th style={{ width: 128 }}>Status</th>
                    <th style={{ width: 54 }} />
                  </tr>
                </thead>
                <tbody>
                  {secrets.map((s) => (
                    <tr key={s.id} data-testid="secret-row">
                      <td>
                        <div className="secret-key">{s.key}</div>
                        {s.note && <div className="secret-note">{s.note}</div>}
                        <div className="row" style={{ gap: 6, marginTop: 4 }}>
                          <span className="tiny dim">v{s.version}</span>
                          {s.reused && <span className="badge info" title="The same value is used by another secret">Reused</span>}
                        </div>
                      </td>
                      <td><SecretValue id={s.id} masked={s.masked} /></td>
                      <td>
                        <StatusBadge status={s.rotation.status} />
                        <div className="tiny muted" style={{ marginTop: 4 }}>{s.rotation.label}</div>
                      </td>
                      <td>
                        <div className="actions">
                          <Link href={`/projects/${project.id}/secrets/${s.id}`} className="btn btn-icon btn-sm" aria-label={`Edit ${s.key}`}>
                            <Pencil size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(diff.onlyLeft.length > 0 || diff.onlyRight.length > 0) && (
            <div className="card" data-testid="env-diff">
              <div className="card-head">
                <div>
                  <h2>Compared with {compareTo}</h2>
                  <p>Key names only. Values are never compared in the clear.</p>
                </div>
                <AlertCircle size={18} className="muted" />
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {diff.onlyRight.length > 0 && (
                  <div className="small">
                    <span className="muted">Missing in {env}: </span>
                    {diff.onlyRight.map((k) => <code key={k} style={{ marginRight: 8 }}>{k}</code>)}
                  </div>
                )}
                {diff.onlyLeft.length > 0 && (
                  <div className="small">
                    <span className="muted">Only in {env}: </span>
                    {diff.onlyLeft.map((k) => <code key={k} style={{ marginRight: 8 }}>{k}</code>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h2><Plus size={16} style={{ verticalAlign: -2 }} /> Add a secret</h2></div>
            <SecretForm action={createSecretAction.bind(null, project.id)} environment={env} />
          </div>
          <details className="card disclosure">
            <summary className="row" style={{ justifyContent: "space-between" }}>
              <h2><Upload size={16} style={{ verticalAlign: -2 }} /> Import a .env file</h2>
              <span className="tiny muted">Show</span>
            </summary>
            <div style={{ marginTop: 14 }}>
              <ImportForm action={importEnvAction.bind(null, project.id)} environment={env} />
            </div>
          </details>
          <form action={deleteProjectAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <button className="btn btn-danger btn-sm"><Trash2 size={14} /> Delete project</button>
          </form>
        </div>
      </div>
    </>
  );
}
