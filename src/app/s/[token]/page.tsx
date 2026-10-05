import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { getNow } from "@/lib/dates";
import { timeLeft } from "@/lib/shares";
import { peekShare } from "@/server/shares";
import { OpenShare } from "./open-share";

export const metadata: Metadata = { title: "Shared secret", robots: { index: false, follow: false } };

const MESSAGES = {
  used: "This link has already been opened the maximum number of times.",
  expired: "This link has expired.",
  revoked: "The sender revoked this link.",
  missing: "This link does not exist.",
} as const;

export default async function SharedSecretPage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  const now = getNow();
  const info = await peekShare(getDb(), token, now);
  const status = info?.status ?? "missing";

  return (
    <div className="public-wrap auth-wrap">
      <div className="public-card">
        <Link href="/" className="brand" style={{ justifyContent: "center", padding: 0 }}>
          <img src="/logo.svg" alt="" style={{ width: 32, height: 32 }} /> Hush
        </Link>
        <div className="card stack" style={{ gap: 16 }}>
          <img src="/illustrations/link.svg" alt="" style={{ width: 130, margin: "0 auto" }} />
          {status === "active" && info ? (
            <>
              <div style={{ textAlign: "center" }}>
                <h1 style={{ fontSize: 22 }}>Someone shared a secret with you</h1>
                <p className="muted small" style={{ marginTop: 6 }}>{info.label} · {timeLeft(info.expiresAt, now)} · {info.viewsLeft} view{info.viewsLeft === 1 ? "" : "s"} left</p>
              </div>
              <p className="small muted" style={{ textAlign: "center" }}>Revealing counts as a view. Make sure you are ready to copy it.</p>
              <OpenShare token={token} />
            </>
          ) : (
            <div style={{ textAlign: "center" }} className="stack">
              <h1 style={{ fontSize: 22 }}>Link not available</h1>
              <p className="muted" data-testid="share-unavailable">{MESSAGES[status as keyof typeof MESSAGES]}</p>
            </div>
          )}
        </div>
        <p className="tiny dim" style={{ textAlign: "center" }}>Hush keeps only a hash of this link. The value is deleted once the link is used up.</p>
      </div>
    </div>
  );
}
