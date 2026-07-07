"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Tab = "signin" | "signup" | "magic";

export default function Login() {
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = getSupabaseBrowser();

  // Failed magic links land back here as /login?error=...
  useEffect(() => {
    const fromCallback = new URLSearchParams(window.location.search).get("error");
    if (fromCallback) setError(fromCallback);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!supabase) {
      setError("Auth is not configured on this deployment.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/console";
        return;
      }

      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/console";
          return;
        }
        setNotice("Account created. Check your email to confirm, then sign in.");
        return;
      }

      // magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setNotice("Magic link sent. Check your email and open it on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel =
    tab === "signin" ? "Sign in" : tab === "signup" ? "Create account" : "Send magic link";

  return (
    <main className="lp gate-page">
      <nav className="lp-nav">
        <Link href="/" className="lp-lockup">
          <span className="lp-mark-box" aria-hidden="true">MAGI</span>
          <span className="lp-mark-sub">Decision system</span>
        </Link>
        <span className="lp-tag">Private beta</span>
      </nav>

      <div className="gate-wrap">
        <div className="gate">
          <p className="gate-kicker">Operator identification</p>
          <h1>{tab === "signup" ? "Create your account." : "Sign in to MAGI."}</h1>
          <p className="gate-sub">
            Your account keeps your runs, credits, and history attached to you.
          </p>

          <div className="gate-tabs" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signin"}
              className={tab === "signin" ? "active" : ""}
              onClick={() => switchTab("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              className={tab === "signup" ? "active" : ""}
              onClick={() => switchTab("signup")}
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "magic"}
              className={tab === "magic" ? "active" : ""}
              onClick={() => switchTab("magic")}
            >
              Magic link
            </button>
          </div>

          <form className="gate-form" onSubmit={submit}>
            <input
              type="email"
              required
              placeholder="you@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              autoComplete="email"
              disabled={busy}
              className="gate-email"
            />
            {tab !== "magic" && (
              <input
                type="password"
                required
                minLength={8}
                placeholder={tab === "signup" ? "Choose a password (8+ characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                disabled={busy}
                className="gate-email"
              />
            )}
            <button type="submit" disabled={busy}>
              {busy ? "Working…" : buttonLabel}
            </button>
          </form>

          {tab === "magic" && !notice && (
            <p className="gate-micro">No password needed — we email you a one-time sign-in link.</p>
          )}
          {error && <p className="gate-error">{error}</p>}
          {notice && <p className="gate-notice">{notice}</p>}

          <p className="gate-micro">
            Looking for the beta gate? <Link href="/access">Enter your access code</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
