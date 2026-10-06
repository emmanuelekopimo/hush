"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "@/lib/validation";

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <div className="notice bad" role="alert">{state.message}</div>}
      <Field label="Full name" name="name" error={e.name}>
        <input id="name" name="name" className="input" autoComplete="name" defaultValue={state.values?.name} {...errorProps("name", e.name)} />
      </Field>
      <Field label="Email" name="email" error={e.email}>
        <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={state.values?.email} {...errorProps("email", e.email)} />
      </Field>
      <Field label="Password" name="password" error={e.password}>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" {...errorProps("password", e.password)} />
      </Field>
      <p className="tiny muted">At least 8 characters with a letter and a number.</p>
      <Submit pendingText="Creating account...">Create account</Submit>
      <p className="small muted" style={{ textAlign: "center" }}>
        Already have an account? <Link href="/sign-in" style={{ color: "var(--text)" }}>Sign in</Link>
      </p>
    </form>
  );
}
