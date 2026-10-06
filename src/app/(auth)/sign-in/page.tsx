import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/server/seed";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand">
          <img src="/logo.svg" alt="" style={{ width: 34, height: 34 }} />
          Hush
        </Link>
        <div>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to open your vault.</p>
        </div>
        <div className="card">
          <SignInForm next={next} demoEmail={DEMO_EMAIL} demoPassword={DEMO_PASSWORD} />
        </div>
        <p className="demo-hint">Demo account is filled in: {DEMO_EMAIL} / {DEMO_PASSWORD}</p>
      </div>
    </div>
  );
}
