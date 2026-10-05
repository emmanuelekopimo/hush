import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand">
          <img src="/logo.svg" alt="" style={{ width: 34, height: 34 }} />
          Hush
        </Link>
        <div>
          <h1>Create your vault</h1>
          <p className="sub">Keep every project&apos;s secrets in one safe place.</p>
        </div>
        <div className="card">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
