"use client";

import { useActionState } from "react";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "@/lib/validation";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function EditSecretForm({ action, initial }: { action: Action; initial: { note: string; rotationDays: number; expiresOn: string | null } }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.errors ?? {};
  const v = state.values;
  return (
    <form action={formAction} className="form" noValidate data-testid="edit-form">
      {state.message && <div className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</div>}
      <Field label="New value (leave empty to keep the current one)" name="value" error={e.value}>
        <textarea id="value" name="value" className="textarea" style={{ minHeight: 70 }} placeholder="Paste the rotated value" autoComplete="off" spellCheck={false} />
      </Field>
      <div className="form-row">
        <Field label="Rotate every (days)" name="rotationDays" error={e.rotationDays}>
          <input id="rotationDays" name="rotationDays" type="number" inputMode="numeric" min={1} className="input" defaultValue={v?.rotationDays ?? String(initial.rotationDays)} {...errorProps("rotationDays", e.rotationDays)} />
        </Field>
        <Field label="Expires on (optional)" name="expiresOn" error={e.expiresOn}>
          <input id="expiresOn" name="expiresOn" type="date" className="input" defaultValue={v?.expiresOn ?? initial.expiresOn ?? ""} {...errorProps("expiresOn", e.expiresOn)} />
        </Field>
      </div>
      <Field label="Note" name="note" error={e.note}>
        <input id="note" name="note" className="input" defaultValue={v?.note ?? initial.note} {...errorProps("note", e.note)} />
      </Field>
      <Submit pendingText="Saving...">Save changes</Submit>
    </form>
  );
}
