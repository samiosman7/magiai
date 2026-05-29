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

type SiteContent = {
  nav: {
    packages: string;
    proof: string;
    process: string;
    contact: string;
  };
  panelLabel: string;
  panelText: string;
  introKicker: string;
  introHeading: string;
  introItems: Array<{ title: string; body: string }>;
  packagesKicker: string;
  packagesHeading: string;
  cards: Array<{ tag: string; title: string; body: string; price: string }>;
  proofKicker: string;
  proofHeading: string;
  proofBody: string;
  quote: string;
  metrics: Array<{ value: string; label: string }>;
  processKicker: string;
  processHeading: string;
  steps: Array<{ title: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
  contactKicker: string;
  contactHeading: string;
  requestLabel: string;
  requestPlaceholder: string;
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
  const content = contentForProfile(profile);

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
        <a href="#packages">${escapeHtml(content.nav.packages)}</a>
        <a href="#proof">${escapeHtml(content.nav.proof)}</a>
        <a href="#process">${escapeHtml(content.nav.process)}</a>
        <a href="#contact">${escapeHtml(content.nav.contact)}</a>
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
          <span class="panel-label">${escapeHtml(content.panelLabel)}</span>
          <strong>${escapeHtml(profile.proofMetric)}</strong>
          <p>${escapeHtml(content.panelText)}</p>
        </aside>
      </section>

      <section class="section intro">
        <p class="section-kicker">${escapeHtml(content.introKicker)}</p>
        <h2>${escapeHtml(content.introHeading)}</h2>
        <div class="intro-grid">
          <article>
            <span>01</span>
            <h3>${escapeHtml(content.introItems[0].title)}</h3>
            <p>${escapeHtml(content.introItems[0].body)}</p>
          </article>
          <article>
            <span>02</span>
            <h3>${escapeHtml(content.introItems[1].title)}</h3>
            <p>${escapeHtml(content.introItems[1].body)}</p>
          </article>
          <article>
            <span>03</span>
            <h3>${escapeHtml(content.introItems[2].title)}</h3>
            <p>${escapeHtml(content.introItems[2].body)}</p>
          </article>
        </div>
      </section>

      <section class="section packages" id="packages">
        <div>
          <p class="section-kicker">${escapeHtml(content.packagesKicker)}</p>
          <h2>${escapeHtml(content.packagesHeading)}</h2>
        </div>
        <div class="cards">
          <article class="card">
            <p class="tag">${escapeHtml(content.cards[0].tag)}</p>
            <h3>${escapeHtml(content.cards[0].title)}</h3>
            <p>${escapeHtml(content.cards[0].body)}</p>
            <strong>${escapeHtml(content.cards[0].price)}</strong>
          </article>
          <article class="card featured">
            <p class="tag">${escapeHtml(content.cards[1].tag)}</p>
            <h3>${escapeHtml(content.cards[1].title)}</h3>
            <p>${escapeHtml(content.cards[1].body)}</p>
            <strong>${escapeHtml(content.cards[1].price)}</strong>
          </article>
          <article class="card">
            <p class="tag">${escapeHtml(content.cards[2].tag)}</p>
            <h3>${escapeHtml(content.cards[2].title)}</h3>
            <p>${escapeHtml(content.cards[2].body)}</p>
            <strong>${escapeHtml(content.cards[2].price)}</strong>
          </article>
        </div>
      </section>

      <section class="section proof" id="proof">
        <div class="proof-copy">
          <p class="section-kicker">${escapeHtml(content.proofKicker)}</p>
          <h2>${escapeHtml(content.proofHeading)}</h2>
          <p>${escapeHtml(content.proofBody)}</p>
        </div>
        <div class="proof-stack">
          <blockquote>
            "${escapeHtml(content.quote)}"
          </blockquote>
          <div class="metric-row">
            <div><strong>${escapeHtml(content.metrics[0].value)}</strong><span>${escapeHtml(content.metrics[0].label)}</span></div>
            <div><strong>${escapeHtml(content.metrics[1].value)}</strong><span>${escapeHtml(content.metrics[1].label)}</span></div>
            <div><strong>${escapeHtml(content.metrics[2].value)}</strong><span>${escapeHtml(content.metrics[2].label)}</span></div>
          </div>
        </div>
      </section>

      <section class="section process" id="process">
        <p class="section-kicker">${escapeHtml(content.processKicker)}</p>
        <h2>${escapeHtml(content.processHeading)}</h2>
        <ol>
          <li><strong>${escapeHtml(content.steps[0].title)}</strong><span>${escapeHtml(content.steps[0].body)}</span></li>
          <li><strong>${escapeHtml(content.steps[1].title)}</strong><span>${escapeHtml(content.steps[1].body)}</span></li>
          <li><strong>${escapeHtml(content.steps[2].title)}</strong><span>${escapeHtml(content.steps[2].body)}</span></li>
        </ol>
      </section>

      <section class="section faq">
        <p class="section-kicker">FAQ</p>
        <div class="faq-grid">
          <details open>
            <summary>${escapeHtml(content.faqs[0].question)}</summary>
            <p>${escapeHtml(content.faqs[0].answer)}</p>
          </details>
          <details>
            <summary>${escapeHtml(content.faqs[1].question)}</summary>
            <p>${escapeHtml(content.faqs[1].answer)}</p>
          </details>
          <details>
            <summary>${escapeHtml(content.faqs[2].question)}</summary>
            <p>${escapeHtml(content.faqs[2].answer)}</p>
          </details>
        </div>
      </section>

      <section class="section contact" id="contact">
        <div>
          <p class="section-kicker">${escapeHtml(content.contactKicker)}</p>
          <h2>${escapeHtml(content.contactHeading)}</h2>
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
            ${escapeHtml(content.requestLabel)}
            <textarea name="message" placeholder="${escapeHtml(content.requestPlaceholder)}"></textarea>
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

function contentForProfile(profile: SiteProfile): SiteContent {
  if (profile.category === "premium mobile detailing") {
    return {
      nav: { packages: "Packages", proof: "Results", process: "Process", contact: "Book" },
      panelLabel: "Detailing signal",
      panelText: "Built for owners comparing paint-safe service, interior reset quality, and appointment convenience.",
      introKicker: "What gets cleaned",
      introHeading: "A driveway detail that feels closer to a studio appointment.",
      introItems: [
        {
          title: "Paint-safe wash",
          body: "Foam pre-soak, two-bucket contact wash, wheel faces, tires, door jambs, and towel-dried finishing.",
        },
        {
          title: "Interior reset",
          body: "Vacuuming, mats, vents, cupholders, leather or fabric care, glass, and odor-focused touchpoints.",
        },
        {
          title: "Protection options",
          body: "Spray sealant, clay towel decontamination, and ceramic upgrade paths for longer-lasting gloss.",
        },
      ],
      packagesKicker: "Detail packages",
      packagesHeading: "Choose by vehicle condition, not vague package names.",
      cards: [
        {
          tag: "Maintenance",
          title: "Wash & tidy",
          body: "Exterior wash, wheels, tires, glass, vacuum, and quick interior wipe for regularly maintained cars.",
          price: "From $129",
        },
        {
          tag: "Most booked",
          title: "Full reset detail",
          body: "Deep interior cleaning plus exterior decontamination and gloss protection for daily drivers.",
          price: "From $289",
        },
        {
          tag: "Protection",
          title: "Ceramic ready",
          body: "Decon wash, clay, light polish, panel prep, and coating consultation for longer-term protection.",
          price: "Custom quote",
        },
      ],
      proofKicker: "Results",
      proofHeading: "Show the paint, seats, wheels, and trim before asking for the booking.",
      proofBody: "Use this space for before-and-after galleries, review cards, paint gloss photos, and interior closeups.",
      quote: "My black SUV looked new again, and I never had to leave the house.",
      metrics: [
        { value: "4.9", label: "review average" },
        { value: "2-4h", label: "typical appointment" },
        { value: "100%", label: "mobile service" },
      ],
      processKicker: "Booking flow",
      processHeading: "From quote to clean car without shop drop-off friction.",
      steps: [
        { title: "Send vehicle details.", body: "Share vehicle size, condition, photos, and the service goal." },
        { title: "Confirm the package.", body: "Get the recommended detail, arrival window, and prep notes." },
        { title: "Meet in the driveway.", body: "The detailer arrives with tools, water plan, power plan, and products." },
      ],
      faqs: [
        { question: "Do you need water or power?", answer: "Most mobile setups can bring a water solution, but power access helps for extraction and polishing." },
        { question: "How long does a full detail take?", answer: "Most daily drivers take two to four hours depending on size and interior condition." },
        { question: "Can I add ceramic protection?", answer: "Yes. The site can route ceramic requests into a separate quote flow with vehicle photos." },
      ],
      contactKicker: "Book a detail",
      contactHeading: "Send the vehicle, condition, and the result you want.",
      requestLabel: "Vehicle details",
      requestPlaceholder: "Example: 2022 black Model Y, dog hair in cargo area, want interior reset and exterior gloss",
    };
  }

  if (profile.category === "modern hospitality") {
    return {
      nav: { packages: "Menu", proof: "Atmosphere", process: "Reservations", contact: "Contact" },
      panelLabel: "Tonight's table",
      panelText: "Built for guests deciding where to eat, what to order, and whether the room fits the occasion.",
      introKicker: "Dining point of view",
      introHeading: "Make the menu, room, and reservation feel like one decision.",
      introItems: [
        { title: "Signature dishes", body: "Lead with the plates people remember: seasonal starters, mains, desserts, and drinks." },
        { title: "Room tone", body: "Show the dining room, bar, patio, and table details so guests can picture the night." },
        { title: "Easy booking", body: "Put reservations, hours, location, and private dining requests where guests expect them." },
      ],
      packagesKicker: "Menu preview",
      packagesHeading: "Give guests enough flavor to book before they scroll away.",
      cards: [
        { tag: "Starter", title: "Seasonal small plates", body: "Shareable plates built around market produce, crisp textures, and bright sauces.", price: "From $14" },
        { tag: "Signature", title: "House entree", body: "The dish that anchors the restaurant story and appears in every review photo.", price: "From $28" },
        { tag: "Private dining", title: "Group table", body: "Family-style menus, wine pairings, and a clear inquiry path for events.", price: "Request menu" },
      ],
      proofKicker: "Atmosphere",
      proofHeading: "A restaurant site should make the room feel bookable.",
      proofBody: "Add dining room photography, plate closeups, chef notes, press mentions, and guest quotes.",
      quote: "The menu looked special without feeling fussy, and booking took under a minute.",
      metrics: [
        { value: "5-10pm", label: "dinner service" },
        { value: "24", label: "bar seats" },
        { value: "48h", label: "event reply" },
      ],
      processKicker: "Reservations",
      processHeading: "Help guests move from craving to confirmed table.",
      steps: [
        { title: "Pick the occasion.", body: "Dinner, drinks, date night, group event, or private dining." },
        { title: "Choose a time.", body: "Surface hours, party size, and booking links clearly." },
        { title: "Arrive hungry.", body: "Confirm location, parking notes, and menu highlights before arrival." },
      ],
      faqs: [
        { question: "Do you take walk-ins?", answer: "Use this answer for bar seating, waitlist rules, and peak-hour guidance." },
        { question: "Can you handle dietary restrictions?", answer: "List vegetarian, gluten-free, allergy, and chef-accommodation details here." },
        { question: "Do you host private events?", answer: "Point larger parties to a private dining inquiry with date, headcount, and budget." },
      ],
      contactKicker: "Contact",
      contactHeading: "Make reservations, questions, and private events easy to route.",
      requestLabel: "Dining request",
      requestPlaceholder: "Example: Friday dinner for 4 at 7:30, one vegetarian guest",
    };
  }

  if (profile.category === "creative portfolio") {
    return {
      nav: { packages: "Work", proof: "Case Studies", process: "Services", contact: "Contact" },
      panelLabel: "Portfolio signal",
      panelText: "Built for clients scanning taste, range, process, and whether the creator can own the brief.",
      introKicker: "Creative edge",
      introHeading: "Show the work like a point of view, not a file dump.",
      introItems: [
        { title: "Selected work", body: "Curate fewer projects with stronger context, outcomes, and visual rhythm." },
        { title: "Case study logic", body: "Explain the brief, constraints, decisions, and result so taste feels repeatable." },
        { title: "Clear services", body: "Make it obvious what someone can hire you for and how engagements start." },
      ],
      packagesKicker: "Services",
      packagesHeading: "Turn taste into a clear hiring path.",
      cards: [
        { tag: "Identity", title: "Brand system", body: "Logo, type, color, voice direction, and launch-ready brand assets.", price: "Project quote" },
        { tag: "Digital", title: "Website direction", body: "Art direction, page design, responsive system, and handoff notes.", price: "Project quote" },
        { tag: "Retainer", title: "Creative partner", body: "Ongoing design support for campaigns, content, decks, and launches.", price: "Monthly" },
      ],
      proofKicker: "Case studies",
      proofHeading: "Clients need to see the thinking behind the taste.",
      proofBody: "Add project thumbnails, before-state context, design decisions, and measurable launch outcomes.",
      quote: "The work felt elevated, but the process made it easy to trust.",
      metrics: [
        { value: "12", label: "selected projects" },
        { value: "3", label: "core services" },
        { value: "2wk", label: "discovery sprint" },
      ],
      processKicker: "Process",
      processHeading: "Make creative collaboration feel calm and professional.",
      steps: [
        { title: "Discovery.", body: "Clarify audience, references, constraints, deliverables, and success criteria." },
        { title: "Direction.", body: "Present a tight concept system with rationale and examples." },
        { title: "Delivery.", body: "Package files, usage notes, and next-step recommendations." },
      ],
      faqs: [
        { question: "What kinds of projects do you take?", answer: "Use this to qualify identity, web, campaign, editorial, or retainer work." },
        { question: "What is the typical timeline?", answer: "Most portfolio sites should state discovery, concept, revision, and delivery windows." },
        { question: "Can you work with existing teams?", answer: "Clarify collaboration with founders, marketers, engineers, and outside agencies." },
      ],
      contactKicker: "Start a brief",
      contactHeading: "Ask for the goal, timeline, and what needs to exist at the end.",
      requestLabel: "Project brief",
      requestPlaceholder: "Example: Brand identity and landing page for a new studio launching in August",
    };
  }

  if (profile.category === "software product") {
    return {
      nav: { packages: "Features", proof: "Metrics", process: "Workflow", contact: "Demo" },
      panelLabel: "Product signal",
      panelText: "Built for teams deciding whether the product solves a real workflow problem quickly.",
      introKicker: "Product clarity",
      introHeading: "Explain the workflow before listing features.",
      introItems: [
        { title: "Problem framing", body: "Name the painful handoff, delay, or operational mess the product removes." },
        { title: "Workflow proof", body: "Show inputs, automation, review, and output so the product feels concrete." },
        { title: "Adoption path", body: "Give teams a trial, demo, integration, or migration path without sales fog." },
      ],
      packagesKicker: "Features",
      packagesHeading: "Make each feature answer a buying objection.",
      cards: [
        { tag: "Automate", title: "Smart intake", body: "Capture requests, classify urgency, and route work to the right queue.", price: "Included" },
        { tag: "Coordinate", title: "Team workspace", body: "Shared status, approvals, comments, and handoff history in one place.", price: "Pro" },
        { tag: "Measure", title: "Ops dashboard", body: "Cycle time, throughput, backlog health, and escalation reporting.", price: "Business" },
      ],
      proofKicker: "Metrics",
      proofHeading: "Software pages need numbers, not adjectives.",
      proofBody: "Add activation metrics, integration logos, security notes, workflow screenshots, and customer outcomes.",
      quote: "The demo made the workflow obvious before we had to talk to sales.",
      metrics: [
        { value: "38%", label: "less manual routing" },
        { value: "12", label: "integrations" },
        { value: "SOC2", label: "ready controls" },
      ],
      processKicker: "Workflow",
      processHeading: "Show what happens from request to finished work.",
      steps: [
        { title: "Capture.", body: "Requests enter through form, email, API, or connected tools." },
        { title: "Route.", body: "Rules and model checks classify, enrich, and assign the work." },
        { title: "Resolve.", body: "Teams review, approve, measure, and improve the process." },
      ],
      faqs: [
        { question: "How fast can a team trial it?", answer: "State setup time, sample data options, and whether a demo workspace exists." },
        { question: "What tools does it integrate with?", answer: "List the first useful integrations and API/webhook support." },
        { question: "Is it secure enough for teams?", answer: "Include permissioning, data retention, audit logs, and compliance roadmap details." },
      ],
      contactKicker: "Book a demo",
      contactHeading: "Ask for team size, current workflow, and the blocker they want gone.",
      requestLabel: "Workflow details",
      requestPlaceholder: "Example: 35-person ops team, requests live in Slack and spreadsheets, need routing and SLA tracking",
    };
  }

  return {
    nav: { packages: "Services", proof: "Proof", process: "Process", contact: "Contact" },
    panelLabel: "Trust signal",
    panelText: "Built around the offer, the proof, and the fastest path to a serious inquiry.",
    introKicker: "Offer clarity",
    introHeading: "Make the service specific enough that the right buyer can self-select.",
    introItems: [
      { title: "Name the outcome", body: "Show what changes for the customer and what the service includes." },
      { title: "Make proof visible", body: "Use reviews, results, credentials, process details, and real examples." },
      { title: "Reduce uncertainty", body: "Answer pricing, timing, fit, and next-step questions before the form." },
    ],
    packagesKicker: "Services",
    packagesHeading: "Package the decision around real customer needs.",
    cards: [
      { tag: "Starter", title: "Focused service", body: "A clear entry point for customers who know the main problem they need solved.", price: "From $149" },
      { tag: "Most requested", title: "Complete service", body: "A deeper engagement with planning, delivery, polish, and follow-up.", price: "From $299" },
      { tag: "Custom", title: "Tailored engagement", body: "A scoped quote for larger goals, recurring needs, or more complex work.", price: "Custom quote" },
    ],
    proofKicker: "Proof",
    proofHeading: "Put the evidence close to the claim.",
    proofBody: "Add testimonials, measurable outcomes, representative work, certifications, or client logos.",
    quote: "The offer was clear, the process was simple, and I knew exactly what to do next.",
    metrics: [
      { value: "4.9", label: "review average" },
      { value: "24h", label: "reply target" },
      { value: "3", label: "service paths" },
    ],
    processKicker: "Process",
    processHeading: "Turn interest into a low-friction request.",
    steps: [
      { title: "Share the goal.", body: "Collect the minimum context needed to recommend the right service." },
      { title: "Confirm the scope.", body: "Explain timing, pricing, deliverables, and expectations." },
      { title: "Start the work.", body: "Give the customer a clear kickoff and communication path." },
    ],
    faqs: [
      { question: "How fast can this start?", answer: "Use this answer for availability, project timing, and first-step expectations." },
      { question: "Can the service be customized?", answer: "Explain which parts are fixed and which parts adapt to the customer." },
      { question: "What happens after I send the form?", answer: "Describe response time, quote process, and scheduling." },
    ],
    contactKicker: "Contact",
    contactHeading: "Ask for the goal, timeline, and the context that affects the quote.",
    requestLabel: "Request",
    requestPlaceholder: "Tell us what you need, your timeline, and any must-have details",
  };
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
