import { getInstallUrl } from "@/lib/env";

export function Nav({ variant = "light" }: { variant?: "light" | "dark" }) {
  const installUrl = getInstallUrl();

  return (
    <header className={`nav nav--${variant}`}>
      <div className="nav-inner">
        <a href="/" className="logo-script logo-script--blue">
          MergeGraph
        </a>
        <nav className="nav-links" aria-label="Main">
          <a href="#product">Product</a>
          <a
            href="https://github.com/chronogist/mergegraph/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
          <a href="#install">Install</a>
        </nav>
        <a className="nav-install" href={installUrl}>
          Install App
        </a>
      </div>
    </header>
  );
}