import Link from "next/link";
import { LogOut } from "lucide-react";
import { BottomNav, SideNav } from "@/components/nav";
import { avatarUri } from "@/lib/avatar";
import { requireUser } from "@/server/session";
import { signOutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const avatar = avatarUri(user.email);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <img src="/logo.svg" alt="" />
          Hush
        </Link>
        <SideNav />
        <div className="sidebar-foot">
          <div className="user-chip">
            <img src={avatar} alt="" />
            <div className="who">
              <div style={{ fontWeight: 500 }}>{user.name}</div>
              <div className="tiny muted">{user.email}</div>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="nav-link btn-block" style={{ border: 0, background: "none", cursor: "pointer", font: "inherit" }}>
              <LogOut size={18} strokeWidth={1.8} /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <img src="/logo.svg" alt="" style={{ width: 26, height: 26 }} />
          Hush
        </Link>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/activity" className="btn btn-sm">Activity</Link>
          <form action={signOutAction}>
            <button className="btn btn-icon" aria-label="Sign out"><LogOut size={16} /></button>
          </form>
          <img className="avatar" src={avatar} alt={user.name} />
        </div>
      </header>
      <main className="main">{children}</main>
      <BottomNav />
    </div>
  );
}
