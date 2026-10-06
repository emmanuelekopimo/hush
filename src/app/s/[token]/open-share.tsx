"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { openShareAction } from "@/app/actions/share";
import { CopyText } from "@/components/reveal";

type Result = Awaited<ReturnType<typeof openShareAction>>;

export function OpenShare({ token }: { token: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="small muted">Key</div>
        <code className="secret-key">{result.key}</code>
        <div className="small muted">Value</div>
        <div className="share-url"><code data-testid="shared-value">{result.value}</code><CopyText text={result.value} /></div>
        <div className="notice">{result.viewsLeft > 0 ? `This link can be opened ${result.viewsLeft} more time${result.viewsLeft === 1 ? "" : "s"}.` : "This link has now been used up. Copy the value before you leave this page."}</div>
      </div>
    );
  }
  if (result && !result.ok) {
    return <div className="notice bad">This link is no longer available.</div>;
  }
  return (
    <button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => setResult(await openShareAction(token)))}>
      <Eye size={16} /> {pending ? "Opening..." : "Reveal secret"}
    </button>
  );
}
