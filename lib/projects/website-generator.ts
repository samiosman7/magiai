export type GeneratedFile = {
  path: string;
  content: string;
};

export type GeneratedProject = {
  slug: string;
  title: string;
  files: GeneratedFile[];
};

type SiteProfile = {
  title: string;
  slug: string;
  headline: string;
  audience: string;
  category: string;
  offer: string;
  primaryCta: string;
  secondaryCta: string;
  proofMetric: string;
  palette: {
    bg: string;
    surface: string;
    surface2: string;
    ink: string;
    muted: string;
    accent: string;
    accent2: string;
  };
};

export function isWebsiteBuildPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  return (
    /\b(build|create|make|generate|design)\b/.test(lower) &&
    /\b(website|site|landing page|web page|homepage|portfolio)\b/.test(lower)
  );
}

export function generateWebsiteProject(prompt: string): GeneratedProject {
  const profile = inferProfile(prompt);

  return {
    slug: profile.slug,
    title: profile.title,
    files: [
      { path: "index.html", content: html(profile) },
      { path: "styles.css", content: css(profile) },
      { path: "script.js", content: js(profile) },
      { path: "README.md", content: readme(profile, prompt) },
    ],
  };
}

function inferProfile(prompt: string): SiteProfile {
  const lower = prompt.toLowerCase();
  const title = inferTitle(prompt);
  const category = lower.includes("detailing") || lower.includes("car")
    ? "premium mobile detailing"
    : lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake")
      ? "neighborhood bakery"
    : lower.includes("restaurant")
      ? "modern hospitality"
      : lower.includes("portfolio")
        ? "creative portfolio"
        : lower.includes("saas") || lower.includes("startup")
          ? "software product"
          : "high-conversion service";

  const luxury = lower.includes("luxury") || lower.includes("premium") || lower.includes("detailing");
  const tech = lower.includes("saas") || lower.includes("startup") || lower.includes("ai") || lower.includes("software");
  const bakery = lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake");
  const clean = lower.includes("medical") || lower.includes("clean") || lower.includes("wellness");

  return {
    title,
    slug: slugify(title),
    headline: inferHeadline(lower),
    audience: inferAudience(lower),
    category,
    offer: inferOffer(lower),
    primaryCta: bakery
      ? "Order for pickup"
      : lower.includes("booking") || lower.includes("detailing")
        ? "Book a detail"
        : "Start a project",
    secondaryCta: bakery
      ? "View the menu"
      : lower.includes("packages") || lower.includes("pricing")
        ? "View packages"
        : "See the proof",
    proofMetric: bakery
      ? "Fresh batches by 7am"
      : lower.includes("detailing") || lower.includes("car")
        ? "142 five-star appointments"
        : "3x faster path to launch",
    palette: bakery
      ? {
          bg: "#fff7ec",
          surface: "#ffffff",
          surface2: "#f5dfc5",
          ink: "#2b160d",
          muted: "#795f4d",
          accent: "#c46a2d",
          accent2: "#7f3f21",
        }
      : luxury
      ? {
          bg: "#070604",
          surface: "#11100d",
          surface2: "#1c1812",
          ink: "#fbf3e4",
          muted: "#b8ad9c",
          accent: "#d8b76a",
          accent2: "#ef4444",
        }
      : tech
        ? {
            bg: "#061012",
            surface: "#0d1c20",
            surface2: "#132930",
            ink: "#effbff",
            muted: "#9ab3bb",
            accent: "#5eead4",
            accent2: "#60a5fa",
          }
        : clean
          ? {
              bg: "#f7fbfa",
              surface: "#ffffff",
              surface2: "#e7f2ef",
              ink: "#10201d",
              muted: "#58716b",
              accent: "#0f8b8d",
              accent2: "#d98f45",
            }
          : {
              bg: "#101010",
              surface: "#181818",
              surface2: "#23201c",
              ink: "#f4efe6",
              muted: "#ada59a",
              accent: "#e5573f",
              accent2: "#f6c85f",
            },
  };
}

