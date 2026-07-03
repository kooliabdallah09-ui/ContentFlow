'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { showError, showSuccess } from '@/lib/notifications'

interface KeyRow {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<{ key: string; prefix: string } | null>(null)

  async function load() {
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/mcp-keys', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setKeys(data.keys ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) { showError('Missing name', 'Give the key a name (e.g. Claude Desktop)'); return }
    setCreating(true)
    try {
      const supabase = getSupabase()!
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/mcp-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create key')
      setNewKey({ key: data.key, prefix: data.prefix })
      setName('')
      await load()
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key? Anything using it will stop working immediately.')) return
    const supabase = getSupabase()!
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) return
    await fetch(`/api/mcp-keys?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    showSuccess('Revoked', 'Key is no longer active')
    await load()
  }

  const active = keys.filter(k => !k.revoked_at)
  const revoked = keys.filter(k => k.revoked_at)

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 32px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8 }}>
          SETTINGS / API KEYS
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 400, letterSpacing: '-0.01em', margin: '0 0 12px' }}>
          MCP <em>API keys</em>
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-dim)', maxWidth: 620, margin: 0, lineHeight: 1.65 }}>
          Connect ContentFlow to Claude Desktop, Cursor, Claude Code, or any MCP-compatible client. Each key ties to your account and can generate content on your behalf.
        </p>
      </div>

      {newKey && (
        <div style={{ padding: 20, border: '1.5px solid var(--ink)', borderRadius: 14, marginBottom: 32, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🔑</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Copy your key now</div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 12 }}>
                This is the only time you'll see the full key. Store it somewhere safe.
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  background: 'var(--bg)',
                  padding: '12px 14px',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  wordBreak: 'break-all',
                  marginBottom: 12,
                }}
              >
                {newKey.key}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(newKey.key); showSuccess('Copied', 'Key copied to clipboard') }}
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}
                >
                  Copy key
                </button>
                <button
                  onClick={() => setNewKey(null)}
                  style={{ background: 'transparent', border: '1px solid var(--line)', padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--ink)' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 24, border: '1px solid var(--line)', borderRadius: 14, marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Create a new key</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            placeholder="e.g. Claude Desktop"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            onClick={create}
            disabled={creating}
            style={{
              padding: '0 20px',
              borderRadius: 10,
              background: 'var(--ink)',
              color: 'var(--bg)',
              border: 'none',
              fontSize: 14,
              fontWeight: 500,
              cursor: creating ? 'wait' : 'pointer',
              opacity: creating ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {creating ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </div>

      <section style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Active keys</div>
        {loading && <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Loading…</div>}
        {!loading && active.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--ink-dim)', padding: 20, border: '1px dashed var(--line)', borderRadius: 12, textAlign: 'center' }}>
            No active keys yet. Create one above to start.
          </div>
        )}
        {active.map(k => (
          <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: '1px solid var(--line)', borderRadius: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {k.key_prefix}…
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>
                Created {new Date(k.created_at).toLocaleDateString()} · Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}
              </div>
            </div>
            <button
              onClick={() => revoke(k.id)}
              style={{ background: 'transparent', border: '1px solid var(--line)', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--ink)' }}
            >
              Revoke
            </button>
          </div>
        ))}
        {revoked.length > 0 && (
          <details style={{ marginTop: 20 }}>
            <summary style={{ fontSize: 13, color: 'var(--ink-dim)', cursor: 'pointer' }}>Revoked ({revoked.length})</summary>
            {revoked.map(k => (
              <div key={k.id} style={{ fontSize: 13, color: 'var(--ink-mute)', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                {k.name} · {k.key_prefix}… · revoked
              </div>
            ))}
          </details>
        )}
      </section>

      <section style={{ padding: 24, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>How to connect</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', lineHeight: 1.65, marginTop: 0 }}>
          <strong>Claude Desktop</strong> · edit <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>claude_desktop_config.json</code>:
        </p>
        <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, background: 'var(--bg)', padding: 16, border: '1px solid var(--line)', borderRadius: 10, overflow: 'auto', margin: '10px 0 18px' }}>{`{
  "mcpServers": {
    "contentflow": {
      "url": "https://contentflow-web.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_KEY_HERE"
      }
    }
  }
}`}</pre>
        <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: 0 }}>
          Tools available: <code>get_credit_balance</code>, <code>list_library</code>, <code>generate_social_captions</code>, <code>generate_image</code>.{' '}
          <Link href="/settings" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>Back to settings</Link>
        </p>
      </section>
    </main>
  )
}
