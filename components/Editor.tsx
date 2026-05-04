'use client'

import { useState } from 'react'

interface EditorProps {
  initialContent: string
  onSave: (content: string, title: string) => void
  onSchedule?: (content: string, title: string, date: Date, platforms: string[]) => void
  contentId?: string
}

export function Editor({ initialContent, onSave, onSchedule, contentId }: EditorProps) {
  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [schedulePlatforms, setSchedulePlatforms] = useState(['twitter', 'linkedin'])

  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length
  const charCount = content.length
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200))

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title')
      return
    }

    setIsSaving(true)
    try {
      await onSave(content, title)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('Failed to copy')
    }
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
    element.setAttribute('download', `${title || 'content'}.txt`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleSchedule = async () => {
    if (!title.trim() || !scheduleDate) {
      alert('Please enter a title and select a date')
      return
    }

    setIsSaving(true)
    try {
      await onSchedule?.(content, title, new Date(scheduleDate), schedulePlatforms)
      setSaved(true)
      setShowSchedule(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Failed to schedule')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        .editor-input { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .editor-input:focus { background: rgba(255, 255, 255, 0.9); border-color: rgba(59, 130, 246, 0.5); outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2); transition: all 0.3s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(59, 130, 246, 0.35); }
      `}</style>

      <div>
        <label className="block text-sm font-600 text-slate-700 mb-2">
          Content Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your content a descriptive title"
          className="editor-input w-full px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">{title.length}/60 characters recommended</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-600 text-slate-700">
            Content
          </label>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>📝 {wordCount} words</span>
            <span>⏱️ {estimatedReadTime} min read</span>
            <span>🔤 {charCount} chars</span>
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="editor-input w-full px-4 py-3 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
          rows={14}
          placeholder="Your content will appear here. Edit and refine as needed."
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !title.trim()}
          className="btn-primary col-span-2 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-600 text-sm"
        >
          {isSaving ? '💾 Saving...' : '💾 Save to Library'}
        </button>
        <button
          onClick={handleCopy}
          disabled={!content.trim()}
          className="border border-slate-300 text-slate-700 py-3 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-600 text-sm transition"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        <button
          onClick={handleDownload}
          disabled={!content.trim()}
          className="border border-slate-300 text-slate-700 py-3 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-600 text-sm transition"
        >
          ⬇️ Download
        </button>
      </div>

      {onSchedule && (
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full border border-blue-300 text-blue-600 py-2 rounded-lg hover:bg-blue-50 font-600 text-sm transition mt-2"
        >
          📅 Schedule for Later
        </button>
      )}

      {showSchedule && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">
              Schedule Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-600 text-slate-700 mb-2">
              Publish to Platforms
            </label>
            <div className="space-y-2">
              {['twitter', 'linkedin'].map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={schedulePlatforms.includes(platform)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSchedulePlatforms([...schedulePlatforms, platform])
                      } else {
                        setSchedulePlatforms(schedulePlatforms.filter((p) => p !== platform))
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="capitalize text-slate-700 text-sm font-500">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSchedule}
              disabled={isSaving}
              className="flex-1 btn-primary text-white py-2 rounded-lg disabled:opacity-50 font-600 text-sm"
            >
              {isSaving ? '⏳ Scheduling...' : '✓ Schedule'}
            </button>
            <button
              onClick={() => setShowSchedule(false)}
              className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50 font-600 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-green-50 p-4 border border-green-200 animate-in">
          <p className="text-sm font-600 text-green-800">✓ Content saved to your library!</p>
        </div>
      )}
    </div>
  )
}
