import Link from 'next/link'

export default function PolicyLayout({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-950 px-5 py-10 text-white">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-orange-400">← TradesCraftConnect</Link>
        <h1 className="mt-6 text-4xl font-bold">{title}</h1>
        <p className="mt-3 text-lg text-gray-300">{summary}</p>
        <p className="mt-2 text-sm text-gray-500">Effective October 12, 2026</p>
        <div className="mt-8 space-y-7 text-gray-300 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:py-1 [&_p]:leading-7">{children}</div>
        <div className="mt-10 flex flex-wrap gap-4 border-t border-gray-800 pt-6 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-orange-400">Terms</Link><Link href="/privacy" className="hover:text-orange-400">Privacy</Link><Link href="/community-standards" className="hover:text-orange-400">Community Standards</Link><Link href="/verification-disclaimer" className="hover:text-orange-400">Verification</Link>
        </div>
      </article>
    </main>
  )
}

