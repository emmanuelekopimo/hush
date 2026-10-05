"use client";

import { useActionState } from "react";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import { ENVIRONMENTS, type FormState } from "@/lib/validation";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function ImportForm({ action, environment }: { action: Action; environment: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.errors ?? {};
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <form action={formAction} className="form" noValidate data-testid="import-form">
      {state.ok && state.message && <div className="notice ok" role="status">{state.message}</div>}
      {state.message && !state.ok && <div className="notice bad" role="alert">{state.message}</div>}
      <Field label="Import into" name="import-environment" error={e.environment}>
        <select id="import-environment" name="environment" className="select" defaultValue={v.environment || environment}>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
      </Field>
      <Field label=".env contents" name="content" error={e.content}>
        <textarea id="content" name="content" className="textarea" placeholder={"# paste your .env file\nAPI_URL=https://api.example.com\nAPI_KEY=..."} defaultValue={v.content} spellCheck={false} {...errorProps("content", e.content)} />
      </Field>
      <label className="check">
        <input type="checkbox" name="overwrite" /> Overwrite keys that already exist
      </label>
      <Submit className="btn" pendingText="Importing...">Import variables</Submit>
    </form>
  );
}
