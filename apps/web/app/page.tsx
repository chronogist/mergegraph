import { CtaButtons } from "./cta-buttons";
import { getInstallUrl } from "@/lib/env";

const FEATURES = [
  {
    num: "01",
    title: "Captures context automatically",
    body: "Merged PRs, closed issues, and releases become structured knowledge nodes — decisions, tradeoffs, incidents, lessons.",
  },
  {
    num: "02",
    title: "Answers with citations",
    body: "Mention @mergegraph on any issue or PR. Get grounded replies linked back to the GitHub threads they came from.",
  },
  {
    num: "03",
    title: "Backfills on install",
    body: "Add MergeGraph to a repo and it indexes recent history so new teammates aren't starting from zero.",
  },
];

const STEPS = [
  {
    title: "Install",
    body: "Connect MergeGraph to your org or repo and choose which repositories it can access.",
  },
  {
    title: "Build",
    body: "Merge PRs, close issues, ship releases — context is extracted in the background.",
  },
  {
    title: "Ask",
    body: "@mergegraph why was this built? What incidents hit this module? Get cited answers in seconds.",
  },
];

const QUESTIONS = [
  "Why was this feature implemented?",
  "What problem did this migration solve?",
  "Is this a good fix?",
  "What decisions affect auth?",
];

export default function HomePage() {
  const installUrl = getInstallUrl();

  return (
    <div className="page">
      <main className="container">
        <nav className="nav">
          <div className="logo">
            <div className="logo-mark" aria-hidden />
            MergeGraph
          </div>
          <a
            className="nav-link"
            href="https://github.com/chronogist/mergegraph"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-dot" aria-hidden />
            GitHub App · Built on 0G
          </div>

          <h1>
            Git stores code.
            <br />
            <span>MergeGraph stores context.</span>
          </h1>

          <p className="hero-lead">
            Turn repository activity into a living knowledge graph. Ask why
            decisions were made, what broke, and what changed — with answers
            cited from your repo history.
          </p>

          <CtaButtons installUrl={installUrl} />

          <p className="cta-note">
            You&apos;ll pick which repos MergeGraph can access — same flow as
            Dependabot or Codecov.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title">How it works</h2>
          <p className="section-lead">
            No manual docs. No wiki rot. Context flows from the work you
            already do.
          </p>
          <div className="flow">
            {STEPS.map((step) => (
              <div key={step.title} className="flow-step">
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">What you get</h2>
          <p className="section-lead">
            Engineering knowledge that outlasts contributor turnover.
          </p>
          <div className="grid-3">
            {FEATURES.map((feature) => (
              <article key={feature.num} className="card">
                <span className="card-num">{feature.num}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Ask anything</h2>
          <p className="section-lead">
            @mergegraph on any issue or pull request thread.
          </p>
          <div className="questions">
            {QUESTIONS.map((q) => (
              <span key={q} className="chip">
                {q}
              </span>
            ))}
          </div>
        </section>

        <section className="section" style={{ textAlign: "center" }}>
          <h2 className="section-title">Ready to remember why?</h2>
          <p className="section-lead" style={{ margin: "0 auto 1.5rem" }}>
            Install takes under a minute. Pick your repos and start merging.
          </p>
          <CtaButtons installUrl={installUrl} />
        </section>

        <footer className="footer">
          <span>MergeGraph — turn every merge into lasting engineering knowledge.</span>
          <a href={installUrl}>Install</a>
        </footer>
      </main>
    </div>
  );
}