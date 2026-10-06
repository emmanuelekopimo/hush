"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ALPHABETS, entropyBits, generateSecret, strengthLabel, type AlphabetName } from "@/lib/generator";
import { CopyText } from "@/components/reveal";

export function Generator() {
  const [length, setLength] = useState("32");
  const [alphabet, setAlphabet] = useState<AlphabetName>("alphanumeric");
  const n = Math.min(256, Math.max(4, Number(length) || 32));
  const [value, setValue] = useState("");
  const bits = entropyBits(n, alphabet);

  return (
    <div className="card form" style={{ maxWidth: 640 }}>
      <h2>Secret generator</h2>
      <p className="small muted">Uses the browser&apos;s secure random source with rejection sampling, so every character is equally likely.</p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="len">Length</label>
          <input id="len" type="number" inputMode="numeric" min={4} max={256} className="input" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="alpha">Characters</label>
          <select id="alpha" className="select" value={alphabet} onChange={(e) => setAlphabet(e.target.value as AlphabetName)}>
            {Object.keys(ALPHABETS).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="row small">
        <span className="badge">{bits} bits of entropy</span>
        <span className={`badge ${bits >= 80 ? "ok" : bits >= 50 ? "due" : "bad"}`}>{strengthLabel(bits)}</span>
      </div>
      <button className="btn btn-primary" onClick={() => setValue(generateSecret(n, alphabet))}><RefreshCw size={15} /> Generate</button>
      {value && (
        <div className="share-url"><code data-testid="generated">{value}</code><CopyText text={value} /></div>
      )}
    </div>
  );
}
