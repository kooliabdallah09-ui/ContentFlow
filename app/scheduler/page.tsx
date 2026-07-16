'use client'

// Scheduler was YouTube-only. YouTube publishing has been removed from the
// app, so the page now shows a coming-soon placeholder while we build out
// scheduling for other platforms.

export default function SchedulerPage() {
  return (
    <main className="content" style={{ maxWidth: 720 }}>
      <div className="page-meta">STUDIO / SCHEDULER</div>
      <h1 className="page-title" style={{ marginBottom: 12 }}>Scheduler</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', lineHeight: 1.7, margin: '0 0 28px' }}>
        Auto-publish content on a schedule. Multi-platform support is on the way — say hi if you want a specific network prioritised.
      </p>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--ink-mute)' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-fade)' }}>Coming soon</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Multi-platform scheduling</div>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.55 }}>
          In the meantime, use the Library to download finished renders and post them yourself.
        </div>
      </div>
    </main>
  )
}
