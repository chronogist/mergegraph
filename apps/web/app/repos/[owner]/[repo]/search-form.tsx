"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({
  owner,
  repo,
  initialQuery = "",
}: {
  owner: string;
  repo: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        router.push(`/repos/${owner}/${repo}?${params.toString()}`);
      }}
    >
      <input
        className="input"
        name="q"
        placeholder="Why was Redis chosen?"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button className="btn btn-primary" type="submit">
        Search knowledge
      </button>
    </form>
  );
}