'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Calendar, Clock, Plus, Trash2, Edit2, Play, Pause } from 'lucide-react'
import { showSuccess, showError } from '@/lib/notifications'

interface ScheduledJob {
  id: string
  type: string
  name: string
  settings: any
  scheduledTime: string
  recurring?: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/scheduler/jobs', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      } else {
        showError('Failed to load scheduled jobs')
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
      showError('Failed to load scheduled jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (jobId: string, enabled: boolean) => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch(`/api/scheduler/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ enabled: !enabled }),
      })

      if (response.ok) {
        setJobs(
          jobs.map((job) =>
            job.id === jobId ? { ...job, enabled: !enabled } : job
          )
        )
        showSuccess(`Job ${!enabled ? 'enabled' : 'disabled'}`)
      } else {
        showError('Failed to update job')
      }
    } catch (err) {
      console.error('Failed to toggle job:', err)
      showError('Failed to update job')
    }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this scheduled job?')) return

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch(`/api/scheduler/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        setJobs(jobs.filter((job) => job.id !== jobId))
        showSuccess('Job deleted')
      } else {
        showError('Failed to delete job')
      }
    } catch (err) {
      console.error('Failed to delete job:', err)
      showError('Failed to delete job')
    }
  }

  const getNextRunDisplay = (job: ScheduledJob) => {
    if (!job.nextRun) return 'Not scheduled'
    const date = new Date(job.nextRun)
    return date.toLocaleString()
  }

  const getRecurringLabel = (recurring?: string) => {
    if (!recurring) return 'Once'
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      hourly: 'Hourly',
    }
    return labels[recurring] || 'Once'
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-cyan-400" />
              <h1 className="text-4xl font-black">Content Scheduler</h1>
            </div>
            <button
              onClick={() => {
                setEditingJob(null)
                setShowForm(!showForm)
              }}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Schedule Job
            </button>
          </div>
          <p className="text-white/60">
            Automate your content generation with scheduled jobs
          </p>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">
              {editingJob ? 'Edit Job' : 'Create New Job'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Job Name</label>
                <input
                  type="text"
                  placeholder="e.g., Weekly Blog Post"
                  defaultValue={editingJob?.name || ''}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Type</label>
                  <select
                    defaultValue={editingJob?.type || 'blog'}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="blog">Blog Post</option>
                    <option value="social">Social Post</option>
                    <option value="email">Email</option>
                    <option value="image">Image</option>
                    <option value="voice">Voice</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">Recurring</label>
                  <select
                    defaultValue={editingJob?.recurring || 'once'}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="once">Once</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Schedule Time
                </label>
                <input
                  type="datetime-local"
                  defaultValue={editingJob?.scheduledTime || ''}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    showSuccess('Job scheduled successfully')
                    setShowForm(false)
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
                >
                  Save Job
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-white/60">Loading scheduled jobs...</div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Calendar className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white/60 mb-4">No scheduled jobs yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
            >
              Schedule your first job
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-6 bg-white/5 border border-white/10 rounded-lg hover:border-cyan-500/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{job.name}</h3>
                    <p className="text-sm text-white/60 mt-1 capitalize">
                      {job.type} • {getRecurringLabel(job.recurring)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(job.id, job.enabled)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      job.enabled
                        ? 'bg-green-900/30 text-green-300'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {job.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Timing Info */}
                <div className="space-y-2 mb-4 text-sm">
                  {job.lastRun && (
                    <p className="text-white/60">
                      Last run: {new Date(job.lastRun).toLocaleString()}
                    </p>
                  )}
                  <p className="text-white/60">Next run: {getNextRunDisplay(job)}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingJob(job)
                      setShowForm(true)
                    }}
                    className="flex-1 px-3 py-2 rounded border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="flex-1 px-3 py-2 rounded border border-red-700/50 text-red-300 text-sm font-medium hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
