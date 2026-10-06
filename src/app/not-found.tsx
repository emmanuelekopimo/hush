import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <img src="/illustrations/empty-box.svg" alt="" style={{ width: 160, margin: "0 auto" }} />
        <h1>Page not found</h1>
        <p className="muted">It does not exist, or it belongs to someone else.</p>
        <Link href="/dashboard" className="btn btn-primary">Back to your vault</Link>
      </div>
    </div>
  );
}
