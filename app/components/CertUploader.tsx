'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Certification = {
  id: string
  user_id: string
  file_url: string      // storage path
  file_name: string
  cert_name: string
  issuing_org: string | null
  expiry_date: string | null
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  created_at: string
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB (PDFs can be larger than images)
const ACCEPTED = ['image/', 'application/pdf']

export default function CertUploader({ userId }: { userId: string }) {
  const [certs, setCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // form state
  const [file, setFile] = useState<File | null>(null)
  const [certName, setCertName] = useState('')
  const [issuingOrg, setIssuingOrg] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) setError('Could not load certifications.')
      else setCerts(data ?? [])
      setLoading(false)
    }
    load()
  }, [userId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const f = e.target.files?.[0] ?? null
    if (f) {
      const okType = ACCEPTED.some(t => f.type.startsWith(t))
      if (!okType) { setError('Only images or PDF files are allowed.'); e.target.value = ''; return }
      if (f.size > MAX_SIZE) { setError('File is over 10MB.'); e.target.value = ''; return }
    }
    setFile(f)
  }

  const resetForm = () => {
    setFile(null)
    setCertName('')
    setIssuingOrg('')
    setExpiryDate('')
  }

  const handleUpload = async () => {
    setError('')
    if (!file) { setError('Choose a file first.'); return }
    if (!certName.trim()) { setError('Give the certification a name.'); return }

    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('certifications')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setUploading(false); return }

    const { data: inserted, error: insertError } = await supabase
      .from('certifications')
      .insert({
        user_id: userId,
        file_url: path,
        file_name: file.name,
        cert_name: certName.trim(),
        issuing_org: issuingOrg.trim() || null,
        expiry_date: expiryDate || null,
        verification_status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      setError(`Save failed: ${insertError.message}`)
      // roll back the orphaned storage object
      await supabase.storage.from('certifications').remove([path])
      setUploading(false)
      return
    }

    if (inserted) setCerts(prev => [inserted as Certification, ...prev])
    resetForm()
    setUploading(false)
  }

  const handleView = async (cert: Certification) => {
    setError('')
    const { data, error } = await supabase.storage
      .from('certifications')
      .createSignedUrl(cert.file_url, 60) // valid 60 seconds

    if (error || !data) { setError('Could not open file.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async (cert: Certification) => {
    setError('')
    await supabase.storage.from('certifications').remove([cert.file_url])

    const { error: deleteError } = await supabase
      .from('certifications')
      .delete()
      .eq('id', cert.id)

    if (deleteError) { setError(`Delete failed: ${deleteError.message}`); return }
    setCerts(prev => prev.filter(c => c.id !== cert.id))
  }

  const isExpired = (date: string | null) =>
    date ? new Date(date) < new Date(new Date().toDateString()) : false

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"

  if (loading) return <p className="text-gray-400 text-sm animate-pulse">Loading certifications...</p>

  return (
    <div>
      {/* Existing certs */}
      {certs.length === 0 ? (
        <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-2xl p-8 text-center mb-5">
          <p className="text-3xl mb-2">📜</p>
          <p className="text-gray-400 text-sm">No certifications yet. Add your licenses below.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {certs.map(cert => (
            <div key={cert.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium truncate">{cert.cert_name}</p>
                  <VerificationBadge status={cert.verification_status} />
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {cert.issuing_org && <span>{cert.issuing_org}</span>}
                  {cert.issuing_org && cert.expiry_date && <span> · </span>}
                  {cert.expiry_date && (
                    <span className={isExpired(cert.expiry_date) ? 'text-red-400' : 'text-gray-400'}>
                      {isExpired(cert.expiry_date) ? 'Expired ' : 'Expires '}
                      {new Date(cert.expiry_date).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleView(cert)} className="text-xs border border-gray-600 hover:border-orange-500 text-white px-3 py-1.5 rounded-lg transition">
                  View
                </button>
                <button onClick={() => handleDelete(cert)} className="text-xs border border-gray-600 hover:border-red-500 hover:text-red-400 text-gray-400 px-3 py-1.5 rounded-lg transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Add new cert form */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
        <p className="text-sm text-gray-300 font-medium">Add a certification</p>
        <input
          type="text"
          placeholder="Name (e.g. Master Electrician License)"
          value={certName}
          onChange={(e) => setCertName(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Issuing organization (optional)"
          value={issuingOrg}
          onChange={(e) => setIssuingOrg(e.target.value)}
          className={inputClass}
        />
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Expiry date (optional)</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="text-sm border border-gray-700 hover:border-orange-500 px-4 py-2.5 rounded-xl transition cursor-pointer text-white text-center">
          {file ? file.name : 'Choose file (image or PDF)'}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
        >
          {uploading ? 'Uploading...' : 'Add Certification'}
        </button>
      </div>
    </div>
  )
}

function VerificationBadge({ status }: { status: Certification['verification_status'] }) {
  const styles = {
    unverified: 'bg-gray-700 text-gray-300',
    pending: 'bg-yellow-500/10 text-yellow-400',
    verified: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
  }
  const labels = {
    unverified: 'Not reviewed',
    pending: 'Pending',
    verified: 'Verified',
    rejected: 'Needs attention',
  }

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
