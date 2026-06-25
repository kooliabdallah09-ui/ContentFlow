'use client'

import { useState, useRef } from 'react'
import { showError, showSuccess } from '@/lib/notifications'

const STYLES = [
  { id: 'minimal',  label: 'Minimal' },
  { id: 'bold',     label: 'Bold' },
  { id: 'dark',     label: 'Dark' },
  { id: 'gradient', label: 'Gradient' },
]

const ACCENT_COLORS = [
  { id: 'indigo',  hex: '#5B6BFF' },
  { id: 'rose',    hex: '#E84A6F' },
  { id: 'emerald', hex: '#10B981' },
  { id: 'amber',   hex: '#F59E0B' },
  { id: 'slate',   hex: '#475569' },
  { id: 'violet',  hex: '#7C3AED' },
]

interface FormData {
  name: string
  title: string
  company: string
  email: string
  phone: string
  website: string
  tagline: string
}

function darken(hex: string, amount = 50): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function CardPreview({ form, styleId, accentHex, logoSrc, previewRef }: {
  form: FormData
  styleId: string
  accentHex: string
  logoSrc: string | null
  previewRef?: React.RefObject<HTMLDivElement | null>
}) {
  const dark = darken(accentHex)

  const base: React.CSSProperties = {
    width: 420,
    height: 240,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
    userSelect: 'none',
  }

  if (styleId === 'minimal') {
    return (
      <div ref={previewRef} style={{ ...base, background: '#FFFFFF', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', border: '1px solid #e8e8e8' }}>
        <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {logoSrc && <img src={logoSrc} alt="logo" style={{ height: 28, marginBottom: 12, objectFit: 'contain' }} />}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: '#111', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 4 }}>
              {form.name || 'Your Name'}
            </div>
            <div style={{ width: 32, height: 2, background: accentHex, marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: '#555', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {form.title || 'Job Title'}
              {form.company ? ` · ${form.company}` : ''}
            </div>
            {form.tagline && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>{form.tagline}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {form.email && <span style={{ fontSize: 10.5, color: '#666' }}>{form.email}</span>}
            {form.phone && <span style={{ fontSize: 10.5, color: '#666' }}>{form.phone}</span>}
            {form.website && <span style={{ fontSize: 10.5, color: accentHex }}>{form.website}</span>}
          </div>
        </div>
      </div>
    )
  }

  if (styleId === 'bold') {
    return (
      <div ref={previewRef} style={{ ...base, background: '#FFFFFF', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: accentHex }} />
        <div style={{ padding: '24px 28px 24px 36px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {logoSrc && <img src={logoSrc} alt="logo" style={{ height: 24, marginBottom: 10, objectFit: 'contain' }} />}
            <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 28, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 6 }}>
              {form.name || 'Your Name'}
            </div>
            <div style={{ fontSize: 12, color: accentHex, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {form.title || 'Job Title'}
            </div>
            {form.company && (
              <div style={{ fontSize: 11, color: '#444', fontWeight: 500, marginTop: 2 }}>{form.company}</div>
            )}
            {form.tagline && (
              <div style={{ fontSize: 10.5, color: '#888', marginTop: 6, fontStyle: 'italic' }}>{form.tagline}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {form.email && <span style={{ fontSize: 10, color: '#555' }}>{form.email}</span>}
            {form.phone && <span style={{ fontSize: 10, color: '#555' }}>{form.phone}</span>}
            {form.website && <span style={{ fontSize: 10, color: accentHex, fontWeight: 600 }}>{form.website}</span>}
          </div>
        </div>
      </div>
    )
  }

  if (styleId === 'dark') {
    return (
      <div ref={previewRef} style={{ ...base, background: '#0f0f0f', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {logoSrc && <img src={logoSrc} alt="logo" style={{ height: 24, marginBottom: 12, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: '#ffffff', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 4 }}>
              {form.name || 'Your Name'}
            </div>
            <div style={{ fontSize: 12, color: accentHex, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4 }}>
              {form.title || 'Job Title'}
            </div>
            {form.company && (
              <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{form.company}</div>
            )}
            {form.tagline && (
              <div style={{ fontSize: 10.5, color: '#666', marginTop: 6, fontStyle: 'italic' }}>{form.tagline}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {form.email && <span style={{ fontSize: 10.5, color: '#aaa' }}>{form.email}</span>}
            {form.phone && <span style={{ fontSize: 10.5, color: '#aaa' }}>{form.phone}</span>}
            {form.website && <span style={{ fontSize: 10.5, color: accentHex }}>{form.website}</span>}
          </div>
        </div>
      </div>
    )
  }

  // gradient
  return (
    <div ref={previewRef} style={{ ...base, background: `linear-gradient(135deg, ${accentHex} 0%, ${dark} 100%)`, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
      <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {logoSrc && <img src={logoSrc} alt="logo" style={{ height: 26, marginBottom: 12, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 4 }}>
            {form.name || 'Your Name'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {form.title || 'Job Title'}
            {form.company ? ` · ${form.company}` : ''}
          </div>
          {form.tagline && (
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontStyle: 'italic' }}>{form.tagline}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {form.email && <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.8)' }}>{form.email}</span>}
          {form.phone && <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.8)' }}>{form.phone}</span>}
          {form.website && <span style={{ fontSize: 10.5, color: '#fff', fontWeight: 600 }}>{form.website}</span>}
        </div>
      </div>
    </div>
  )
}

export default function BusinessCardPage() {
  const [form, setForm] = useState<FormData>({
    name: '', title: '', company: '', email: '', phone: '', website: '', tagline: '',
  })
  const [styleId, setStyleId] = useState('dark')
  const [accentId, setAccentId] = useState('rose')
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const accentHex = ACCENT_COLORS.find(a => a.id === accentId)?.hex ?? '#5B6BFF'
  const canExport = form.name.trim().length >= 1

  function setField(key: keyof FormData, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function pickLogo(file: File | null) {
    if (!file) { setLogoSrc(null); return }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setLogoSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function exportCard() {
    if (!cardRef.current || loading) return
    setLoading(true)
    setError('')
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `business-card-${form.name.replace(/\s+/g, '-').toLowerCase() || 'card'}.png`
      a.click()
      showSuccess('Card exported', 'Your business card PNG is downloading')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      setError(msg)
      showError('Export failed', msg)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--bg-elev, var(--surface))',
    color: 'var(--ink)',
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '42px 40px 90px' }} className="bc-page">
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 8 }}>
          Create
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 52,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Business <em>Card</em>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-dim)', margin: '12px 0 0', maxWidth: 500, lineHeight: 1.55 }}>
          Fill in your details, pick a style, and download a print-ready PNG instantly.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 28, alignItems: 'start' }} className="bc-grid">

        {/* Left panel — form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Fields */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 4 }}>Details</div>
            {([
              ['name',    'Full Name *', 'Jane Smith'],
              ['title',   'Title / Role', 'Product Designer'],
              ['company', 'Company', 'Acme Inc.'],
              ['email',   'Email', 'jane@acme.com'],
              ['phone',   'Phone', '+1 555 000 0000'],
              ['website', 'Website', 'acme.com'],
              ['tagline', 'Tagline', 'Building products people love'],
            ] as [keyof FormData, string, string][]).map(([key, label, placeholder]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--ink-dim)', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={e => setField(key, e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* Style presets */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 12 }}>Style</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STYLES.map(s => {
                const active = styleId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyleId(s.id)}
                    style={{
                      padding: '8px 18px', borderRadius: 999,
                      background: active ? 'var(--ink)' : 'transparent',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? 'var(--on-ink)' : 'var(--ink-dim)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Accent color */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 12 }}>Accent Color</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccentId(a.id)}
                  title={a.id}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: a.hex,
                    border: accentId === a.id ? `3px solid var(--ink)` : '3px solid transparent',
                    outline: accentId === a.id ? `2px solid ${a.hex}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Logo upload */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 12 }}>Logo (optional)</div>
            {logoSrc ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={logoSrc} alt="logo" style={{ height: 40, maxWidth: 100, objectFit: 'contain', borderRadius: 6 }} />
                <button type="button" onClick={() => setLogoSrc(null)} style={{ fontSize: 12, color: 'var(--ink-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Remove</button>
              </div>
            ) : (
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 9,
                border: '1.5px dashed var(--border)',
                color: 'var(--ink-dim)', fontSize: 13,
                cursor: 'pointer',
              }}>
                <span>Upload logo</span>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => pickLogo(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          {/* Export button */}
          <button
            onClick={exportCard}
            disabled={!canExport || loading}
            style={{
              width: '100%',
              padding: '14px 0', borderRadius: 12,
              background: !canExport || loading ? 'var(--border)' : 'var(--ink)',
              color: !canExport || loading ? 'var(--ink-dim)' : 'var(--on-ink)',
              border: 'none',
              fontSize: 15, fontWeight: 700,
              cursor: !canExport || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '0.01em',
              transition: 'background 0.15s',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'bc-spin 0.8s linear infinite' }} />
                Exporting…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Download PNG
              </>
            )}
          </button>

          {!form.name.trim() && (
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', margin: 0, textAlign: 'center' }}>Enter a name to enable export</p>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger, #e84a4a)',
              color: 'var(--danger, #e84a4a)', fontSize: 13,
            }}>{error}</div>
          )}
        </div>

        {/* Right panel — live card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 40 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 24 }}>Live Preview</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CardPreview form={form} styleId={styleId} accentHex={accentHex} logoSrc={logoSrc} previewRef={cardRef} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', margin: '20px 0 0' }}>
            Updates as you type · exported at 3× resolution
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bc-spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) {
          .bc-page { padding: 24px 16px 90px !important; }
          .bc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
