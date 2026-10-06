import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { getDb } from "@/db";
import { formatDate, getToday } from "@/lib/dates";
import { rotationStatus } from "@/lib/rotation";
import { PageHead, StatusBadge } from "@/components/ui";
import { SecretValue } from "@/components/reveal";
import { deleteSecretAction, updateSecretAction } from "@/app/actions/vault";
import { requireUser } from "@/server/session";
import { getProject, getSecret } from "@/server/vault";
import { EditSecretForm } from "./edit-form";

export const metadata: Metadata = { title: "Edit secret" };

export default async function SecretPage(props: PageProps<"/projects/[id]/secrets/[secretId]">) {
  const user = await requireUser();
  const { id, secretId } = await props.params;
  const db = getDb();
  const secret = await getSecret(db, user.id, Number(secretId));
  if (!secret || secret.projectId !== Number(id)) notFound();
  const project = await getProject(db, user.id, secret.projectId);
  if (!project) notFound();
  const rotation = rotationStatus(secret, getToday());

  return (
    <>
      <PageHead
        title={secret.key}
        sub={`${project.name} / ${secret.environment}`}
        crumbs={<><Link href="/projects">Projects</Link><span>/</span><Link href={`/projects/${project.id}?env=${secret.environment}`}>{project.name}</Link><span>/</span><span>{secret.key}</span></>}
      >
        <Link href={`/shares?secret=${secret.id}`} className="btn"><Link2 size={16} /> Share once</Link>
      </PageHead>
      <div className="split">
        <div className="card">
          <div className="card-head"><h2>Rotate or edit</h2></div>
          <EditSecretForm action={updateSecretAction.bind(null, secret.id)} initial={{ note: secret.note, rotationDays: secret.rotationDays, expiresOn: secret.expiresOn }} />
        </div>
        <div className="stack">
          <div className="card stack" style={{ gap: 12 }}>
            <h2>Current value</h2>
            <SecretValue id={secret.id} masked={"•".repeat(12)} />
            <div className="list small">
              <div className="list-item"><span className="grow muted">Status</span><StatusBadge status={rotation.status} /></div>
              <div className="list-item"><span className="grow muted">Version</span><span>v{secret.version}</span></div>
              <div className="list-item"><span className="grow muted">Last rotated</span><span>{formatDate(secret.lastRotatedOn)}</span></div>
              <div className="list-item"><span className="grow muted">Next rotation</span><span>{formatDate(rotation.dueOn)}</span></div>
              <div className="list-item"><span className="grow muted">Expires</span><span>{secret.expiresOn ? formatDate(secret.expiresOn) : "Never"}</span></div>
            </div>
          </div>
          <form action={deleteSecretAction}>
            <input type="hidden" name="secretId" value={secret.id} />
            <button className="btn btn-danger btn-sm"><Trash2 size={14} /> Delete secret</button>
          </form>
        </div>
      </div>
    </>
  );
}
