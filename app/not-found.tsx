import Link from "next/link";

export default function NotFound() {
  return (
    <main className="lp gate-page">
      <nav className="lp-nav">
        <Link href="/" className="lp-lockup">
          <span className="lp-mark-box" aria-hidden="true">MAGI</span>
          <span className="lp-mark-sub">Decision system</span>
        </Link>
        <span className="lp-tag">404</span>
      </nav>
      <div className="gate-wrap">
        <div className="gate">
          <p className="gate-kicker">Signal lost · 404</p>
          <h1>This page isn&rsquo;t on the grid.</h1>
          <p className="gate-sub">The route you asked for doesn&rsquo;t exist or has moved.</p>
          <p className="gate-micro">
            <Link href="/">← Back to MAGI</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
