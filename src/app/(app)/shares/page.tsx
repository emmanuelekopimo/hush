import type { Metadata } from "next";
import { getDb } from "@/db";
import { getNow } from "@/lib/dates";
import { dateTime } from "@/lib/format";
import { timeLeft, type ShareStatus } from "@/lib/shares";
import { Empty, PageHead } from "@/components/ui";
import { revokeShareAction } from "@/app/actions/vault";
import { requireUser } from "@/server/session";
import { listShares } from "@/server/shares";
import { secretOptions } from "@/server/vault";
import { ShareForm } from "./share-form";

export const metadata: Metadata = { title: "Share links" };

const STATUS: Record<ShareStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "ok" },
  used: { label: "Used", cls: "info" },
  expired: { label: "Expired", cls: "due" },
  revoked: { label: "Revoked", cls: "bad" },
};

export default async function SharesPage(props: PageProps<"/shares">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const db = getDb();
  const now = getNow();
  const [shares, options] = await Promise.all([listShares(db, user.id, now), secretOptions(db, user.id)]);
  const selected = Number(sp.secret) || undefined;

  return (
    <>
      <PageHead title="Share links" sub="Send a secret with a link that stops working after it is opened or when it expires." />
      <div className="split">
        <div className="card">
          <div className="card-head"><h2>Your links</h2><span className="tiny muted">{shares.length} total</span></div>
          {shares.length === 0 ? (
            <Empty art="/illustrations/link.svg" title="No links yet">Create one with the form.</Empty>
          ) : (
            <div className="list" data-testid="share-list">
              {shares.map((s) => (
                <div key={s.id} className="list-item" data-testid="share-item">
                  <div className="grow">
                    <div className="secret-key truncate">{s.label}</div>
                    <div className="tiny muted">
                      Created {dateTime(s.createdAt)} · opened {s.views} of {s.maxViews}
                      {s.status === "active" ? ` · ${timeLeft(s.expiresAt, now)}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${STATUS[s.status].cls}`}><span className="dot" />{STATUS[s.status].label}</span>
                  {s.status === "active" && (
                    <form action={revokeShareAction}>
                      <input type="hidden" name="shareId" value={s.id} />
                      <button className="btn btn-sm btn-danger">Revoke</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>New link</h2>
              <p>The link is shown once. Hush only keeps a hash of it.</p>
            </div>
          </div>
          <ShareForm options={options} selected={selected} />
        </div>
      </div>
    </>
  );
}
