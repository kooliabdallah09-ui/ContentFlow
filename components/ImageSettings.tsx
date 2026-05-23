'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'

interface ImageSettingsProps {
  onGenerate: (settings: {
    prompt: string
    style: string
    size: string
    quantity: number
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const STYLES = [
  'realistic',
  'artistic',
  'cartoon',
  'sketch',
  'photographic',
  'illustration',
  'digital-art',
  'fantasy',
]

const SIZES = [
  { label: '512×512', value: '512x512' },
  { label: '768×768', value: '768x768' },
  { label: '1024×1024', value: '1024x1024' },
]

export default function ImageSettings({
  onGenerate,
  isLoading,
  creditBalance,
}: ImageSettingsProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('realistic')
  const [size, setSize] = useState('1024x1024')
  const [quantity, setQuantity] = useState(1)

  const creditCost = 80 * quantity
  const canGenerate = creditBalance >= creditCost && prompt.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({ prompt, style, size, quantity })
      setPrompt('')
    } catch {
      // Error handling done in parent component
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Image Description
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate... Be detailed for better results"
          className="w-full px-4 py-3 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition h-32 resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-white/50 mt-2">
          {prompt.length} characters
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
            disabled={isLoading}
          >
            {STYLES.map((s) => (
              <option key={s} value={s} className="bg-black">
                {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Size
          </label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
            disabled={isLoading}
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value} className="bg-black">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          Number of Variations
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="4"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            disabled={isLoading}
            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="w-12 px-3 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white text-center font-600">
            {quantity}
          </div>
        </div>
        <p className="text-xs text-white/50 mt-2">
          {quantity > 1
            ? `Generating ${quantity} variations`
            : 'Single generation'}
        </p>
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
              creditBalance >= creditCost
                ? 'text-emerald-400'
                : 'text-red-400'
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
          <Zap className="w-5 h-5" />
          {isLoading ? 'Generating...' : 'Generate Image'}
        </button>

        {!canGenerate && prompt.trim().length > 0 && (
          <p className="text-xs text-red-400 text-center">
            Not enough credits. Need {creditCost}, have {creditBalance}
          </p>
        )}
      </div>
    </div>
  )
}
