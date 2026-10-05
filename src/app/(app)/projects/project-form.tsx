"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/app/actions/vault";
import { Field, errorProps } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "@/lib/validation";

export function ProjectForm() {
  const [state, action] = useActionState<FormState, FormData>(createProjectAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      <Field label="Project name" name="name" error={e.name}>
        <input id="name" name="name" className="input" placeholder="e.g. Campus Pay API" defaultValue={state.values?.name} {...errorProps("name", e.name)} />
      </Field>
      <Field label="Description (optional)" name="description" error={e.description}>
        <input id="description" name="description" className="input" placeholder="What does it do?" defaultValue={state.values?.description} {...errorProps("description", e.description)} />
      </Field>
      <Submit pendingText="Creating...">Create project</Submit>
    </form>
  );
}
