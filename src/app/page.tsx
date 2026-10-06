import Link from "next/link";
import { FileLock2, ImageOff, KeyRound, Link2, ScanSearch, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/server/session";

const FEATURES = [
  { icon: KeyRound, title: "Encrypted vault", text: "Every value is encrypted with AES-256-GCM before it reaches the database." },
  { icon: ShieldCheck, title: "Rotation tracking", text: "See which keys are due, overdue or expired, and which values are reused." },
  { icon: Link2, title: "One-time links", text: "Share a secret with a link that works once and then burns itself." },
  { icon: ScanSearch, title: "Leak scanner", text: "Paste code or logs and find API keys, tokens and passwords before you commit." },
  { icon: ImageOff, title: "Image scrambler", text: "Scramble a picture with a key so only people with the key can restore it." },
  { icon: FileLock2, title: "File sealing", text: "Lock any file with a passphrase in your browser. Nothing is uploaded." },
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand" style={{ padding: 0 }}>
          <img src="/logo.svg" alt="" style={{ width: 30, height: 30 }} />
          Hush
        </Link>
        <Link href={user ? "/dashboard" : "/sign-in"} className="btn btn-sm">
          {user ? "Open vault" : "Sign in"}
        </Link>
      </nav>
      <section className="hero">
        <span className="badge">Env manager and vault</span>
        <h1>Keep your secrets out of your code.</h1>
        <p>Hush stores your project environment variables encrypted, tells you when keys need rotating, and lets you share them safely.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href={user ? "/dashboard" : "/sign-in"} className="btn btn-primary">Try the demo</Link>
          <Link href="/sign-up" className="btn">Create account</Link>
        </div>
        <img className="hero-art" src="/illustrations/hero.svg" alt="Secrets locked in a vault" />
      </section>
      <section className="features">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card feature">
            <Icon size={22} strokeWidth={1.6} />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
