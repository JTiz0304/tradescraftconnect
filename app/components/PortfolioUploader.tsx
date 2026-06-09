'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PortfolioImage = {
  id: string
  user_id: string
  image_url: string
  caption: string | null
  sort_order: number
  created_at: string
}

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES = 12

export default function PortfolioUploader({ userId }: { userId: string }) {
  const [images, setImages] = useState<PortfolioImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Load existing portfolio images
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('portfolio_images')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        setError('Could not load portfolio.')
      } else {
        setImages(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [userId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setError('')

    if (images.length + files.length > MAX_IMAGES) {
      setError(`Max ${MAX_IMAGES} images. You have ${images.length}.`)
      e.target.value = ''
      return
    }

    // Validate all files first
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.')
        e.target.value = ''
        return
      }
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" is over 5MB.`)
        e.target.value = ''
        return
      }
    }

    setUploading(true)

    const newRows: PortfolioImage[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('portfolios')
        .getPublicUrl(fileName)

      const { data: inserted, error: insertError } = await supabase
        .from('portfolio_images')
        .insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          sort_order: images.length + newRows.length,
        })
        .select()
        .single()

      if (insertError) {
        setError(`Save failed: ${insertError.message}`)
        continue
      }

      if (inserted) newRows.push(inserted as PortfolioImage)
    }

    setImages(prev => [...prev, ...newRows])
    setUploading(false)
    e.target.value = ''
  }

  const handleDelete = async (img: PortfolioImage) => {
    setError('')

    // Derive storage path from the public URL: everything after "/portfolios/"
    const marker = '/portfolios/'
    const idx = img.image_url.indexOf(marker)
    const path = idx !== -1 ? img.image_url.slice(idx + marker.length) : null

    if (path) {
      await supabase.storage.from('portfolios').remove([path])
    }

    const { error: deleteError } = await supabase
      .from('portfolio_images')
      .delete()
      .eq('id', img.id)

    if (deleteError) {
      setError(`Delete failed: ${deleteError.message}`)
      return
    }

    setImages(prev => prev.filter(i => i.id !== img.id))
  }

  if (loading) {
    return <p className="text-gray-400 text-sm animate-pulse">Loading portfolio...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{images.length} / {MAX_IMAGES} images</p>
        <label className={`text-sm border border-gray-700 px-4 py-2 rounded-xl transition cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-500 text-white'}`}>
          {uploading ? 'Uploading...' : '+ Add Photos'}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading || images.length >= MAX_IMAGES}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {images.length === 0 ? (
        <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl p-10 text-center">
          <p className="text-3xl mb-2">📷</p>
          <p className="text-gray-400 text-sm">No portfolio images yet. Add photos of your work.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map(img => (
            <div key={img.id} className="relative group aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt={img.caption ?? 'Portfolio'}
                className="w-full h-full object-cover rounded-xl border border-gray-700"
              />
              <button
                onClick={() => handleDelete(img)}
                className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition"
                aria-label="Delete image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}