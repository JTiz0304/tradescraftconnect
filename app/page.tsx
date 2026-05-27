import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <div className="font-bold text-xl tracking-tight">
          Trades<span className="text-orange-500">Craft</span>Connect
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition">Log in</Link>
          <Link href="/signup" className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-24 pb-20 text-center">
        <div className="inline-block bg-orange-500/10 text-orange-400 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Built for the Trades
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
          Connect the people<br />who <span className="text-orange-500">build</span> the world
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10">
          TradesCraftConnect brings together GC builders, trade business owners, skilled professionals, and apprentices — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition">
            Join Free
          </Link>
          <Link href="/login" className="border border-gray-700 hover:border-orange-500 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-lg transition">
            Log In
          </Link>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Who is it for?</h2>
        <p className="text-gray-400 text-center mb-12">Four types of people, one platform</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { emoji: '🏗️', title: 'GC / Builders', desc: 'Post jobs and find skilled tradespeople for your projects' },
            { emoji: '🔧', title: 'Business Owners', desc: 'Grow your trades business and connect with more clients' },
            { emoji: '👷', title: 'Professionals', desc: 'Find work that matches your trade, location, and schedule' },
            { emoji: '🎓', title: 'Apprentices', desc: 'Get your foot in the door and build real experience' },
          ].map(card => (
            <div key={card.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-orange-500 transition">
              <div className="text-4xl mb-4">{card.emoji}</div>
              <h3 className="font-semibold text-white text-lg mb-2">{card.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { emoji: '📋', title: 'Job Postings', desc: 'GCs post jobs, trades find work. Simple and fast.' },
            { emoji: '🔍', title: 'Trades Directory', desc: 'Search and connect with professionals in your area.' },
            { emoji: '📍', title: 'Location Based', desc: 'Find people and jobs within your hiring or work radius.' },
          ].map(f => (
            <div key={f.title} className="text-center">
              <div className="text-4xl mb-4">{f.emoji}</div>
              <h3 className="font-semibold text-white text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-8 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-gray-400 mb-8">Join TradesCraftConnect for free and start connecting today.</p>
        <Link href="/signup" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-10 py-4 rounded-xl text-lg transition inline-block">
          Create Your Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-8 py-8 text-center text-gray-600 text-sm">
        © 2026 TradesCraftConnect. All rights reserved.
      </footer>

    </div>
  )
}