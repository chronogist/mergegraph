import { CtaButtons } from "./cta-buttons";
import { IntelligenceMockup, LaptopMockup } from "./mockup";
import { Nav } from "./nav";
import { getInstallUrl } from "@/lib/env";

const LUCKILY_LINES = [
  "Luckily the PR context is captured.",
  "Luckily the ADR is searchable.",
  "Luckily @mergegraph has the answer.",
  "Luckily you don't dig through 200 closed issues.",
];

const PILLARS = [
  {
    variant: "orange" as const,
    title: "Relevant.",
    body: "Every answer is grounded in your repo's PRs, issues, and releases — not generic AI guesses.",
  },
  {
    variant: "white" as const,
    title: "Cited.",
    body: "Responses link back to the GitHub threads they came from. Ask why, get sources.",
  },
  {
    variant: "outline" as const,
    title: "Living.",
    body: "Knowledge grows with every merge and close. Install once, backfill history, never start from zero.",
  },
];

export default function HomePage() {
  const installUrl = getInstallUrl();

  return (
    <>
      {/* Hero — Image 1 style */}
      <section className="hero-light" id="product">
        <Nav variant="light" />
        <div className="hero-headline">
          <h1 className="hero-headline-main">Merge PRs</h1>
          <span className="hero-headline-script">With context.</span>
        </div>
        <p className="hero-sub">
          The GitHub App that turns repository activity into a knowledge graph —
          so you can ask why decisions were made and get cited answers in
          seconds.
        </p>
        <CtaButtons installUrl={installUrl} align="center" />
        <div className="hero-wave" aria-hidden>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              fill="#ff6b00"
              d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,90 1440,80 L1440,120 L0,120 Z"
            />
          </svg>
        </div>
      </section>

      {/* Luckily — Image 2 style */}
      <section className="section-luckily">
        <div className="section-luckily-top">
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <span className="logo-script">MergeGraph</span>
          </div>
        </div>
        <div className="section-luckily-body">
          <div>
            <h2 className="luckily-headline">
              Luckily it remembered the <em>why.</em>
            </h2>
            <ul className="luckily-lines">
              {LUCKILY_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <LaptopMockup />
        </div>
      </section>

      {/* Intelligence — Image 3 style */}
      <section className="section-intel">
        <p className="intel-eyebrow">Knowledge layer</p>
        <h2 className="intel-headline">Deep context, zero config.</h2>
        <IntelligenceMockup />
      </section>

      {/* Pillars — Image 4 style */}
      <section className="section-pillars">
        <Nav variant="dark" />
        <div className="pillars-grid">
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className={`pillar pillar--${pillar.variant}`}
            >
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-footer-logo" aria-hidden>
        <span className="logo-script logo-script--orange logo-script--huge">
          MergeGraph
        </span>
      </section>

      {/* Final install CTA */}
      <section className="section-install" id="install">
        <h2>Ready to remember why?</h2>
        <p>Install on GitHub, pick your repos, start merging.</p>
        <CtaButtons installUrl={installUrl} align="center" />
      </section>
    </>
  );
}