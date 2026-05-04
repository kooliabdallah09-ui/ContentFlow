'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar as CalendarIcon, CheckCircle, XCircle } from 'lucide-react'

interface ScheduledContent {
  id: string
  content_id: string
  scheduled_date: string
  platforms: string[]
  status: string
  content: {
    id: string
    title: string
    content_type: string
    body: string
  }
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [scheduledContent, setScheduledContent] = useState<ScheduledContent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  useEffect(() => {
    fetchScheduledContent()
  }, [currentDate])

  const fetchScheduledContent = async () => {
    try {
      setLoading(true)
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const response = await fetch(
        `/api/calendar/list?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )
      const data = await response.json()
      setScheduledContent(data.data || [])
    } catch (error) {
      console.error('Failed to fetch scheduled content:', error)
    } finally {
      setLoading(false)
    }
  }

  const getContentForDate = (date: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), date)
      .toISOString()
      .split('T')[0]

    return scheduledContent.filter(
      (item) => item.scheduled_date.split('T')[0] === dateStr
    )
  }

  const handleReschedule = async (contentId: string, newDate: Date) => {
    try {
      const response = await fetch('/api/calendar/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          newDate: newDate.toISOString(),
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Content rescheduled successfully' })
        fetchScheduledContent()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'Failed to reschedule' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Rescheduling failed' })
    }
  }

  const handleDelete = async (contentId: string) => {
    if (!confirm('Delete this scheduled content?')) return

    try {
      const response = await fetch('/api/calendar/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Scheduled content removed' })
        fetchScheduledContent()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'Failed to delete' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Deletion failed' })
    }
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth(currentDate) }, (_, i) => i)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .serif-headline { font-family: 'Fraunces', serif; font-weight: 700; }
        .glass-card { background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.7); }
        .btn-primary { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 10px 25px rgba(245, 158, 11, 0.2); transition: all 0.3s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(245, 158, 11, 0.35); }
        .calendar-day { min-h-24; border: 1px solid rgba(255, 255, 255, 0.2); }
        .calendar-day-number { font-weight: 600; color: #0f172a; }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-b border-white/20 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard" className="text-amber-600 hover:text-amber-700">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="serif-headline text-5xl text-slate-900 mb-3">Content Calendar</h1>
          <p className="text-slate-600 text-lg">
            Schedule and manage your content across all platforms
          </p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* Message Alert */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 border flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p
              className={`text-sm font-600 ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Calendar Controls */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="btn-primary px-4 py-2 text-white rounded-lg font-600 text-sm"
          >
            ← Previous
          </button>
          <h2 className="serif-headline text-3xl text-slate-900">{monthName}</h2>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="btn-primary px-4 py-2 text-white rounded-lg font-600 text-sm"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center font-600 text-slate-700 py-2 text-sm"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2 auto-rows-min">
            {/* Empty Days */}
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="calendar-day bg-slate-50/50 rounded-lg"></div>
            ))}

            {/* Actual Days */}
            {days.map((day) => {
              const content = getContentForDate(day)
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear()

              return (
                <div
                  key={day}
                  className={`calendar-day rounded-lg p-2 transition ${
                    isToday
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-white/50 hover:bg-white/70'
                  }`}
                >
                  <div className={`calendar-day-number text-sm mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {content.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-1 rounded truncate cursor-pointer hover:shadow-md transition group relative"
                        title={item.content.title}
                      >
                        {item.content.title.substring(0, 15)}
                        <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 bg-slate-900 text-white text-xs p-3 rounded-lg z-10">
                          <p className="font-600 mb-1">{item.content.title}</p>
                          <p className="text-xs text-slate-300 mb-2">
                            {item.platforms.join(', ')}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleReschedule(
                                  item.content_id,
                                  new Date(item.scheduled_date)
                                )
                              }
                              className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleDelete(item.content_id)}
                              className="text-xs bg-red-600 px-2 py-1 rounded hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Posts */}
        {scheduledContent.length > 0 && (
          <div className="glass-card rounded-2xl p-8">
            <h2 className="serif-headline text-2xl text-slate-900 mb-6">
              Upcoming Posts ({scheduledContent.length})
            </h2>
            <div className="space-y-4">
              {scheduledContent
                .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                .slice(0, 5)
                .map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-600 text-slate-900">{item.content.title}</h3>
                        <p className="text-sm text-slate-500">
                          {new Date(item.scheduled_date).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-600">
                          {item.content.content_type}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {item.content.body}
                    </p>
                    <div className="flex gap-2">
                      {item.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {scheduledContent.length === 0 && !loading && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <CalendarIcon className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <p className="text-slate-600 mb-4 text-lg font-500">No scheduled content yet</p>
            <Link
              href="/generate/blog"
              className="btn-primary px-6 py-2 text-white rounded-lg font-600 inline-block"
            >
              Create and Schedule Content
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
