export function IntelligenceMockup() {
  return (
    <div className="mockup" aria-hidden>
      <div className="mockup-window">
        <div className="mockup-sidebar">
          <div className="mockup-sidebar-title">Pull requests</div>
          <div className="mockup-pr mockup-pr--active">#42 ADR: Redis caching</div>
          <div className="mockup-pr">#41 Fix auth middleware</div>
          <div className="mockup-pr">#39 Migrate to pgvector</div>
        </div>
        <div className="mockup-main">
          <div className="mockup-main-header">
            <span>ADR: Add Redis for session cache</span>
            <span className="mockup-diff">+186 −4</span>
          </div>
          <pre className="mockup-code">{`// packages/api/src/cache.ts
export function createCache(redis: Redis) {
  return {
    async get(key: string) {
      return redis.get(\`mg:\${key}\`);
    },
    async set(key: string, val: string) {
      await redis.setex(\`mg:\${key}\`, 3600, val);
    },
  };
}`}</pre>
        </div>
        <div className="mockup-intel">
          <div className="mockup-intel-label">MergeGraph</div>
          <strong>Related decision found</strong>
          <p>
            PR #28 discussed Redis vs in-memory for auth sessions. Team chose
            Redis for horizontal scaling — this ADR aligns with that tradeoff.
          </p>
          <div className="mockup-intel-actions">
            <span className="mockup-intel-btn mockup-intel-btn--primary">
              View sources
            </span>
            <span className="mockup-intel-btn">Dismiss</span>
          </div>
        </div>
      </div>
      <div className="mockup-badge">Cited answers in seconds</div>
    </div>
  );
}

export function LaptopMockup() {
  return (
    <div className="laptop" aria-hidden>
      <div className="laptop-screen">
        <div className="laptop-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="laptop-content">
          <div className="laptop-sidebar">
            <div className="laptop-file active">issue-comment.ts</div>
            <div className="laptop-file">pull-request.ts</div>
            <div className="laptop-file">retrieval.ts</div>
          </div>
          <pre className="laptop-code">{`@mergegraph why was Redis chosen?

→ Searching knowledge graph...
→ 3 nodes: decision, tradeoff, migration

### MergeGraph
Redis was chosen in PR #28 for
horizontal scaling. See ADR #42.

**Sources**
- github.com/.../pull/28
- github.com/.../pull/42`}</pre>
        </div>
      </div>
      <div className="laptop-base" />
    </div>
  );
}