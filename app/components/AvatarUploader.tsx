'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  userId: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export default function AvatarUploader({ userId, currentUrl, onUploaded }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')

    // Client-side validation (the bucket can't enforce this on the free plan)
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 5 MB.')
      return
    }

    setUploading(true)
    try {
      // Always overwrite the same path so each user has one avatar.
      // Folder = userId, which is what the storage RLS policy checks.
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      // Public URL (avatars bucket is public). Cache-bust so the new
      // image shows immediately instead of the browser-cached old one.
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?v=${Date.now()}`

      setPreview(url)
      onUploaded(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-500 text-2xl">+</span>
        )}
      </div>

      <div>
        <label className="inline-block cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white transition">
          {uploading ? 'Uploading...' : 'Change photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
