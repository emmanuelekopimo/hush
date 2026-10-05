"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Lock, Unlock } from "lucide-react";
import { BLOCK_SIZES, scramblePixels, type Mode } from "@/lib/scramble";

const MAX_SIDE = 900;

function drawSample(canvas: HTMLCanvasElement) {
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 640, 400);
  g.addColorStop(0, "#1e3a8a");
  g.addColorStop(1, "#0f766e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, 640, 70);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px sans-serif";
  ctx.fillText("UNIVERSITY OF UYO", 28, 45);
  ctx.font = "16px sans-serif";
  ctx.fillText("Student identity card", 430, 45);
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.roundRect(28, 100, 170, 210, 14);
  ctx.fill();
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(113, 175, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(113, 285, 70, 45, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "15px sans-serif";
  const rows: [string, string][] = [["Name", "FRIDAY GODSWILL ESSIEN"], ["Matric no.", "23/SC/CO/158"], ["Department", "Computer Science"], ["Level", "300"], ["Expires", "SEP 2027"]];
  rows.forEach(([k, v], i) => {
    ctx.globalAlpha = 0.7;
    ctx.fillText(k, 230, 120 + i * 44);
    ctx.globalAlpha = 1;
    ctx.font = "600 19px sans-serif";
    ctx.fillText(v, 230, 142 + i * 44);
    ctx.font = "15px sans-serif";
  });
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 46; i++) ctx.fillRect(28 + i * 13, 340, i % 3 === 0 ? 7 : 4, 36);
}

export function Scrambler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState("uniuyo-2026");
  const [block, setBlock] = useState("16");
  const [state, setState] = useState<"original" | "scrambled" | "restored" | "loaded">("original");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (canvasRef.current) drawSample(canvasRef.current);
  }, []);

  const run = (mode: Mode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!key) return setMessage("Enter a key first.");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = scramblePixels(img.data, { width: canvas.width, height: canvas.height, key, blockSize: Number(block), mode });
    img.data.set(out);
    ctx.putImageData(img, 0, 0);
    setState(mode === "scramble" ? "scrambled" : "restored");
    setMessage(mode === "scramble" ? "Scrambled. Only the same key and block size can restore it." : "Unscrambled. If the key was wrong, the image stays noisy.");
  };

  const load = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setState("loaded");
      setMessage(`${file.name} loaded (${canvas.width} x ${canvas.height}). Metadata such as GPS location is dropped.`);
    };
    img.src = url;
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = state === "scrambled" ? "scrambled.png" : "image.png";
      a.click();
    }, "image/png");
  };

  return (
    <div className="split">
      <div className="card stack" style={{ gap: 12 }}>
        <div className="canvas-wrap"><canvas ref={canvasRef} data-testid="scramble-canvas" data-state={state} /></div>
        {message && <p className="small muted" role="status">{message}</p>}
      </div>
      <div className="card form">
        <h2>Image scrambler</h2>
        <p className="small muted">Shuffles blocks of pixels and masks every colour with a stream made from your key. The same key reverses it exactly. Save as PNG, because JPEG compression changes pixels.</p>
        <label className="drop">
          <ImagePlus size={18} style={{ verticalAlign: -4 }} /> Choose an image
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
        <div className="form-row">
          <div className="field">
            <label htmlFor="scramble-key">Key</label>
            <input id="scramble-key" className="input mono" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="block">Block size</label>
            <select id="block" className="select" value={block} onChange={(e) => setBlock(e.target.value)}>
              {BLOCK_SIZES.map((b) => <option key={b} value={b}>{b} px</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => run("scramble")}><Lock size={15} /> Scramble</button>
          <button className="btn" onClick={() => run("unscramble")}><Unlock size={15} /> Unscramble</button>
          <button className="btn" onClick={download}><Download size={15} /> PNG</button>
        </div>
        <button className="btn btn-sm" onClick={() => { if (canvasRef.current) drawSample(canvasRef.current); setState("original"); setMessage("Sample ID card restored."); }}>Reset sample</button>
      </div>
    </div>
  );
}
