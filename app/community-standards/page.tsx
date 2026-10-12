import type { Metadata } from 'next'
import PolicyLayout from '../components/PolicyLayout'

export const metadata: Metadata = { title: 'Community Standards' }
export default function CommunityStandardsPage() { return <PolicyLayout title="Community Standards" summary="Professional conduct expected across the TradesCraftConnect community.">
  <section><h2>Be truthful</h2><p>Use your real identity or authorized business identity. Accurately describe qualifications, licensing, insurance, experience, availability, compensation, project scope, and hiring authority.</p></section>
  <section><h2>Be professional</h2><p>Communicate respectfully. Harassment, threats, hate, sexual misconduct, discrimination, retaliation, spam, and repeated unwanted contact are prohibited.</p></section>
  <section><h2>Protect safety</h2><p>Do not encourage unsafe work, conceal material hazards, request illegal activity, or pressure anyone to work without required licenses, training, protective equipment, permits, or supervision.</p></section>
  <section><h2>Protect privacy</h2><p>Do not publish another person’s private contact details, documents, messages, financial information, or identifying records without authorization.</p></section>
  <section><h2>No fraud or exploitation</h2><p>Fake jobs, advance-fee schemes, credential fraud, impersonation, wage theft, payment evasion, deceptive recruiting, and attempts to move suspicious transactions off-platform are prohibited.</p></section>
  <section><h2>Report concerns</h2><p>Use the Report control on a job or profile when something appears unsafe, fraudulent, discriminatory, or misleading. Reports are private. Intentionally false or retaliatory reports may also violate these standards.</p></section>
</PolicyLayout> }

