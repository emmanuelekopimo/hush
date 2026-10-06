"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "@/lib/validation";

export function SignInForm({ next, demoEmail, demoPassword }: { next: string; demoEmail: string; demoPassword: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.message && <div className="notice bad" role="alert">{state.message}</div>}
      <Field label="Email" name="email" error={e.email}>
        <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={state.values?.email ?? demoEmail} {...errorProps("email", e.email)} />
      </Field>
      <Field label="Password" name="password" error={e.password}>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" defaultValue={demoPassword} {...errorProps("password", e.password)} />
      </Field>
      <Submit pendingText="Signing in...">Sign in</Submit>
      <p className="small muted" style={{ textAlign: "center" }}>
        New here? <Link href="/sign-up" style={{ color: "var(--text)" }}>Create an account</Link>
      </p>
    </form>
  );
}
