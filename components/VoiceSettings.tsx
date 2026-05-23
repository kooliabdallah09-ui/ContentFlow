'use client'

import { useState } from 'react'
import { Volume2, Zap } from 'lucide-react'

interface VoiceSettingsProps {
  onGenerate: (settings: {
    text: string
    voiceId: string
    stability: number
    similarityBoost: number
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Warm, engaging American female' },
  { id: 'cjVigB5qzO86Huf0OWl1', name: 'Clyde', description: 'Deep, authoritative male' },
  { id: 'AZnzlk1XvdvUBZ4xNXUI', name: 'Domi', description: 'Strong Spanish accent female' },
  { id: 'CwhRBWXzygEsXDAw7dVj', name: 'Dave', description: 'Casual, friendly male' },
  { id: 'NM3f8KbDDMqs3UZLIu7G', name: 'Josh', description: 'Young, energetic male' },
]

export default function VoiceSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: VoiceSettingsProps) {
  const [text, setText] = useState('')
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [stability, setStability] = useState(0.5)
  const [similarityBoost, setSimilarityBoost] = useState(0.75)

  const creditCost = 150
  const charCount = text.length
  const maxChars = 5000
  const canGenerate = creditBalance >= creditCost && text.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ text, voiceId, stability, similarityBoost })
      setText('')
    } catch {
      // Error handled in parent
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Text to Synthesize
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          placeholder="Enter the text you want to convert to speech... Be clear and expressive."
          className="w-full px-4 py-3 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition h-40 resize-none"
          disabled={isLoading}
          maxLength={maxChars}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-white/50">
            {charCount} / {maxChars} characters
          </p>
          {charCount >= maxChars * 0.9 && (
            <p className="text-xs text-yellow-400">Approaching limit</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Voice Selection
        </label>
        <div className="space-y-2">
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
                <p className="text-xs text-white/50">{voice.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-white/90 mb-3">
            Stability
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={stability}
              onChange={(e) => setStability(parseFloat(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>Less Stable</span>
              <span className="font-600 text-white">{stability.toFixed(1)}</span>
              <span>More Stable</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-600 text-white/90 mb-3">
            Similarity Boost
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={similarityBoost}
              onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>Less Similar</span>
              <span className="font-600 text-white">{similarityBoost.toFixed(1)}</span>
              <span>More Similar</span>
            </div>
          </div>
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
          <Volume2 className="w-5 h-5" />
          {isLoading ? 'Generating...' : 'Generate Voice'}
        </button>

        {!canGenerate && text.trim().length > 0 && (
          <p className="text-xs text-red-400 text-center">
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
