'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Plus, Trash2, Play, Clock } from 'lucide-react'
import { showSuccess, showError } from '@/lib/notifications'

interface BatchItem {
  id: string
  settings: Record<string, any>
}

interface BatchJob {
  jobId: string
  status: string
  type: string
  progress: {
    completed: number
    failed: number
    pending: number
    total: number
    percentage: number
  }
}

export default function BatchPage() {
  const [batchType, setBatchType] = useState<'images' | 'voices' | 'videos'>('images')
  const [items, setItems] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [creditBalance, setCreditBalance] = useState(200)

  useEffect(() => {
    loadCredits()
  }, [])

  const loadCredits = async () => {
    const supabase = getSupabase()
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session?.access_token) return

    try {
      const response = await fetch('/api/credits/balance', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCreditBalance(data.balance)
      }
    } catch (err) {
      console.error('Failed to load credits:', err)
    }
  }

  const addItem = () => {
    const newItem: BatchItem = {
      id: `item-${Date.now()}`,
      settings: getDefaultSettings(),
    }
    setItems([...items, newItem])
  }

  const getDefaultSettings = () => {
    switch (batchType) {
      case 'images':
        return {
          prompt: '',
          style: 'realistic',
          size: '1024x1024',
          quantity: 1,
        }
      case 'voices':
        return {
          text: '',
          voiceId: 'rachel',
          stability: 0.5,
          similarityBoost: 0.75,
        }
      case 'videos':
        return {
          script: '',
          avatarId: 'sarah',
          voiceId: 'rachel',
        }
      default:
        return {}
    }
  }

  const updateItem = (id: string, settings: Record<string, any>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, settings } : item)))
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const calculateCreditCost = () => {
    const costs: Record<string, number> = {
      images: 80,
      voices: 150,
      videos: 300,
    }
    return items.length * (costs[batchType] || 0)
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      showError('No items to generate', 'Add at least one item to the batch')
      return
    }

    const totalCredits = calculateCreditCost()
    if (creditBalance < totalCredits) {
      showError('Insufficient credits', `Need ${totalCredits}, have ${creditBalance}`)
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch('/api/batch/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          type: batchType,
          items: items.map((item) => item.settings),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit batch')
      }

      const data = await response.json()
      showSuccess(
        'Batch submitted',
        `Processing ${items.length} items. Job ID: ${data.jobId}`
      )

      // Add to jobs list and clear items
      const newJob: BatchJob = {
        jobId: data.jobId,
        status: 'queued',
        type: batchType,
        progress: {
          completed: 0,
          failed: 0,
          pending: items.length,
          total: items.length,
          percentage: 0,
        },
      }
      setJobs([newJob, ...jobs])
      setItems([])
      setCreditBalance(creditBalance - totalCredits)
    } catch (err) {
      showError(
        'Batch submission failed',
        err instanceof Error ? err.message : 'Unknown error'
      )
    } finally {
      setLoading(false)
    }
  }

  const renderItemFields = (item: BatchItem) => {
    switch (batchType) {
      case 'images':
        return (
          <div className="space-y-3">
            <textarea
              placeholder="Image prompt..."
              value={item.settings.prompt}
              onChange={(e) =>
                updateItem(item.id, { ...item.settings, prompt: e.target.value })
              }
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
              rows={2}
            />
            <select
              value={item.settings.style}
              onChange={(e) =>
                updateItem(item.id, { ...item.settings, style: e.target.value })
              }
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="realistic">Realistic</option>
              <option value="artistic">Artistic</option>
              <option value="cartoon">Cartoon</option>
            </select>
          </div>
        )
      case 'voices':
        return (
          <textarea
            placeholder="Text to speak..."
            value={item.settings.text}
            onChange={(e) =>
              updateItem(item.id, { ...item.settings, text: e.target.value })
            }
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
            rows={2}
            maxLength={5000}
          />
        )
      case 'videos':
        return (
          <textarea
            placeholder="Video script..."
            value={item.settings.script}
            onChange={(e) =>
              updateItem(item.id, { ...item.settings, script: e.target.value })
            }
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
            rows={3}
            maxLength={3000}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Play className="w-6 h-6 text-cyan-400" />
            <h1 className="text-4xl font-black">Batch Generator</h1>
          </div>
          <p className="text-white/60">
            Generate multiple pieces of content at once to save time and credits
          </p>
        </div>

        {/* Credits Info */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">Available Credits</p>
            <p className="text-2xl font-black text-cyan-400">{creditBalance}</p>
          </div>
          <div>
            <p className="text-sm text-white/60 text-right">Batch Cost</p>
            <p className="text-2xl font-black text-white">
              {calculateCreditCost()} credits
            </p>
          </div>
        </div>

        {/* Type Selector */}
        <div className="mb-8">
          <p className="text-sm text-white/60 mb-3">Content Type</p>
          <div className="flex gap-3">
            {(['images', 'voices', 'videos'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setBatchType(type)
                  setItems([])
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  batchType === type
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mb-8 space-y-4">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 bg-white/5 border border-white/10 rounded-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white/70">Item {idx + 1}</span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 rounded hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
              {renderItemFields(item)}
            </div>
          ))}
        </div>

        {/* Add Button */}
        <div className="mb-8">
          <button
            onClick={addItem}
            className="w-full px-4 py-3 rounded-lg border border-dashed border-white/20 hover:border-cyan-500/50 text-white/60 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* Submit Button */}
        <div className="mb-8">
          <button
            onClick={handleSubmit}
            disabled={loading || items.length === 0 || creditBalance < calculateCreditCost()}
            className="w-full px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Submitting...' : `Submit Batch (${items.length} items)`}
          </button>
        </div>

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Jobs</h2>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.jobId}
                  className="p-4 bg-white/5 border border-white/10 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{job.type} batch</p>
                      <p className="text-xs text-white/40 mt-1">{job.jobId}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded ${
                        job.status === 'completed'
                          ? 'bg-green-900/30 text-green-300'
                          : job.status === 'failed'
                          ? 'bg-red-900/30 text-red-300'
                          : 'bg-blue-900/30 text-blue-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full transition-all"
                        style={{ width: `${job.progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-white/60">
                    {job.progress.completed} completed • {job.progress.pending} pending •{' '}
                    {job.progress.failed} failed
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
