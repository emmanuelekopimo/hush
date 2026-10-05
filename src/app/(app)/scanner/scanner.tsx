"use client";

import { useMemo, useState } from "react";
import { ScanSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import { scanSummary, scanText } from "@/lib/scanner";
import { sampleLeakyCode } from "@/lib/samples";

export function Scanner() {
  const [text, setText] = useState("");
  const [scanned, setScanned] = useState<string | null>(null);
  const findings = useMemo(() => (scanned === null ? [] : scanText(scanned)), [scanned]);
  const summary = scanSummary(findings);

  return (
    <div className="split">
      <div className="card stack" style={{ gap: 12 }}>
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>Paste code, logs or a message</h2>
            <p>Scanning happens in your browser. Nothing is sent to the server.</p>
          </div>
        </div>
        <textarea
          className="textarea"
          style={{ minHeight: 300 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste anything here"
          spellCheck={false}
          aria-label="Text to scan"
        />
        <div className="row">
          <button className="btn btn-primary" onClick={() => setScanned(text)} disabled={!text.trim()}>
            <ScanSearch size={16} /> Scan for secrets
          </button>
          <button className="btn" onClick={() => { const s = sampleLeakyCode(); setText(s); setScanned(s); }}>
            Load a leaky sample
          </button>
        </div>
      </div>
      <div className="card stack" style={{ gap: 12 }} data-testid="scan-results">
        <h2>Results</h2>
        {scanned === null ? (
          <div className="empty"><img src="/illustrations/scan.svg" alt="" /><span>Run a scan to see results.</span></div>
        ) : findings.length === 0 ? (
          <div className="notice ok row"><ShieldCheck size={16} /> No secrets found.</div>
        ) : (
          <>
            <div className="notice bad row" style={{ flexWrap: "nowrap" }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span data-testid="scan-summary">{summary.total} possible secret{summary.total === 1 ? "" : "s"} found ({summary.high} high, {summary.medium} medium)</span>
            </div>
            {findings.map((f, i) => (
              <div key={i} className="finding" data-testid="finding">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong className="small">{f.rule}</strong>
                  <span className={`badge ${f.severity === "high" ? "bad" : "due"}`}>{f.severity}</span>
                </div>
                <code className="secret-value">{f.redacted}</code>
                <span className="tiny muted">Line {f.line}, column {f.column}. {f.advice}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
