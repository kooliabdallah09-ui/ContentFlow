'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Search, Download, Trash2, Eye, Filter } from 'lucide-react'
import { showError, showSuccess } from '@/lib/notifications'

interface LibraryItem {
  id: string
  content_type: string
  storage_url: string
  external_id: string
  metadata: any
  credit_cost: number
  created_at: string
  status: string
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
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

    const timer = setTimeout(() => {
      fetchLibrary()
    }, 300)

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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      image: 'bg-blue-900/30 text-blue-200 border-blue-700/50',
      voice: 'bg-purple-900/30 text-purple-200 border-purple-700/50',
      video: 'bg-pink-900/30 text-pink-200 border-pink-700/50',
      ugc_package: 'bg-cyan-900/30 text-cyan-200 border-cyan-700/50',
    }
    return colors[type] || 'bg-white/10 text-white/70 border-white/20'
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2">Content Library</h1>
          <p className="text-white/60">View and manage all your generated content</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
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
                className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 hover:bg-red-900/50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete {selectedItems.size}
              </button>
            )}
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-white/60">Loading your library...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-white/60 mb-2">No content found</div>
            {items.length === 0 && (
              <p className="text-white/40 text-sm">Start generating content to see it here</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-cyan-500/50 transition-colors"
              >
                {/* Preview/Thumbnail */}
                <div className="aspect-square bg-white/5 flex items-center justify-center relative overflow-hidden">
                  {item.content_type === 'image' ? (
                    <img
                      src={item.storage_url}
                      alt="Generated content"
                      className="w-full h-full object-cover"
                    />
                  ) : item.content_type === 'video' ? (
                    <video
                      src={item.storage_url}
                      className="w-full h-full object-cover"
                    />
                  ) : item.content_type === 'voice' ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">🎙️</div>
                      <span className="text-xs text-white/60">Audio</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">📦</div>
                      <span className="text-xs text-white/60">Package</span>
                    </div>
                  )}

                  {/* Overlay with Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <a
                      href={item.storage_url}
                      download
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedItems)
                      if (e.target.checked) {
                        newSet.add(item.id)
                      } else {
                        newSet.delete(item.id)
                      }
                      setSelectedItems(newSet)
                    }}
                    className="absolute top-2 left-2 w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${getTypeColor(
                        item.content_type
                      )}`}
                    >
                      {getTypeLabel(item.content_type)}
                    </span>
                    <span className="text-xs text-cyan-400">{item.credit_cost} credits</span>
                  </div>

                  <p className="text-xs text-white/60 line-clamp-2">
                    {item.metadata?.prompt ||
                      item.metadata?.text ||
                      item.metadata?.script ||
                      item.metadata?.productName ||
                      'Generated content'}
                  </p>

                  <p className="text-xs text-white/40 mt-2">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-black border border-white/10 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur">
              <h2 className="text-lg font-semibold">
                {getTypeLabel(previewItem.content_type)}
              </h2>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {previewItem.content_type === 'image' && (
                <img
                  src={previewItem.storage_url}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
              )}

              {previewItem.content_type === 'video' && (
                <video
                  src={previewItem.storage_url}
                  controls
                  className="w-full rounded-lg"
                />
              )}

              {previewItem.content_type === 'voice' && (
                <audio
                  src={previewItem.storage_url}
                  controls
                  className="w-full"
                />
              )}

              {previewItem.content_type === 'ugc_package' && (
                <div className="space-y-4">
                  {previewItem.metadata?.image && (
                    <div>
                      <h3 className="text-sm font-semibold text-white/80 mb-2">
                        Image
                      </h3>
                      <img
                        src={previewItem.metadata.image}
                        alt="Package image"
                        className="w-full rounded-lg max-h-64 object-cover"
                      />
                    </div>
                  )}

                  {previewItem.metadata?.voice && (
                    <div>
                      <h3 className="text-sm font-semibold text-white/80 mb-2">
                        Voiceover
                      </h3>
                      <audio
                        src={previewItem.metadata.voice}
                        controls
                        className="w-full"
                      />
                    </div>
                  )}

                  {previewItem.metadata?.video && (
                    <div>
                      <h3 className="text-sm font-semibold text-white/80 mb-2">
                        Video
                      </h3>
                      <video
                        src={previewItem.metadata.video}
                        controls
                        className="w-full rounded-lg max-h-64 object-cover"
                      />
                    </div>
                  )}

                  {previewItem.metadata?.productName && (
                    <div className="bg-white/5 rounded p-3 text-sm">
                      <p>
                        <span className="text-white/60">Product:</span>{' '}
                        <span className="text-white">
                          {previewItem.metadata.productName}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex gap-2">
                <a
                  href={previewItem.storage_url}
                  download
                  className="flex-1 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  onClick={() => handleDelete(previewItem.id)}
                  className="px-4 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-200 font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
