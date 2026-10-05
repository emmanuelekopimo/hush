"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getNow, getToday } from "@/lib/dates";
import { parseEnv } from "@/lib/envfile";
import { fieldErrors, importSchema, projectSchema, secretSchema, shareSchema, type FormState } from "@/lib/validation";
import { vaultKey } from "@/server/keys";
import { clientIp, requireUser } from "@/server/session";
import { createShare, revokeShare } from "@/server/shares";
import { createProject, createSecret, deleteProject, deleteSecret, getSecret, importEntries, revealSecret, updateSecret } from "@/server/vault";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export async function createProjectAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = { name: str(fd, "name"), description: str(fd, "description") };
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const res = await createProject(getDb(), user.id, parsed.data, await clientIp());
  if (!res.ok) return { errors: { name: res.error }, values: raw };
  redirect(`/projects/${res.project.id}`);
}

export async function deleteProjectAction(fd: FormData) {
  const user = await requireUser();
  await deleteProject(getDb(), user.id, Number(str(fd, "projectId")), await clientIp());
  redirect("/projects");
}

export async function createSecretAction(projectId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = {
    key: str(fd, "key"),
    value: str(fd, "value"),
    environment: str(fd, "environment"),
    note: str(fd, "note"),
    rotationDays: str(fd, "rotationDays"),
    expiresOn: str(fd, "expiresOn"),
  };
  const parsed = secretSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { ...raw, value: "" } };
  const res = await createSecret(getDb(), user.id, projectId, parsed.data, vaultKey(), getToday(), await clientIp());
  if (!res.ok) return { errors: { [res.field ?? "form"]: res.error }, values: { ...raw, value: "" } };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: `${parsed.data.key} saved to ${parsed.data.environment}` };
}

export async function updateSecretAction(secretId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const existing = await getSecret(getDb(), user.id, secretId);
  if (!existing) return { message: "Secret not found" };
  const raw = {
    key: existing.key,
    environment: existing.environment,
    value: str(fd, "value") || "unchanged",
    note: str(fd, "note"),
    rotationDays: str(fd, "rotationDays"),
    expiresOn: str(fd, "expiresOn"),
  };
  const parsed = secretSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { ...raw, value: "" } };
  const newValue = str(fd, "value");
  const res = await updateSecret(
    getDb(),
    user.id,
    secretId,
    { value: newValue || undefined, note: parsed.data.note, rotationDays: parsed.data.rotationDays, expiresOn: parsed.data.expiresOn },
    vaultKey(),
    getToday(),
    await clientIp(),
  );
  if (!res.ok) return { message: res.error };
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true, message: res.rotated ? "New value saved. Rotation clock restarted." : "Changes saved" };
}

export async function deleteSecretAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "secretId"));
  const s = await getSecret(getDb(), user.id, id);
  await deleteSecret(getDb(), user.id, id, await clientIp());
  redirect(s ? `/projects/${s.projectId}?env=${s.environment}` : "/projects");
}

export async function revealSecretAction(secretId: number): Promise<{ ok: boolean; value?: string }> {
  const user = await requireUser();
  const value = await revealSecret(getDb(), user.id, secretId, vaultKey(), await clientIp());
  return value === null ? { ok: false } : { ok: true, value };
}

export async function importEnvAction(projectId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = { environment: str(fd, "environment"), content: str(fd, "content"), overwrite: fd.get("overwrite") === "on" };
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { environment: raw.environment, content: raw.content } };
  const { entries, errors } = parseEnv(parsed.data.content);
  if (errors.length) {
    return { errors: { content: `Line ${errors[0].line}: ${errors[0].message}` }, values: { environment: raw.environment, content: raw.content } };
  }
  if (!entries.length) return { errors: { content: "No variables found" }, values: { environment: raw.environment, content: raw.content } };
  const res = await importEntries(getDb(), user.id, projectId, parsed.data.environment, entries, parsed.data.overwrite, vaultKey(), getToday(), await clientIp());
  if (!res.ok) return { message: res.error };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: `${res.added} added, ${res.updated} updated, ${res.skipped} skipped` };
}

export interface ShareState extends FormState {
  url?: string;
}

export async function createShareAction(_: ShareState, fd: FormData): Promise<ShareState> {
  const user = await requireUser();
  const raw = { secretId: str(fd, "secretId"), expiry: str(fd, "expiry"), maxViews: str(fd, "maxViews") };
  const parsed = shareSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const res = await createShare(getDb(), user.id, parsed.data, vaultKey(), getNow(), await clientIp());
  if (!res.ok) return { errors: { secretId: res.error }, values: raw };
  revalidatePath("/shares");
  return { ok: true, url: `/s/${res.token}`, message: "Link created. Copy it now. It will not be shown again." };
}

export async function revokeShareAction(fd: FormData) {
  const user = await requireUser();
  await revokeShare(getDb(), user.id, Number(str(fd, "shareId")), getNow(), await clientIp());
  revalidatePath("/shares");
}
