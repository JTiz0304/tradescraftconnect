export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0E1117',
      color: '#F4F6FA',
      fontFamily: "'Barlow', sans-serif",
    }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0E1117; }
        .nav-link { color: rgba(244,246,250,0.6); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-link:hover { color: #F4F6FA; }
        .role-btn { background: transparent; border: 1px solid #2A3347; color: rgba(244,246,250,0.6); padding: 10px 24px; border-radius: 4px; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .role-btn:hover, .role-btn.active { background: #F26B1D; border-color: #F26B1D; color: #fff; }
        .feature-card { background: #161B26; border: 1px solid #2A3347; border-radius: 8px; padding: 32px; transition: background 0.2s; }
        .feature-card:hover { background: #1E2535; }
        .trade-pill { background: rgba(244,246,250,0.05); border: 1px solid #2A3347; border-radius: 100px; padding: 10px 20px; font-size: 14px; color: rgba(244,246,250,0.6); transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .trade-pill:hover { border-color: #F26B1D; color: #F4F6FA; background: rgba(242,107,29,0.1); }
        .btn-primary { background: #F26B1D; color: #fff; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; padding: 16px 36px; border-radius: 4px; text-decoration: none; display: inline-block; transition: background 0.2s; border: none; cursor: pointer; }
        .btn-primary:hover { background: #FF8C42; }
        .btn-outline { background: transparent; color: #F4F6FA; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; padding: 16px 36px; border-radius: 4px; text-decoration: none; display: inline-block; border: 1px solid #2A3347; transition: all 0.2s; }
        .btn-outline:hover { border-color: #F26B1D; background: rgba(242,107,29,0.1); }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%', height: 68, background: 'rgba(14,17,23,0.95)', borderBottom: '1px solid #2A3347', backdropFilter: 'blur(12px)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '0.02em' }}>
          Trades<span style={{ color: '#F26B1D' }}>Craft</span>Connect
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <a href="#roles" className="nav-link">Who It&apos;s For</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#waitlist" style={{ background: '#F26B1D', color: '#fff', padding: '9px 22px', borderRadius: 4, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Join Waitlist</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 5% 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#2A3347 1px, transparent 1px), linear-gradient(90deg, #2A3347 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.2 }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(242,107,29,0.12)', border: '1px solid rgba(242,107,29,0.35)', color: '#FF8C42', padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28, position: 'relative', width: 'fit-content' }}>
          <span style={{ width: 7, height: 7, background: '#F26B1D', borderRadius: '50%', display: 'inline-block' }} />
          Now Building — Join the Waitlist
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(52px, 8vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', textTransform: 'uppercase', maxWidth: 820, position: 'relative', marginBottom: 8 }}>
          Built for<br />the <span style={{ color: '#F26B1D' }}>Trades.</span><br />Finally.
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(244,246,250,0.6)', maxWidth: 560, margin: '24px 0 44px', lineHeight: 1.7, position: 'relative' }}>
          The first hiring and networking platform built exclusively for GCs, builders, tradespeople, and apprentices. Verified. Local. Fast.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
          <a href="http://eepurl.com/Oo4L5-5qcZ" className="btn-primary">→ Join the Waitlist</a>
          <a href="#roles" className="btn-outline">See How It Works</a>
        </div>
        <div style={{ display: 'flex', gap: 48, marginTop: 64, position: 'relative', flexWrap: 'wrap' }}>
          {[['14+', 'Early sign-ups'], ['5', 'User types served'], ['1', 'Platform built for trades']].map(([num, label]) => (
            <div key={label} style={{ borderLeft: '2px solid #F26B1D', paddingLeft: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 13, color: 'rgba(244,246,250,0.6)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" style={{ padding: '100px 5%', background: '#161B26', borderTop: '1px solid #2A3347' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F26B1D', marginBottom: 16 }}>Who It&apos;s For</p>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1, textTransform: 'uppercase', marginBottom: 20 }}>Your role.<br />Your tools.</h2>
          <p style={{ fontSize: 17, color: 'rgba(244,246,250,0.6)', maxWidth: 560, lineHeight: 1.7, marginBottom: 48 }}>
            TradesCraftConnect is built around 5 distinct user types — each with features designed specifically for how they work.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 48 }}>
            {['GCs & Builders', 'Trade Biz Owners', 'Trades Pros', 'Apprentices'].map((role) => (
              <button key={role} className="role-btn">{role}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: 17, color: 'rgba(244,246,250,0.6)', lineHeight: 1.7, marginBottom: 32 }}>
                General contractors and builders need verified crews fast. TradesCraftConnect gives you the tools to find, vet, and hire — without the noise.
              </p>
              {['Crew Builder tool — multi-hire for one project', 'Urgent Hire 24-hour blast to local talent', 'Hire Now button — one-click offers', 'Built-in map view — see who\'s nearby & available', 'In-platform interview scheduler', 'Filter by FT/PT, availability, license type'].map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 15, color: 'rgba(244,246,250,0.7)', marginBottom: 12 }}>
                  <span style={{ width: 20, height: 20, background: 'rgba(242,107,29,0.12)', border: '1px solid rgba(242,107,29,0.4)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#F26B1D', fontSize: 12, marginTop: 1 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <div style={{ background: '#1E2535', border: '1px solid #2A3347', borderRadius: 8, padding: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(244,246,250,0.5)', marginBottom: 16 }}>Crew Builder — Live Preview</div>
              <div style={{ background: '#161B26', border: '1px solid #2A3347', borderRadius: 6, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16 }}>Project: Riverside Commons</span>
                  <span style={{ background: 'rgba(242,107,29,0.12)', border: '1px solid rgba(242,107,29,0.35)', color: '#FF8C42', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 3 }}>Urgent</span>
                </div>
                {[['⚡ Master Electrician ×2', '3 matched', '#4ade80'], ['🔧 Lead Plumber ×1', '5 matched', '#4ade80'], ['🏗️ Framing Crew ×4', 'Searching...', '#60a5fa']].map(([role, status, color]) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1E2535', border: '1px solid #2A3347', borderRadius: 5, marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>{role}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}22`, padding: '3px 8px', borderRadius: 3 }}>{status}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: 10, background: 'rgba(242,107,29,0.08)', border: '1px solid rgba(242,107,29,0.2)', borderRadius: 4, fontSize: 12, color: '#FF8C42' }}>
                  🚀 24-hr blast sent to 47 local tradespeople
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F26B1D', marginBottom: 16 }}>Platform Features</p>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1, textTransform: 'uppercase', marginBottom: 48 }}>Every tool the<br />trades actually need</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#2A3347', border: '1px solid #2A3347', borderRadius: 8, overflow: 'hidden' }}>
            {[
              ['🗺️', 'Built-in map view', 'See available tradespeople near your job site in real time.'],
              ['✅', 'License verification', 'Every licensed tradesperson is verified before they show up in results.'],
              ['🤖', 'AI-powered tools', 'AI résumé builder, video questionnaire builder, and custom onboarding packets.'],
              ['🚀', 'Urgent hire blast', 'Need someone by tomorrow? Send a 24-hour blast to every available local tradesperson.'],
              ['🏗️', 'Crew builder', 'Post multi-role requests. Each slot closes as it fills.'],
              ['🎖️', 'Verified badges', 'Earn badges that tell employers exactly what you bring.'],
              ['📊', 'Analytics dashboards', 'Profile views, application stats, and how your posts are performing.'],
              ['📅', 'Interview scheduler', 'Schedule interviews without leaving the platform.'],
              ['📸', 'Work portfolio', 'Upload before/after photos and job site videos.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="feature-card">
                <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(244,246,250,0.6)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRADES */}
      <section style={{ padding: '80px 5%', background: '#161B26', borderTop: '1px solid #2A3347', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F26B1D', marginBottom: 16 }}>All Trades Welcome</p>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1, textTransform: 'uppercase', marginBottom: 48 }}>If you work with your hands,<br />this is your platform</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['⚡ Electricians', '🔧 Plumbers', '🏠 Roofers', '❄️ HVAC Techs', '🌿 Landscapers', '🏊 Pool Techs', '🪟 General Contractors', '🧱 Tile & Grout Pros', '🪚 Carpenters', '🎨 Painters', '🏗️ Framers', '🔌 Low Voltage', '🪛 Drywallers', '🪜 Insulators', '🔩 Ironworkers'].map((t) => (
              <span key={t} className="trade-pill">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="waitlist" style={{ padding: '120px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(242,107,29,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F26B1D', marginBottom: 16 }}>Get Early Access</p>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(42px, 6vw, 72px)', textTransform: 'uppercase', lineHeight: 1, marginBottom: 20 }}>
            Be First.<br />Get <span style={{ color: '#F26B1D' }}>Priority</span><br />Access.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(244,246,250,0.6)', marginBottom: 44, lineHeight: 1.7 }}>
            Join the waitlist now and get priority access, locked-in launch pricing, and a say in what we build next.
          </p>
          <a href="http://eepurl.com/Oo4L5-5qcZ" className="btn-primary" style={{ fontSize: 20, padding: '18px 48px' }}>
            → Join the Waitlist Now
          </a>
          <p style={{ fontSize: 13, color: '#3D4D66', marginTop: 16 }}>No spam. No fluff. Just updates when it matters.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#161B26', borderTop: '1px solid #2A3347', padding: '48px 5% 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22 }}>
            Trades<span style={{ color: '#F26B1D' }}>Craft</span>Connect
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Who It\'s For', 'Features', 'Join Waitlist'].map((l) => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#3D4D66', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#3D4D66', textAlign: 'center', marginTop: 32, paddingTop: 24, borderTop: '1px solid #2A3347', maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>
          © 2025 TradesCraftConnect. All rights reserved. Built for the trades.
        </p>
      </footer>

    </main>
  );
}