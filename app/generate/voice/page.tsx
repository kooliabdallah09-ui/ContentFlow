'use client'

import { useRef, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { useCredits } from '@/lib/useCredits'
import { Loader2, Download, Play, Pause, Mic } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

// Pricing:
// ElevenLabs via Replicate (elevenlabs/turbo-v2.5): ~$0.25–0.40 per 1000 chars.
// We charge ceil(charCount / 100) * 2 credits, min 8 — gives consistent ~2x markup.
// OpenAI TTS-1-HD: $0.030 per 1000 chars — flat 5 credits covers any length safely.

const OPENAI_CREDITS = 5
const EL_CHAR_BLOCK = 100   // chars per credit block
const EL_CREDITS_PER_BLOCK = 2
const EL_MIN_CREDITS = 8
const EL_MAX_CHARS = 2000
const OPENAI_MAX_CHARS = 5000

function calcElevenLabsCredits(charCount: number): number {
  return Math.max(EL_MIN_CREDITS, Math.ceil(charCount / EL_CHAR_BLOCK) * EL_CREDITS_PER_BLOCK)
}

const VOICES = [
  { id: 's3TPKV1kjDlVtZbl4Ksh', label: 'Adam',   sub: 'Engaging & friendly',    gender: 'M', provider: 'elevenlabs' as const },
  { id: 'UaYTS0wayjmO9KD1LR4R', label: 'Asher',  sub: 'Confident & charismatic', gender: 'M', provider: 'elevenlabs' as const },
  { id: 'uYXf8XasLslADfZ2MB4u', label: 'Hope',   sub: 'Bubbly & vibrant',        gender: 'F', provider: 'elevenlabs' as const },
  { id: 'cVd39cx0VtXNC13y5Y7z', label: 'Hope 2', sub: 'Warm & innocent',         gender: 'F', provider: 'elevenlabs' as const },
  { id: 'openai:nova',    label: 'Nova',    sub: 'Bright & energetic',    gender: 'F', provider: 'openai' as const },
  { id: 'openai:shimmer', label: 'Shimmer', sub: 'Warm & friendly',       gender: 'F', provider: 'openai' as const },
  { id: 'openai:onyx',    label: 'Onyx',    sub: 'Deep & authoritative',  gender: 'M', provider: 'openai' as const },
  { id: 'openai:echo',    label: 'Echo',    sub: 'Smooth conversational', gender: 'M', provider: 'openai' as const },
]

interface AudioResult {
  url: string
  voiceLabel: string
  voiceProvider: string
  text: string
}

export default function VoicePage() {
  const [text, setText] = useState('')
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<AudioResult[]>([])
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([])
  const { balance: rawBalance, refresh: refreshCredits } = useCredits()
  const creditBalance = rawBalance ?? 0

  const selectedVoice = VOICES.find(v => v.id === voiceId) ?? VOICES[0]
  const charCount = text.length
  const maxChars = selectedVoice.provider === 'elevenlabs' ? EL_MAX_CHARS : OPENAI_MAX_CHARS
  const creditCost = selectedVoice.provider === 'elevenlabs'
    ? calcElevenLabsCredits(charCount)
    : OPENAI_CREDITS

  const canGenerate = charCount >= 3 && charCount <= maxChars && creditBalance >= creditCost

  async function generate() {
    if (!canGenerate || loading) return
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Auth not ready')
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: text.trim(), voiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setResults(prev => [{
        url: data.audioUrl,
        voiceLabel: selectedVoice.label,
        voiceProvider: selectedVoice.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI',
        text: text.trim(),
      }, ...prev])
      refreshCredits()
      showSuccess('Voiceover ready', `Generated with ${selectedVoice.label}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      showError('Generation failed', msg)
    } finally {
      setLoading(false)
    }
  }

  function togglePlay(idx: number) {
    const audio = audioRefs.current[idx]
    if (!audio) return
    if (playingIdx === idx) {
      audio.pause()
      setPlayingIdx(null)
    } else {
      if (playingIdx !== null) audioRefs.current[playingIdx]?.pause()
      audio.play()
      setPlayingIdx(idx)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '42px 40px 90px' }} className="voice-page">
      <header style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 54,
          lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0,
        }}>
          Voiceover
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-dim)', margin: '14px 0 0', maxWidth: 480, lineHeight: 1.55 }}>
          Turn any script into a studio-quality voiceover. Pick a voice and generate in seconds.
        </p>
      </header>

      {/* Composer card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Script textarea */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, maxChars))}
            placeholder="Paste your script here — product descriptions, reel captions, podcast intros, narration…"
            disabled={loading}
            rows={5}
            style={{
              width: '100%', resize: 'vertical', minHeight: 110,
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65,
              color: 'var(--ink)', padding: '4px 2px', boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute', bottom: 6, right: 4,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: charCount > maxChars * 0.9 ? 'var(--danger)' : 'var(--ink-faint)',
          }}>
            {charCount}/{maxChars}
          </span>
        </div>

        {/* Voice groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['elevenlabs', 'openai'] as const).map(provider => (
            <div key={provider} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--ink-mute)', marginRight: 2, minWidth: 66,
              }}>
                {provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}
              </span>
              {VOICES.filter(v => v.provider === provider).map(v => {
                const active = voiceId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    disabled={loading}
                    title={v.sub}
                    style={{
                      padding: '9px 18px', borderRadius: 999,
                      background: active ? 'var(--ink)' : 'var(--surface)',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--ink-2)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    {v.label}
                    <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 400 }}>{v.gender}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Generate row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={generate}
            disabled={!canGenerate || loading}
            style={{
              marginLeft: 'auto',
              padding: '11px 26px', borderRadius: 999,
              background: !canGenerate || loading ? 'var(--ink-faint)' : 'var(--ink)',
              color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600,
              cursor: !canGenerate || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Mic size={14} /> Generate</>}
          </button>
        </div>

        {/* Cost line */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12, color: 'var(--ink-mute)', paddingTop: 4,
          borderTop: '1px solid var(--border-soft)',
        }}>
          <span>
            {creditCost} credits
            {selectedVoice.provider === 'elevenlabs' && charCount > 0 && (
              <span style={{ color: 'var(--ink-faint)', marginLeft: 6 }}>
                · {charCount} chars · {selectedVoice.label} (ElevenLabs)
              </span>
            )}
            {selectedVoice.provider === 'openai' && (
              <span style={{ color: 'var(--ink-faint)', marginLeft: 6 }}>
                · {selectedVoice.label} (OpenAI)
              </span>
            )}
          </span>
          <span>Balance: <strong style={{ color: creditBalance >= creditCost ? 'var(--good)' : 'var(--danger)' }}>{creditBalance}</strong></span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 11,
          background: 'rgba(184,58,53,0.08)', border: '1px solid var(--danger)',
          color: 'var(--danger)', fontSize: 13,
        }}>{error}</div>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && (
        <div style={{
          marginTop: 24, padding: '32px 24px', borderRadius: 14,
          border: '1px solid var(--border)',
          background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Voiceover
          </span>
        </div>
      )}

      {/* Loading placeholder */}
      {loading && (
        <div style={{
          marginTop: 24, padding: '32px 24px', borderRadius: 14,
          border: '1px solid var(--border)',
          background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 120,
        }}>
          <Loader2 size={18} className="animate-spin" color="var(--ink-mute)" />
          <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Synthesizing voice…</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((r, idx) => (
            <div key={idx} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <button
                type="button"
                onClick={() => togglePlay(idx)}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--ink)', color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                {playingIdx === idx ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{r.voiceLabel}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{r.voiceProvider}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
                  {Array.from({ length: 48 }).map((_, i) => {
                    const h = 4 + Math.abs(Math.sin(i * 0.7 + idx) * 20)
                    return (
                      <div key={i} style={{
                        width: 3, height: h, borderRadius: 2,
                        background: playingIdx === idx ? 'var(--ink)' : 'var(--border-strong)',
                        transition: 'background 0.2s',
                      }} />
                    )
                  })}
                </div>
                <p style={{
                  fontSize: 11.5, color: 'var(--ink-mute)', margin: '6px 0 0',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.text.slice(0, 80)}{r.text.length > 80 ? '…' : ''}
                </p>
              </div>

              <a href={r.url} download={`voiceover-${r.voiceLabel}-${Date.now()}.mp3`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                  background: 'var(--bg-elev)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-dim)',
                }}>
                <Download size={14} />
              </a>

              <audio
                ref={el => { audioRefs.current[idx] = el }}
                src={r.url}
                onEnded={() => setPlayingIdx(null)}
                style={{ display: 'none' }}
              />
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .voice-page { padding: 24px 16px 90px !important; }
        }
      `}</style>
    </main>
  )
}
