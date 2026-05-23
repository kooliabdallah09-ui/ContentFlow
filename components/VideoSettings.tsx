'use client'

import { useState } from 'react'
import { Film, Zap } from 'lucide-react'

interface VideoSettingsProps {
  onGenerate: (settings: {
    script: string
    avatarId: string
    voiceId: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const AVATARS = [
  { id: 'avtr_1', name: 'Sarah', gender: 'Female', accent: 'American' },
  { id: 'avtr_2', name: 'James', gender: 'Male', accent: 'American' },
  { id: 'avtr_3', name: 'Sophia', gender: 'Female', accent: 'British' },
  { id: 'avtr_4', name: 'Lucas', gender: 'Male', accent: 'Australian' },
  { id: 'avtr_5', name: 'Maya', gender: 'Female', accent: 'Indian' },
]

const VOICES = [
  { id: 'en-US-Neural2-A', name: 'Professional Female', accent: 'American' },
  { id: 'en-US-Neural2-C', name: 'Professional Male', accent: 'American' },
  { id: 'en-GB-Neural2-A', name: 'British Female', accent: 'British' },
  { id: 'en-GB-Neural2-B', name: 'British Male', accent: 'British' },
  { id: 'en-AU-Neural2-A', name: 'Australian Female', accent: 'Australian' },
]

export default function VideoSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: VideoSettingsProps) {
  const [script, setScript] = useState('')
  const [avatarId, setAvatarId] = useState(AVATARS[0].id)
  const [voiceId, setVoiceId] = useState(VOICES[0].id)

  const creditCost = 300
  const charCount = script.length
  const maxChars = 3000
  const estimatedDuration = Math.ceil((script.split(/\s+/).length / 150) * 60)
  const canGenerate = creditBalance >= creditCost && script.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ script, avatarId, voiceId })
      setScript('')
    } catch {
      // Error handled in parent
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Video Script
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, maxChars))}
          placeholder="Write the script for your video. Be clear and engaging. Estimated duration will be shown below."
          className="w-full px-4 py-3 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition h-40 resize-none"
          disabled={isLoading}
          maxLength={maxChars}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-white/50">
            {charCount} / {maxChars} characters
          </p>
          {estimatedDuration > 0 && (
            <p className="text-xs text-cyan-400">
              Est. Duration: ~{estimatedDuration}s
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Select Avatar
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {AVATARS.map((avatar) => (
            <label
              key={avatar.id}
              className="flex items-center p-3 bg-white/5 border border-cyan-400/20 rounded-lg cursor-pointer hover:bg-white/10 hover:border-cyan-400/40 transition"
            >
              <input
                type="radio"
                name="avatar"
                value={avatar.id}
                checked={avatarId === avatar.id}
                onChange={(e) => setAvatarId(e.target.value)}
                disabled={isLoading}
                className="accent-cyan-400 cursor-pointer"
              />
              <div className="ml-3 flex-1">
                <p className="font-600 text-white">{avatar.name}</p>
                <p className="text-xs text-white/50">
                  {avatar.gender} • {avatar.accent}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Select Voice
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {VOICES.map((voice) => (
            <label
              key={voice.id}
              className="flex items-center p-3 bg-white/5 border border-cyan-400/20 rounded-lg cursor-pointer hover:bg-white/10 hover:border-cyan-400/40 transition"
            >
              <input
                type="radio"
                name="voice"
                value={voice.id}
                checked={voiceId === voice.id}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={isLoading}
                className="accent-cyan-400 cursor-pointer"
              />
              <div className="ml-3 flex-1">
                <p className="font-600 text-white">{voice.name}</p>
                <p className="text-xs text-white/50">{voice.accent}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Credit Cost:</span>
          <span className="font-600 text-cyan-400">{creditCost} credits</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Your Balance:</span>
          <span
            className={`font-600 ${
              creditBalance >= creditCost ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {creditBalance} credits
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canGenerate || isLoading}
          className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-white/10 disabled:to-white/10 disabled:text-white/50 text-white font-600 rounded-lg transition duration-200 flex items-center justify-center gap-2"
        >
          <Film className="w-5 h-5" />
          {isLoading ? 'Generating...' : 'Generate Video'}
        </button>

        {!canGenerate && script.trim().length > 0 && (
          <p className="text-xs text-red-400 text-center">
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
