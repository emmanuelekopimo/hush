"use client";

import { useState } from "react";
import { FileLock2, FileUp, Unlock } from "lucide-react";
import { isSealed, sealFile, sealedName, unsealFile } from "@/lib/seal";

function save(data: Uint8Array, name: string, type = "application/octet-stream") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  a.download = name;
  a.click();
}

function size(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function Sealer() {
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sealed, setSealed] = useState(false);

  const pick = async (f: File) => {
    setFile(f);
    setMsg(null);
    setSealed(isSealed(new Uint8Array(await f.slice(0, 64).arrayBuffer())));
  };

  const go = async () => {
    if (!file) return setMsg({ ok: false, text: "Choose a file first." });
    setBusy(true);
    setMsg(null);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (sealed) {
        const out = await unsealFile(data, pass);
        save(out.data, out.name, out.type);
        setMsg({ ok: true, text: `Unsealed ${out.name} (${size(out.data.length)}).` });
      } else {
        const out = await sealFile({ name: file.name, type: file.type, data }, pass);
        save(out, sealedName(file.name));
        setMsg({ ok: true, text: `Sealed ${file.name}. Saved ${sealedName(file.name)} (${size(out.length)}).` });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split">
      <div className="card form">
        <h2>Seal a file</h2>
        <p className="small muted">Locks any file with a passphrase using AES-256-GCM. The key is made from your passphrase with PBKDF2 (210,000 rounds). Everything happens in your browser.</p>
        <label className="drop">
          <FileUp size={18} style={{ verticalAlign: -4 }} /> {file ? `${file.name} (${size(file.size)})` : "Choose a file, or a .hush file to unseal"}
          <input type="file" data-testid="seal-input" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
        {file && <span className={`badge ${sealed ? "info" : ""}`}>{sealed ? "Sealed Hush file detected" : "Ready to seal"}</span>}
        <div className="field">
          <label htmlFor="pass">Passphrase</label>
          <input id="pass" type="password" className="input" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
        </div>
        {msg && <div className={`notice ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</div>}
        <button className="btn btn-primary" onClick={go} disabled={busy}>
          {sealed ? <Unlock size={15} /> : <FileLock2 size={15} />} {busy ? "Working..." : sealed ? "Unseal and download" : "Seal and download"}
        </button>
      </div>
      <div className="card stack small">
        <h2>How a sealed file is built</h2>
        <div className="list">
          <div className="list-item"><code>HUSH1</code><span className="grow muted">5 bytes that mark the file type</span></div>
          <div className="list-item"><code>salt</code><span className="grow muted">16 random bytes for PBKDF2</span></div>
          <div className="list-item"><code>iv</code><span className="grow muted">12 random bytes for AES-GCM</span></div>
          <div className="list-item"><code>data</code><span className="grow muted">Encrypted name, type and contents, plus a 16 byte tag that detects any change</span></div>
        </div>
        <p className="muted">A wrong passphrase or a changed byte makes the tag check fail, so the file is never half-decrypted.</p>
      </div>
    </div>
  );
}
