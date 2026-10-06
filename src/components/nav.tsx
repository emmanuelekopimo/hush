"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderLock, LayoutGrid, Link2, ScanSearch, Wrench } from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Overview", short: "Home", icon: LayoutGrid },
  { href: "/projects", label: "Projects", short: "Projects", icon: FolderLock },
  { href: "/shares", label: "Share links", short: "Share", icon: Link2 },
  { href: "/scanner", label: "Leak scanner", short: "Scan", icon: ScanSearch },
  { href: "/tools", label: "Tools", short: "Tools", icon: Wrench },
  { href: "/activity", label: "Activity", short: "Activity", icon: Activity },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="stack" style={{ gap: 4 }}>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="nav-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={18} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.href !== "/activity");
  return (
    <nav aria-label="Mobile" className="bottom-nav">
      {items.map(({ href, short, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.8} />
          {short}
        </Link>
      ))}
    </nav>
  );
}
