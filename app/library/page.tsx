'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
import { showError, showSuccess } from '@/lib/notifications'
import Link from 'next/link'

interface LibraryItem {
  id: string
  content_type: string
  storage_url: string
  external_id: string
  metadata: any
  credit_cost: number
  created_at: string
  status: string
  drive_view_link?: string
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null)

  const fetchLibrary = async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user?.id) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/library', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
        setDriveConnected(data.driveConnected ?? false)
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
    const timer = setTimeout(() => {
      fetchLibrary()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.metadata?.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.metadata?.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.metadata?.script?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.metadata?.productName?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || item.content_type === filterType
    return matchesSearch && matchesFilter
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch(`/api/library/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id))
        setSelectedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        showSuccess('Item deleted')
      } else {
        showError('Failed to delete item')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
      showError('Failed to delete item')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.size} items?`)) return

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
        setItems((prev) => prev.filter((item) => !selectedItems.has(item.id)))
        setSelectedItems(new Set())
        showSuccess(`${selectedItems.size} items deleted`)
      } else {
        showError('Failed to delete items')
      }
    } catch (err) {
      console.error('Failed to bulk delete:', err)
      showError('Failed to delete items')
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      image: 'Image',
      voice: 'Voice',
      video: 'Video',
      ugc_package: 'UGC Package',
    }
    return labels[type] || type
  }

  return (
    <div className="content">
      <div className="page-head">
        <h1 className="page-title">Content <em>Library</em></h1>
        <p className="page-sub">View and manage all your generated content</p>
      </div>

      {/* Drive connection banner */}
      {driveConnected === false && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          gap: 16,
        }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              Connect Google Drive to see your library
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '3px 0 0' }}>
              Every generation is automatically saved to a ContentFlow folder in your Drive.
            </p>
          </div>
          <a
            href="/settings/integrations"
            style={{
              flexShrink: 0, padding: '8px 16px', borderRadius: 8,
              background: 'var(--ink)', color: '#fff', fontSize: 13,
              fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Connect Drive
          </a>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="lib-search">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <Icon.Search style={{ width: 16, height: 16, color: 'var(--ink-mute)' }} />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ flex: 1, background: 'transparent', border: 'none', padding: 0 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="select"
            style={{ padding: '10px 12px' }}
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="voice">Voices</option>
            <option value="video">Videos</option>
            <option value="ugc_package">UGC Packages</option>
          </select>

          {selectedItems.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="btn btn-ghost"
              style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon.X style={{ width: 14, height: 14 }} />
              Delete {selectedItems.size}
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
          Loading your library...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
          <p>No content found</p>
          {items.length === 0 && (
            <p style={{ fontSize: '13px', opacity: 0.7 }}>Start generating content to see it here</p>
          )}
        </div>
      ) : (
        <div className="lib-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="lib-card"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setPreviewItem(item)}
            >
              {/* Thumbnail */}
              <div className="lib-thumb">
                {item.content_type === 'image' ? (
                  <img
                    src={item.storage_url}
                    alt="Generated content"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : item.content_type === 'video' ? (
                  <video
                    src={item.storage_url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : item.content_type === 'voice' ? (
                  <div className="lib-thumb-label">Audio</div>
                ) : (
                  <div className="lib-thumb-label">Package</div>
                )}

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    const newSet = new Set(selectedItems)
                    if (e.target.checked) {
                      newSet.add(item.id)
                    } else {
                      newSet.delete(item.id)
                    }
                    setSelectedItems(newSet)
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: 'var(--accent)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Actions Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }} className="lib-card-overlay">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewItem(item)
                    }}
                    className="icon-btn"
                    style={{ padding: '8px', background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Icon.Search style={{ width: 16, height: 16 }} />
                  </button>
                  <a
                    href={item.storage_url}
                    download
                    className="icon-btn"
                    style={{ padding: '8px', background: 'rgba(255,255,255,0.15)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon.Arrow style={{ width: 16, height: 16 }} />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(item.id)
                    }}
                    className="icon-btn"
                    style={{ padding: '8px', background: 'rgba(200,0,0,0.3)', color: 'var(--danger)' }}
                  >
                    <Icon.X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="lib-meta">
                <div className="lib-type-row">
                  <span className="tag" style={{ padding: '4px 8px', fontSize: '11px' }}>
                    {getTypeLabel(item.content_type)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--accent)' }}>
                    {item.credit_cost} credits
                  </span>
                </div>

                <p className="lib-title">
                  {item.metadata?.prompt ||
                    item.metadata?.text ||
                    item.metadata?.script ||
                    item.metadata?.productName ||
                    'Generated content'}
                </p>

                <p className="lib-meta-row">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              position: 'sticky',
              top: 0,
              background: 'var(--bg)',
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                {getTypeLabel(previewItem.content_type)}
              </h2>
              <button
                onClick={() => setPreviewItem(null)}
                className="icon-btn"
                style={{ padding: '6px' }}
              >
                <Icon.X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px' }}>
              {previewItem.content_type === 'image' && (
                <img
                  src={previewItem.storage_url}
                  alt="Preview"
                  style={{ width: '100%', borderRadius: 'var(--r-md)' }}
                />
              )}

              {previewItem.content_type === 'video' && (
                <video
                  src={previewItem.storage_url}
                  controls
                  style={{ width: '100%', borderRadius: 'var(--r-md)' }}
                />
              )}

              {previewItem.content_type === 'voice' && (
                <audio
                  src={previewItem.storage_url}
                  controls
                  style={{ width: '100%' }}
                />
              )}

              {previewItem.content_type === 'ugc_package' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {previewItem.metadata?.image && (
                    <div>
                      <span className="eyebrow">Image</span>
                      <img
                        src={previewItem.metadata.image}
                        alt="Package image"
                        style={{ width: '100%', borderRadius: 'var(--r-md)', marginTop: '8px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  {previewItem.metadata?.voice && (
                    <div>
                      <span className="eyebrow">Voiceover</span>
                      <audio
                        src={previewItem.metadata.voice}
                        controls
                        style={{ width: '100%', marginTop: '8px' }}
                      />
                    </div>
                  )}

                  {previewItem.metadata?.video && (
                    <div>
                      <span className="eyebrow">Video</span>
                      <video
                        src={previewItem.metadata.video}
                        controls
                        style={{ width: '100%', borderRadius: 'var(--r-md)', marginTop: '8px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  {previewItem.metadata?.productName && (
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: '12px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--ink-fade)' }}>Product: </span>
                      <span style={{ color: 'var(--ink)' }}>{previewItem.metadata.productName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                <a
                  href={previewItem.storage_url}
                  download
                  className="btn btn-primary"
                  style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon.Arrow style={{ width: 14, height: 14 }} />
                  Download
                </a>
                {(previewItem.content_type === 'video' || previewItem.content_type === 'ugc_package') && previewItem.storage_url && (
                  <Link
                    href={`/editor?videoUrl=${encodeURIComponent(previewItem.storage_url)}`}
                    className="btn btn-ghost"
                    style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Edit in Editor
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleDelete(previewItem.id)
                    setPreviewItem(null)
                  }}
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}
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
        .lib-card:hover .lib-card-overlay {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
