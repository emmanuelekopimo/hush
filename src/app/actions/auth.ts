"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getNow } from "@/lib/dates";
import { fieldErrors, signInSchema, signUpSchema, type FormState } from "@/lib/validation";
import { recordEvent } from "@/server/audit";
import { clientIp, endSession, getCurrentUser, startSession } from "@/server/session";
import { authenticate, createUser } from "@/server/users";

function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export async function signInAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: raw.email } };

  const result = await authenticate(getDb(), parsed.data.email, parsed.data.password, getNow(), await clientIp());
  if (!result.ok) {
    const message =
      result.reason === "locked"
        ? `Too many failed attempts. Try again in ${result.retryAfterMinutes} minute${result.retryAfterMinutes === 1 ? "" : "s"}.`
        : "Email or password is incorrect";
    return { message, values: { email: raw.email } };
  }
  await startSession(result.user);
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { name: raw.name, email: raw.email } };
  const result = await createUser(getDb(), parsed.data, await clientIp());
  if (!result.ok) return { errors: { email: result.error }, values: { name: raw.name, email: raw.email } };
  await startSession(result.user);
  redirect("/dashboard");
}

export async function signOutAction() {
  const user = await getCurrentUser();
  if (user) await recordEvent(getDb(), { userId: user.id, email: user.email, action: "auth.sign_out", ip: await clientIp() });
  await endSession();
  redirect("/sign-in");
}
