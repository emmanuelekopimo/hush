"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { revealSecretAction } from "@/app/actions/vault";

export function SecretValue({ id, masked }: { id: number; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const fetchValue = async () => {
    const res = await revealSecretAction(id);
    return res.ok && res.value !== undefined ? res.value : null;
  };

  const toggle = () =>
    start(async () => {
      if (value !== null) return setValue(null);
      setValue(await fetchValue());
    });

  const copy = () =>
    start(async () => {
      const v = value ?? (await fetchValue());
      if (v === null) return;
      await navigator.clipboard?.writeText(v).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  return (
    <div className="row" style={{ flexWrap: "nowrap", gap: 8, alignItems: "flex-start" }}>
      <span className={`secret-value grow ${value !== null ? "revealed" : ""}`} data-testid="secret-value" style={{ flex: 1, minWidth: 0 }}>
        {value ?? masked}
      </span>
      <button type="button" className="btn btn-icon btn-sm" onClick={toggle} disabled={pending} aria-label={value !== null ? "Hide value" : "Reveal value"}>
        {value !== null ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button type="button" className="btn btn-icon btn-sm" onClick={copy} disabled={pending} aria-label="Copy value">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : label}
    </button>
  );
}
