import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — MAGI",
  description: "How MAGI handles your data.",
};

export default function Privacy() {
  return (
    <main className="lp legal">
      <nav className="lp-nav">
        <Link href="/" className="lp-mark">MAGI</Link>
        <span className="lp-tag">Privacy</span>
      </nav>

      <article className="legal-body">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: June 2026</p>

        <p className="legal-note">
          This is a starting template, not legal advice. Have a lawyer review it before relying on it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Waitlist email</strong> — when you join the waitlist.</li>
          <li><strong>Prompts &amp; outputs</strong> — the requests you send to MAGI and the responses generated, to provide and improve the service.</li>
          <li><strong>Usage &amp; cost data</strong> — basic run metadata (timestamps, model cost, counts).</li>
          <li><strong>Payment data</strong> — handled by our payment processor; we don&rsquo;t store full card details.</li>
        </ul>

        <h2>Third parties that process your data</h2>
        <p>To run MAGI, your prompts are sent to AI model providers, and data is stored/processed by:</p>
        <ul>
          <li><strong>AI model providers</strong> (e.g. Anthropic, OpenAI, Google, DeepSeek, and others) via the <strong>Vercel AI Gateway</strong> — to generate responses.</li>
          <li><strong>Supabase</strong> — database and authentication.</li>
          <li><strong>Vercel</strong> — hosting.</li>
          <li><strong>Stripe</strong> — payments (when enabled).</li>
        </ul>
        <p>These providers process data under their own terms; model providers may apply their own retention policies.</p>

        <h2>How we use it</h2>
        <p>To operate MAGI, generate your results, prevent abuse, handle billing, and improve the product. We do not sell your personal data.</p>

        <h2>Retention</h2>
        <p>We keep account, run, and waitlist data while your account is active or as needed to provide the service, then delete or anonymize it. You can request deletion (see Contact).</p>

        <h2>Your choices</h2>
        <p>You can request access to or deletion of your data, and unsubscribe from emails at any time.</p>

        <h2>Changes</h2>
        <p>We may update this policy; we&rsquo;ll post the new date above.</p>

        <h2>Contact</h2>
        <p>Privacy requests: samisosman52@gmail.com</p>

        <p className="legal-back"><Link href="/">← Back to MAGI</Link></p>
      </article>
    </main>
  );
}
