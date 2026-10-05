"use client";

import { useActionState } from "react";
import { createShareAction, type ShareState } from "@/app/actions/vault";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import { CopyText } from "@/components/reveal";

interface Option { id: number; key: string; environment: string; projectName: string }

export function ShareForm({ options, selected }: { options: Option[]; selected?: number }) {
  const [state, action] = useActionState<ShareState, FormData>(createShareAction, {});
  const e = state.errors ?? {};
  const fullUrl = state.url && typeof window !== "undefined" ? `${window.location.origin}${state.url}` : state.url;
  return (
    <form action={action} className="form" noValidate data-testid="share-form">
      {state.ok && fullUrl && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="notice ok" role="status">{state.message}</div>
          <div className="share-url">
            <code data-testid="share-url">{fullUrl}</code>
            <CopyText text={fullUrl} />
          </div>
        </div>
      )}
      <Field label="Secret" name="secretId" error={e.secretId}>
        <select key={`s-${state.values?.secretId ?? selected ?? ""}`} id="secretId" name="secretId" className="select" defaultValue={state.values?.secretId ?? (selected ? String(selected) : "")} {...errorProps("secretId", e.secretId)}>
          <option value="">Pick a secret</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.projectName} / {o.environment} / {o.key}</option>
          ))}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Expires after" name="expiry" error={e.expiry}>
          <select key={`e-${state.values?.expiry ?? ""}`} id="expiry" name="expiry" className="select" defaultValue={state.values?.expiry ?? "24h"}>
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
          </select>
        </Field>
        <Field label="Can be opened" name="maxViews" error={e.maxViews}>
          <select key={`m-${state.values?.maxViews ?? ""}`} id="maxViews" name="maxViews" className="select" defaultValue={state.values?.maxViews ?? "1"}>
            <option value="1">Once</option>
            <option value="2">2 times</option>
            <option value="3">3 times</option>
            <option value="5">5 times</option>
          </select>
        </Field>
      </div>
      <Submit pendingText="Creating link...">Create link</Submit>
    </form>
  );
}
