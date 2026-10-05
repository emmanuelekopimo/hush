"use client";

import { useActionState } from "react";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import { ENVIRONMENTS, type FormState } from "@/lib/validation";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function SecretForm({ action, environment }: { action: Action; environment: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.errors ?? {};
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <form action={formAction} className="form" noValidate data-testid="secret-form">
      {state.ok && state.message && <div className="notice ok" role="status">{state.message}</div>}
      {e.form && <div className="notice bad" role="alert">{e.form}</div>}
      <div className="form-row">
        <Field label="Key" name="key" error={e.key}>
          <input id="key" name="key" className="input mono" placeholder="API_KEY" autoComplete="off" defaultValue={v.key} {...errorProps("key", e.key)} />
        </Field>
        <Field label="Environment" name="environment" error={e.environment}>
          <select id="environment" name="environment" className="select" defaultValue={v.environment || environment} {...errorProps("environment", e.environment)}>
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>{env}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Value" name="value" error={e.value}>
        <textarea id="value" name="value" className="textarea" style={{ minHeight: 70 }} placeholder="Paste the secret value" autoComplete="off" spellCheck={false} {...errorProps("value", e.value)} />
      </Field>
      <div className="form-row">
        <Field label="Rotate every (days)" name="rotationDays" error={e.rotationDays}>
          <input id="rotationDays" name="rotationDays" type="number" inputMode="numeric" min={1} className="input" defaultValue={v.rotationDays || "90"} {...errorProps("rotationDays", e.rotationDays)} />
        </Field>
        <Field label="Expires on (optional)" name="expiresOn" error={e.expiresOn}>
          <input id="expiresOn" name="expiresOn" type="date" className="input" defaultValue={v.expiresOn} {...errorProps("expiresOn", e.expiresOn)} />
        </Field>
      </div>
      <Field label="Note (optional)" name="note" error={e.note}>
        <input id="note" name="note" className="input" placeholder="Where is this used?" defaultValue={v.note} {...errorProps("note", e.note)} />
      </Field>
      <Submit pendingText="Encrypting...">Save secret</Submit>
    </form>
  );
}
