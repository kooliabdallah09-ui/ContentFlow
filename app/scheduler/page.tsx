'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import { Icon } from '@/components/Icons'
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
    <div className="content">
      <div className="page-head">
        <div className="page-meta">
          <span className="dot" />
          <span className="eyebrow">Automation & Scheduling</span>
        </div>
        <h1 className="page-title">Content <em>Scheduler</em></h1>
        <p className="page-sub">Automate your content generation with scheduled jobs. Set it once and let the AI work for you.</p>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: '24px' }}>
          <h2 className="section-title" style={{ fontSize: '16px', marginBottom: '18px' }}>
            {editingJob ? 'Edit Job' : 'Create New Job'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-row">
              <label htmlFor="jobName" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                Job Name
              </label>
              <input
                id="jobName"
                type="text"
                placeholder="e.g., Weekly Blog Post"
                defaultValue={editingJob?.name || ''}
                className="input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-row">
                <label htmlFor="jobType" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Type
                </label>
                <select
                  id="jobType"
                  defaultValue={editingJob?.type || 'blog'}
                  className="select"
                >
                  <option value="blog">Blog Post</option>
                  <option value="social">Social Post</option>
                  <option value="email">Email</option>
                  <option value="image">Image</option>
                  <option value="voice">Voice</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="recurring" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Recurring
                </label>
                <select
                  id="recurring"
                  defaultValue={editingJob?.recurring || 'once'}
                  className="select"
                >
                  <option value="once">Once</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="scheduleTime" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                Schedule Time
              </label>
              <input
                id="scheduleTime"
                type="datetime-local"
                defaultValue={editingJob?.scheduledTime || ''}
                className="input"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setShowForm(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  showSuccess('Job scheduled successfully')
                  setShowForm(false)
                }}
                className="btn btn-primary"
              >
                <Icon.Sparkle style={{ width: 14, height: 14 }} />
                Save Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Button */}
      {!showForm && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => {
              setEditingJob(null)
              setShowForm(true)
            }}
            className="btn btn-primary"
          >
            <Icon.Sparkle style={{ width: 14, height: 14 }} />
            Schedule New Job
          </button>
        </div>
      )}

      {/* Jobs List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
          Loading scheduled jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color: 'var(--ink-mute)' }}><Icon.Calendar style={{ width: 36, height: 36 }} /></div>
          <p style={{ color: 'var(--ink)', fontSize: '14px', marginBottom: '12px' }}>No scheduled jobs yet</p>
          <p className="eyebrow">Schedule your first automated job</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '16px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                    {job.name}
                  </h3>
                  <p className="eyebrow" style={{ textTransform: 'capitalize' }}>
                    {job.type} • {getRecurringLabel(job.recurring)}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(job.id, job.enabled)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: job.enabled ? 'var(--good)' : 'var(--border)',
                    color: job.enabled ? 'var(--bg)' : 'var(--ink-dim)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {job.enabled ? '✓ Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Timing */}
              <div style={{ fontSize: '12px', color: 'var(--ink-dim)', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                {job.lastRun && (
                  <p style={{ marginBottom: '4px' }}>
                    Last: {new Date(job.lastRun).toLocaleDateString()}
                  </p>
                )}
                <p>Next: {getNextRunDisplay(job)}</p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setEditingJob(job)
                    setShowForm(true)
                  }}
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: '12px', padding: '8px 12px' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: '12px', padding: '8px 12px', color: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