function inferTitle(prompt: string) {
  const quoted = prompt.match(/["']([^"']{3,80})["']/)?.[1];
  if (quoted) return titleCase(quoted);

  const forMatch = prompt.match(/\bfor\s+([a-z0-9\s&'-]{3,60})/i)?.[1];
  if (forMatch) {
    const cleaned = forMatch.replace(/\b(website|site|landing page|web page|homepage)\b/gi, "").trim();
    if (cleaned) return titleCase(cleaned);
  }

  const lower = prompt.toLowerCase();
  if (lower.includes("detailing")) return "Apex Mobile Detail";
  if (lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake")) return "A Bakery";
  if (lower.includes("restaurant")) return "Tableline";
  if (lower.includes("portfolio")) return "Signal Portfolio";
  if (lower.includes("saas") || lower.includes("ai")) return "Launchgrid";
  return "Magi Studio";
}

function inferHeadline(lower: string) {
  if (lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake")) {
    return "Fresh bread, celebration cakes, and pastries worth crossing town for.";
  }
  if (lower.includes("detailing") || lower.includes("car")) return "Showroom-level detail, without leaving the driveway.";
  if (lower.includes("restaurant")) return "A table people remember before the first bite.";
  if (lower.includes("portfolio")) return "A sharper way to show the work behind your taste.";
  if (lower.includes("saas") || lower.includes("startup")) return "Explain the product fast, then make the demo feel obvious.";
  return "A clearer offer, stronger proof, and one obvious next step.";
}

function inferAudience(lower: string) {
  if (lower.includes("detailing") || lower.includes("car")) return "busy owners who want showroom results at home";
  if (lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake")) {
    return "locals planning breakfast, office treats, and weekend celebrations";
  }
  if (lower.includes("restaurant")) return "guests choosing where to book tonight";
  if (lower.includes("portfolio")) return "clients deciding whether to trust your taste";
  if (lower.includes("saas") || lower.includes("startup")) return "teams comparing serious tools";
  return "buyers who need confidence before they act";
}

function inferOffer(lower: string) {
  if (lower.includes("detailing") || lower.includes("car")) {
    return "mobile detailing packages with paint-safe washes, interior restoration, ceramic protection, and appointment-first convenience";
  }
  if (lower.includes("bakery") || lower.includes("baker") || lower.includes("pastry") || lower.includes("cake")) {
    return "daily sourdough, laminated pastries, custom cakes, and preorder boxes made for pickup, gifting, and catering";
  }
  if (lower.includes("restaurant")) return "a dining experience with memorable plates, easy reservations, and a confident local brand";
  if (lower.includes("portfolio")) return "a curated body of work with clear case studies, services, and contact paths";
  if (lower.includes("saas") || lower.includes("startup")) return "a product website that explains the workflow, proves value, and drives demo requests";
  return "a polished service offer with proof, packages, and a clear conversion path";
}

function html(profile: SiteProfile) {
  if (profile.category === "neighborhood bakery") return bakeryHtml(profile);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(profile.title)}</title>
    <meta
      name="description"
      content="${escapeHtml(profile.title)} is a ${escapeHtml(profile.category)} website generated by MAGI."
    />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav">
      <a class="brand" href="#top">${escapeHtml(profile.title)}</a>
      <nav>
        <a href="#packages">Packages</a>
        <a href="#proof">Proof</a>
        <a href="#process">Process</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">${escapeHtml(profile.category)}</p>
          <h1>${escapeHtml(profile.headline)}</h1>
          <p class="lede">${escapeHtml(profile.offer)} for ${escapeHtml(profile.audience)}.</p>
          <div class="actions">
            <a class="button" href="#contact">${escapeHtml(profile.primaryCta)}</a>
            <a class="button secondary" href="#packages">${escapeHtml(profile.secondaryCta)}</a>
          </div>
        </div>
        <aside class="hero-panel" aria-label="Trust summary">
          <span class="panel-label">Current signal</span>
          <strong>${escapeHtml(profile.proofMetric)}</strong>
          <p>Designed around clear proof, fast scanning, and one obvious next step.</p>
        </aside>
      </section>

      <section class="section intro">
        <p class="section-kicker">What this site is built to do</p>
        <h2>Convert interest into a confident action.</h2>
        <div class="intro-grid">
          <article>
            <span>01</span>
            <h3>Clarify the offer</h3>
            <p>Visitors see what is sold, who it is for, and why it is worth choosing.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Show proof early</h3>
            <p>Metrics, reviews, before-and-after moments, and process details build trust.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Remove friction</h3>
            <p>Packages, FAQs, and a direct form make the next step easy.</p>
          </article>
        </div>
      </section>

      <section class="section packages" id="packages">
        <div>
          <p class="section-kicker">Packages</p>
          <h2>Give buyers clear choices.</h2>
        </div>
        <div class="cards">
          <article class="card">
            <p class="tag">Essential</p>
            <h3>First-pass polish</h3>
            <p>Core service, fast turnaround, and a clean way for new customers to start.</p>
            <strong>From $149</strong>
          </article>
          <article class="card featured">
            <p class="tag">Most booked</p>
            <h3>Signature treatment</h3>
            <p>Deeper work, better proof, and the best balance of value and transformation.</p>
            <strong>From $299</strong>
          </article>
          <article class="card">
            <p class="tag">Premium</p>
            <h3>Protection plan</h3>
            <p>Ongoing care for customers who want the result to last longer.</p>
            <strong>Custom quote</strong>
          </article>
        </div>
      </section>

      <section class="section proof" id="proof">
        <div class="proof-copy">
          <p class="section-kicker">Proof</p>
          <h2>Trust should not hide below the fold.</h2>
          <p>
            Use this section for before-and-after images, review quotes, certifications,
            client logos, or measurable outcomes.
          </p>
        </div>
        <div class="proof-stack">
          <blockquote>
            "The site made the offer obvious and the booking path impossible to miss."
          </blockquote>
          <div class="metric-row">
            <div><strong>4.9</strong><span>review average</span></div>
            <div><strong>24h</strong><span>response target</span></div>
            <div><strong>3</strong><span>clear packages</span></div>
          </div>
        </div>
      </section>

      <section class="section process" id="process">
        <p class="section-kicker">Process</p>
        <h2>A simple path from interest to booked.</h2>
        <ol>
          <li><strong>Choose the package.</strong><span>Help visitors self-select without calling first.</span></li>
          <li><strong>Send the request.</strong><span>Collect the minimum details needed to respond.</span></li>
          <li><strong>Confirm the appointment.</strong><span>Follow up with timing, price, and expectations.</span></li>
        </ol>
      </section>

      <section class="section faq">
        <p class="section-kicker">FAQ</p>
        <div class="faq-grid">
          <details open>
            <summary>How fast can this launch?</summary>
            <p>This static version can launch quickly once copy, imagery, contact details, and pricing are finalized.</p>
          </details>
          <details>
            <summary>Can the design be customized?</summary>
            <p>Yes. Swap the palette, sections, services, testimonials, and form destination.</p>
          </details>
          <details>
            <summary>What should be added next?</summary>
            <p>Real photography, a working form endpoint, analytics, and a booking/payment integration.</p>
          </details>
        </div>
      </section>

      <section class="section contact" id="contact">
        <div>
          <p class="section-kicker">Contact</p>
          <h2>Make the next step feel easy.</h2>
        </div>
        <form>
          <label>
            Name
            <input name="name" placeholder="Your name" />
          </label>
          <label>
            Email
            <input name="email" placeholder="you@example.com" type="email" />
          </label>
          <label>
            Request
            <textarea name="message" placeholder="Tell us what you need"></textarea>
          </label>
          <button type="button">${escapeHtml(profile.primaryCta)}</button>
        </form>
      </section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;
}

function bakeryHtml(profile: SiteProfile) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(profile.title)}</title>
    <meta
      name="description"
      content="${escapeHtml(profile.title)} bakes sourdough, pastries, cakes, and preorder boxes for local pickup."
    />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="nav">
      <a class="brand" href="#top">${escapeHtml(profile.title)}</a>
      <nav>
        <a href="#menu">Menu</a>
        <a href="#today">Today</a>
        <a href="#cakes">Cakes</a>
        <a href="#visit">Visit</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Neighborhood bakery</p>
          <h1>${escapeHtml(profile.headline)}</h1>
          <p class="lede">Small-batch sourdough, laminated pastries, custom cakes, and preorder boxes baked for breakfast runs, office treats, and weekend celebrations.</p>
          <div class="actions">
            <a class="button" href="#visit">${escapeHtml(profile.primaryCta)}</a>
            <a class="button secondary" href="#menu">${escapeHtml(profile.secondaryCta)}</a>
          </div>
        </div>
        <aside class="hero-panel" aria-label="Today from the oven">
          <span class="panel-label">Today from the oven</span>
          <strong>7am sourdough</strong>
          <p>Butter croissants at 8, focaccia by 10, and celebration cake pickups after noon.</p>
        </aside>
      </section>

      <section class="section intro" id="today">
        <p class="section-kicker">Fresh today</p>
        <h2>Baked for morning routines, shared tables, and last-minute office wins.</h2>
        <div class="intro-grid">
          <article>
            <span>01</span>
            <h3>Daily bread</h3>
            <p>Country sourdough, seeded rye, and focaccia come out in small batches so the crust stays crisp.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Pastry case</h3>
            <p>Croissants, morning buns, lemon tarts, and seasonal danishes are rotated around ripe fruit and real butter.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Preorders</h3>
            <p>Reserve pastry boxes, birthday cakes, and catering trays before the morning rush sells through.</p>
          </article>
        </div>
      </section>

      <section class="section packages" id="menu">
        <div>
          <p class="section-kicker">Menu</p>
          <h2>Choose the thing people will ask about later.</h2>
        </div>
        <div class="cards">
          <article class="card">
            <p class="tag">Bread</p>
            <h3>Country sourdough</h3>
            <p>Long-fermented loaf with a caramelized crust, open crumb, and enough tang for soup, toast, or sandwiches.</p>
            <strong>$9 loaf</strong>
          </article>
          <article class="card featured">
            <p class="tag">Most requested</p>
            <h3>Butter croissant box</h3>
            <p>Six flaky croissants packed warm for meetings, brunches, or the person who always says they only want one bite.</p>
            <strong>$24 box</strong>
          </article>
          <article class="card">
            <p class="tag">Sweet</p>
            <h3>Lemon cream tart</h3>
            <p>Bright citrus curd, toasted meringue, and a crisp shell sized for a clean finish after coffee.</p>
            <strong>$6 each</strong>
          </article>
        </div>
      </section>

      <section class="section proof" id="proof">
        <div class="proof-copy">
          <p class="section-kicker">Local proof</p>
          <h2>The almond croissants sell out before lunch for a reason.</h2>
          <p>
            Add real bakery photography here: steam rising from the first bread cut,
            a full pastry case, custom cake details, and customers picking up weekend boxes.
          </p>
        </div>
        <div class="proof-stack">
          <blockquote>
            "The birthday cake looked beautiful, tasted even better, and pickup took less than two minutes."
          </blockquote>
          <div class="metric-row">
            <div><strong>7am</strong><span>first bread batch</span></div>
            <div><strong>48h</strong><span>cake preorder window</span></div>
            <div><strong>6-pack</strong><span>office pastry boxes</span></div>
          </div>
        </div>
      </section>

      <section class="section packages" id="cakes">
        <div>
          <p class="section-kicker">Cakes & catering</p>
          <h2>Celebrations should taste as intentional as they look.</h2>
        </div>
        <div class="cards">
          <article class="card">
            <p class="tag">Birthdays</p>
            <h3>Layer cakes</h3>
            <p>Vanilla bean, chocolate malt, carrot cake, or seasonal fruit with simple floral finishing.</p>
            <strong>From $58</strong>
          </article>
          <article class="card">
            <p class="tag">Teams</p>
            <h3>Office breakfast tray</h3>
            <p>Croissants, muffins, sliced loaf cake, jam, and enough variety for mixed tastes.</p>
            <strong>From $72</strong>
          </article>
          <article class="card">
            <p class="tag">Weekend</p>
            <h3>Brunch preorder box</h3>
            <p>A ready-to-share box with pastries, sourdough, compound butter, and a rotating seasonal sweet.</p>
            <strong>$44 box</strong>
          </article>
        </div>
      </section>

      <section class="section process" id="process">
        <p class="section-kicker">How pickup works</p>
        <h2>Reserve before it sells out, then skip the line.</h2>
        <ol>
          <li><strong>Pick your bake.</strong><span>Choose bread, pastries, cake, or catering from the menu.</span></li>
          <li><strong>Choose a pickup window.</strong><span>Morning pastry boxes and afternoon cake pickups are packed separately.</span></li>
          <li><strong>Arrive warm.</strong><span>Your order is labeled, boxed, and ready at the counter.</span></li>
        </ol>
      </section>

      <section class="section faq">
        <p class="section-kicker">FAQ</p>
        <div class="faq-grid">
          <details open>
            <summary>How far ahead should I order a cake?</summary>
            <p>Two days is ideal for standard cakes. Larger catering orders should be requested at least five days ahead.</p>
          </details>
          <details>
            <summary>Do you sell out?</summary>
            <p>Yes. Bread and croissants are baked in small batches, so preordering is the safest way to get exactly what you want.</p>
          </details>
          <details>
            <summary>Can I order for an office or event?</summary>
            <p>Yes. Pastry trays, sliced loaf cakes, and breakfast boxes can be packed for groups with clear pickup labels.</p>
          </details>
        </div>
      </section>

      <section class="section contact" id="visit">
        <div>
          <p class="section-kicker">Visit & preorder</p>
          <h2>Tell us what to save before the case empties.</h2>
        </div>
        <form>
          <label>
            Name
            <input name="name" placeholder="Your name" />
          </label>
          <label>
            Email
            <input name="email" placeholder="you@example.com" type="email" />
          </label>
          <label>
            Order details
            <textarea name="message" placeholder="Example: 1 sourdough loaf, 1 croissant box, pickup Saturday at 9am"></textarea>
          </label>
          <button type="button">${escapeHtml(profile.primaryCta)}</button>
        </form>
      </section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;
}

function css(profile: SiteProfile) {
  const { palette } = profile;
  return `:root {
  --bg: ${palette.bg};
  --surface: ${palette.surface};
  --surface-2: ${palette.surface2};
  --ink: ${palette.ink};
  --muted: ${palette.muted};
  --accent: ${palette.accent};
  --accent-2: ${palette.accent2};
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(circle at 80% 12%, color-mix(in srgb, var(--accent), transparent 72%), transparent 28rem),
    linear-gradient(180deg, color-mix(in srgb, var(--surface), transparent 20%), var(--bg) 32rem);
  color: var(--ink);
}
a { color: inherit; }
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px clamp(18px, 4vw, 64px);
  border-bottom: 1px solid color-mix(in srgb, var(--ink), transparent 84%);
  background: color-mix(in srgb, var(--bg), transparent 8%);
  backdrop-filter: blur(18px);
}
.brand {
  font-weight: 900;
  text-decoration: none;
  letter-spacing: 0.02em;
}
.nav nav {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: var(--muted);
  font-size: 0.94rem;
}
.nav nav a { text-decoration: none; }
.nav nav a:hover { color: var(--ink); }
.hero {
  min-height: 86vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  align-items: end;
  gap: clamp(28px, 6vw, 88px);
  padding: clamp(64px, 10vw, 140px) clamp(18px, 7vw, 104px);
}
.eyebrow,
.section-kicker,
.tag {
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h1,
h2,
h3,
p { margin-top: 0; }
h1 {
  max-width: 920px;
  margin-bottom: 24px;
  font-size: clamp(3.4rem, 9vw, 8.5rem);
  line-height: 0.88;
  letter-spacing: 0;
}
h2 {
  max-width: 820px;
  margin-bottom: 22px;
  font-size: clamp(2.2rem, 5.6vw, 5rem);
  line-height: 0.96;
}
h3 { font-size: 1.35rem; }
.lede {
  max-width: 680px;
  color: var(--muted);
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  line-height: 1.7;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 34px;
}
.button,
button {
  border: 0;
  background: var(--accent);
  color: var(--bg);
  padding: 14px 18px;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  transition: transform 180ms ease, opacity 180ms ease;
}
.button:hover,
button:hover { transform: translateY(-2px); }
.button.secondary {
  border: 1px solid color-mix(in srgb, var(--ink), transparent 74%);
  background: transparent;
  color: var(--ink);
}
.hero-panel,
.card,
.intro-grid article,
.proof-stack,
details,
form {
  border: 1px solid color-mix(in srgb, var(--ink), transparent 84%);
  background: color-mix(in srgb, var(--surface), transparent 7%);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
}
.hero-panel {
  padding: 28px;
}
.panel-label {
  display: block;
  margin-bottom: 14px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}
.hero-panel strong {
  display: block;
  color: var(--accent);
  font-size: clamp(2.2rem, 5vw, 4rem);
  line-height: 0.95;
}
.hero-panel p,
.intro-grid p,
.card p,
.proof p,
details p,
.process span {
  color: var(--muted);
  line-height: 1.65;
}
.section {
  padding: clamp(54px, 8vw, 104px) clamp(18px, 7vw, 104px);
}
.intro,
.process {
  background: color-mix(in srgb, var(--surface-2), transparent 18%);
}
.intro-grid,
.cards,
.faq-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.intro-grid article,
.card {
  padding: 24px;
}
.intro-grid span {
  color: var(--accent);
  font-weight: 900;
}
.packages {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
  gap: 30px;
}
.card.featured {
  border-color: color-mix(in srgb, var(--accent), transparent 38%);
  background: linear-gradient(160deg, color-mix(in srgb, var(--accent), transparent 86%), var(--surface));
}
.card strong {
  display: block;
  margin-top: 28px;
  color: var(--ink);
  font-size: 1.35rem;
}
.proof {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(300px, 1fr);
  gap: 30px;
}
blockquote {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 3.2rem);
  line-height: 1.08;
}
.proof-stack { padding: 28px; }
.metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 28px;
}
.metric-row div {
  border-top: 1px solid color-mix(in srgb, var(--ink), transparent 82%);
  padding-top: 14px;
}
.metric-row strong,
.metric-row span { display: block; }
.metric-row strong {
  color: var(--accent);
  font-size: 1.8rem;
}
.metric-row span {
  color: var(--muted);
  font-size: 0.86rem;
}
.process ol {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.process li {
  display: grid;
  grid-template-columns: minmax(160px, 0.4fr) minmax(0, 1fr);
  gap: 18px;
  padding: 18px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ink), transparent 84%);
}
details {
  padding: 20px;
}
summary {
  cursor: pointer;
  font-weight: 900;
}
.contact {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
  gap: 30px;
}
form {
  display: grid;
  gap: 14px;
  padding: 24px;
}
label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 0.9rem;
}
input,
textarea {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--ink), transparent 78%);
  background: color-mix(in srgb, var(--bg), transparent 24%);
  color: var(--ink);
  padding: 14px;
  font: inherit;
}
textarea { min-height: 132px; resize: vertical; }
input:focus,
textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--accent), transparent 45%);
  border-color: var(--accent);
}

@media (max-width: 900px) {
  .hero,
  .packages,
  .proof,
  .contact,
  .intro-grid,
  .cards,
  .faq-grid {
    grid-template-columns: 1fr;
  }
  .hero { min-height: auto; }
  .nav { align-items: flex-start; flex-direction: column; }
  .process li { grid-template-columns: 1fr; }
  .metric-row { grid-template-columns: 1fr; }
}
`;
}

function js(profile: SiteProfile) {
  return `document.querySelector("form button")?.addEventListener("click", () => {
  const name = document.querySelector('input[name="name"]')?.value || "there";
  alert("Thanks, " + name + ". ${escapeJs(profile.title)} will follow up soon.");
});
`;
}

function readme(profile: SiteProfile, prompt: string) {
  return `# ${profile.title}

Generated by MAGI.

## Original Prompt

${prompt}

## Run

Open \`index.html\` in a browser.

## Customize

- Replace package names and prices.
- Add real photography or before/after proof.
- Connect the form in \`script.js\` to your backend or booking tool.
- Update testimonials, metrics, and contact details.
`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "magi-site"
  );
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
