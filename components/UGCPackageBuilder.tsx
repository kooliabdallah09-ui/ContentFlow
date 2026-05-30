'use client'

import { useState } from 'react'
import { Zap, CheckCircle2 } from 'lucide-react'
import AvatarPicker from '@/components/AvatarPicker'

interface UGCPackageBuilderProps {
  onGenerate: (settings: {
    ugcType: string
    productName: string
    productDescription: string
    benefits: string
    callToAction: string
    style: string
    imageSize: string
    avatarId: string
    voiceId: string
  }) => Promise<void>
  isLoading: boolean
  creditBalance: number
}

const UGC_TYPES = [
  {
    id: 'image-with-voiceover',
    name: 'Image + Voiceover',
    description: 'Professional product image with AI voiceover script',
    credits: 230,
  },
  {
    id: 'video-with-voiceover',
    name: 'Video + Voiceover',
    description: 'AI avatar video with synchronized voiceover',
    credits: 450,
  },
  {
    id: 'all',
    name: 'Complete UGC Package',
    description: 'Image + Voice + Video (all three components)',
    credits: 530,
  },
]

export default function UGCPackageBuilder({
  onGenerate,
  isLoading,
  creditBalance,
}: UGCPackageBuilderProps) {
  const [ugcType, setUgcType] = useState('all')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [callToAction, setCallToAction] = useState('Buy now!')
  const [style, setStyle] = useState('realistic')
  const [imageSize, setImageSize] = useState('1024x1024')
  const [avatarId, setAvatarId] = useState('')
  const [voiceId, setVoiceId] = useState('1bd001e7e50f421d891986aad5158bc8')

  const selectedType = UGC_TYPES.find((t) => t.id === ugcType)
  const creditCost = selectedType?.credits || 0
  const canGenerate =
    creditBalance >= creditCost &&
    productName.trim().length > 0 &&
    productDescription.trim().length > 0 &&
    benefits.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canGenerate || isLoading) return

    try {
      await onGenerate({
        ugcType,
        productName,
        productDescription,
        benefits,
        callToAction,
        style,
        imageSize,
        avatarId,
        voiceId,
      })
      setProductName('')
      setProductDescription('')
      setBenefits('')
    } catch {
      // Error handled in parent
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-600 text-white/90 mb-3">
          UGC Package Type
        </label>
        <div className="space-y-2">
          {UGC_TYPES.map((type) => (
            <label
              key={type.id}
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition ${
                ugcType === type.id
                  ? 'bg-cyan-500/10 border-cyan-400'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name="ugcType"
                value={type.id}
                checked={ugcType === type.id}
                onChange={(e) => setUgcType(e.target.value)}
                disabled={isLoading}
                className="accent-cyan-400 cursor-pointer mt-1"
              />
              <div className="ml-3 flex-1">
                <p className="font-600 text-white">{type.name}</p>
                <p className="text-xs text-white/60 mt-1">{type.description}</p>
                <p className="text-sm font-600 text-cyan-400 mt-2">
                  {type.credits} credits
                </p>
              </div>
              {ugcType === type.id && (
                <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Product Name *
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g., Premium Coffee Maker"
            className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Product Description *
          </label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Describe your product features and what makes it special"
            className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition h-20 resize-none"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Key Benefits *
          </label>
          <textarea
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            placeholder="List main benefits (e.g., Fast brewing, Temperature control, Energy efficient)"
            className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition h-20 resize-none"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Call to Action
          </label>
          <input
            type="text"
            value={callToAction}
            onChange={(e) => setCallToAction(e.target.value)}
            placeholder="e.g., Order now, Get yours today"
            className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
            disabled={isLoading}
          />
        </div>
      </div>

      {(ugcType === 'image-with-voiceover' || ugcType === 'all') && (
        <div>
          <label className="block text-sm font-600 text-white/90 mb-2">
            Image Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
            disabled={isLoading}
          >
            <option value="realistic">Realistic</option>
            <option value="artistic">Artistic</option>
            <option value="professional">Professional</option>
            <option value="minimalist">Minimalist</option>
          </select>
        </div>
      )}

      {(ugcType === 'video-with-voiceover' || ugcType === 'all') && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-600 text-white/90 mb-3">
              Choose Avatar
            </label>
            <AvatarPicker
              selectedId={avatarId}
              onChange={setAvatarId}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-600 text-white/90 mb-2">
              Voice
            </label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-lg text-white focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition"
              disabled={isLoading}
            >
              <option value="1bd001e7e50f421d891986aad5158bc8">Sofia — American Female</option>
              <option value="2d5b0e6cf36f460aa7fc47e3eee4ba54">James — American Male</option>
              <option value="e749e866b30d47e4858cac12a6d13f2f">Emma — British Female</option>
              <option value="1588bf4c1db74e1dbba1c7b2e9f54b14">Oliver — British Male</option>
            </select>
          </div>
        </div>
      )}

      <div className="pt-2 space-y-3 border-t border-white/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Total Credit Cost:</span>
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
          <Zap className="w-5 h-5" />
          {isLoading ? 'Generating Package...' : 'Generate UGC Package'}
        </button>

        {!canGenerate && (
          <p className="text-xs text-red-400 text-center">
            {creditBalance < creditCost
              ? `Not enough credits. Need ${creditCost}, have ${creditBalance}`
              : 'Please fill in all required fields'}
          </p>
        )}
      </div>
    </div>
  )
}
