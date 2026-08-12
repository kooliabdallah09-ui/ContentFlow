'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
import { showError, showSuccess } from '@/lib/notifications'
import Link from 'next/link'

interface LibraryItem {
  id: string
  name?: string
  content_type: string
  storage_url: string
  metadata: any
  credit_cost: number
  created_at: string
  status: string
}

function getVideoTitle(item: LibraryItem): string {
  if (item.name && item.name !== 'Video' && item.name !== 'unknown') return item.name
  const src = item.metadata?.source
  if (src === 'ugc') return 'UGC Video'
  if (src === 'video') return 'AI Video'
  if (src === 'podcast-ad') return 'Podcast Ad'
  if (src === 'screen-demo') return 'Screen Demo'
  if (src === 'scroll-stop') return 'Scroll-Stop Hook'
  if (src === 'editor') return 'Editor Export'
  return item.metadata?.productName || item.metadata?.prompt?.slice(0, 40) || 'Generated Video'
}

export default function LibraryPage() {
  const searchParams = useSearchParams()
  const campaignId = searchParams?.get('campaign') ?? null
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)
  const [campaignName, setCampaignName] = useState<string | null>(null)
  const [campaignAssetIds, setCampaignAssetIds] = useState<Set<string> | null>(null)

  const fetchLibrary = async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      if (!supabase) { setLoading(false); return }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) { setLoading(false); return }

      const response = await fetch('/api/library', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setItems(data.items ?? [])
      } else {
        showError('Failed to load library')
      }
    } catch (err) {
      console.error('Failed to fetch library:', err)
      showError('Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLibrary()
  }, [])

  useEffect(() => {
    if (!campaignId) { setCampaignName(null); setCampaignAssetIds(null); return }
    void (async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) return
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { showError('Failed to load campaign'); return }
        const data = await res.json()
        setCampaignName(data?.campaign?.name ?? 'Campaign')
        const ids = new Set<string>(
          (data?.shots ?? [])
            .map((s: { library_asset_id: string | null }) => s.library_asset_id)
            .filter((id: string | null): id is string => !!id)
        )
        setCampaignAssetIds(ids)
      } catch (err) {
        console.error('Failed to load campaign filter:', err)
      }
    })()
  }, [campaignId])

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase()
    const title = getVideoTitle(item).toLowerCase()
    const matchesSearch = !q ||
      title.includes(q) ||
      item.metadata?.prompt?.toLowerCase().includes(q) ||
      item.metadata?.productName?.toLowerCase().includes(q)
    const matchesCampaign = !campaignId || (campaignAssetIds?.has(item.id) ?? false)
    return matchesSearch && matchesCampaign
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch(`/api/library/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })

      if (response.ok) {
        setItems(prev => prev.filter(item => item.id !== id))
        setSelectedItems(prev => { const s = new Set(prev); s.delete(id); return s })
        setPreviewItem(null)
        showSuccess('Video deleted')
      } else {
        showError('Failed to delete video')
      }
    } catch {
      showError('Failed to delete video')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.size} videos?`)) return
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch('/api/library/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })

      if (response.ok) {
        setItems(prev => prev.filter(item => !selectedItems.has(item.id)))
        setSelectedItems(new Set())
        showSuccess(`${selectedItems.size} videos deleted`)
      } else {
        showError('Failed to delete videos')
      }
    } catch {
      showError('Failed to delete videos')
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <h1 className="page-title">Video <em>Library</em></h1>
        <p className="page-sub">All your generated videos in one place</p>
      </div>

      {campaignId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 18px', marginBottom: 16, gap: 16,
        }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            Filtered to campaign: <strong>{campaignName ?? '…'}</strong>
          </div>
          <Link href="/library" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            Clear filter
          </Link>
        </div>
      )}

      <div className="lib-search">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Icon.Search style={{ width: 16, height: 16, color: 'var(--ink-mute)' }} />
          <input
            type="text"
            placeholder="Search videos…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input"
            style={{ flex: 1, background: 'transparent', border: 'none', padding: 0 }}
          />
        </div>
        {selectedItems.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="btn btn-ghost"
            style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon.X style={{ width: 14, height: 14 }} />
            Delete {selectedItems.size}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.5, fontSize: 14 }}>
          Loading your videos…
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎬</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
            {campaignId ? 'No videos from this campaign yet' : 'No videos yet'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>
            {campaignId
              ? 'Open shots in the Builder to generate them.'
              : 'Generate a video and it will appear here automatically.'}
          </p>
          {!campaignId && (
            <Link
              href="/generate/ugc"
              style={{ display: 'inline-block', marginTop: 20, padding: '10px 22px', borderRadius: 10, background: 'var(--ink)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            >
              Go to Video Studio
            </Link>
          )}
        </div>
      ) : (
        <div className="lib-grid">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="lib-card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setPreviewItem(item)}
            >
              <div className="lib-thumb">
                <video
                  src={`${item.storage_url}${item.storage_url.includes('#') ? '' : '#t=0.1'}`}
                  preload="metadata"
                  muted
                  loop
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onMouseEnter={e => { e.currentTarget.play().catch(() => {}) }}
                  onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0.1 }}
                />

                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={e => {
                    e.stopPropagation()
                    const s = new Set(selectedItems)
                    if (e.target.checked) s.add(item.id); else s.delete(item.id)
                    setSelectedItems(s)
                  }}
                  style={{ position: 'absolute', top: 10, left: 10, width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  onClick={e => e.stopPropagation()}
                />

                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: 0, transition: 'opacity 0.2s',
                }} className="lib-card-overlay">
                  <button
                    onClick={e => { e.stopPropagation(); setPreviewItem(item) }}
                    className="icon-btn"
                    style={{ padding: 8, background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Icon.Search style={{ width: 16, height: 16 }} />
                  </button>
                  <a
                    href={item.storage_url}
                    download
                    className="icon-btn"
                    style={{ padding: 8, background: 'rgba(255,255,255,0.15)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <Icon.Arrow style={{ width: 16, height: 16 }} />
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                    className="icon-btn"
                    style={{ padding: 8, background: 'rgba(200,0,0,0.3)', color: 'var(--danger)' }}
                  >
                    <Icon.X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>

              <div className="lib-meta">
                <div className="lib-type-row">
                  <span className="tag" style={{ padding: '4px 8px', fontSize: 11 }}>Video</span>
                  {item.credit_cost > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>{item.credit_cost} cr</span>
                  )}
                </div>
                <p className="lib-title">{getVideoTitle(item)}</p>
                <p className="lib-meta-row">{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                {getVideoTitle(previewItem)}
              </h2>
              <button onClick={() => setPreviewItem(null)} className="icon-btn" style={{ padding: 6 }}>
                <Icon.X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <video
                src={previewItem.storage_url}
                controls
                autoPlay
                style={{ width: '100%', borderRadius: 12, background: '#000' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <a
                  href={previewItem.storage_url}
                  download
                  className="btn btn-primary"
                  style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={e => e.stopPropagation()}
                >
                  <Icon.Arrow style={{ width: 14, height: 14 }} />
                  Download
                </a>
                <Link
                  href={`/editor?videoUrl=${encodeURIComponent(previewItem.storage_url)}`}
                  className="btn btn-ghost"
                  style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={e => e.stopPropagation()}
                >
                  Edit in Editor
                </Link>
                <button
                  onClick={() => handleDelete(previewItem.id)}
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Icon.X style={{ width: 14, height: 14 }} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .lib-card:hover .lib-card-overlay { opacity: 1; }
      `}</style>
    </div>
  )
}
