import type { Metadata } from 'next'
import PolicyLayout from '../components/PolicyLayout'

export const metadata: Metadata = { title: 'Terms of Service' }
export default function TermsPage() { return <PolicyLayout title="Terms of Service" summary="The rules for using the TradesCraftConnect platform.">
  <section><h2>1. The platform</h2><p>TradesCraftConnect helps members create professional profiles, post and find opportunities, communicate, and submit credentials for review. TradesCraftConnect is not an employer, staffing agency, contractor, licensing authority, or party to agreements between members.</p></section>
  <section><h2>2. Accounts</h2><p>You must provide accurate information, protect your login credentials, and use only accounts you are authorized to control. You are responsible for activity under your account and must meet the legal age and authority requirements that apply where you live.</p></section>
  <section><h2>3. Member responsibilities</h2><ul><li>Confirm licensing, insurance, qualifications, work authorization, pay, scope, and safety requirements independently.</li><li>Follow employment, contracting, tax, discrimination, safety, and consumer-protection laws.</li><li>Do not misrepresent credentials, identity, experience, jobs, compensation, or business relationships.</li><li>Do not scrape the service, introduce malicious code, harass members, or use the platform for fraud.</li></ul></section>
  <section><h2>4. Content and credentials</h2><p>You retain ownership of content you submit and grant TradesCraftConnect permission to host and display it as needed to operate the service. You confirm that you have the right to submit it. Credential review is limited and does not replace an employer’s or customer’s independent due diligence.</p></section>
  <section><h2>5. Moderation</h2><p>We may investigate reports, limit visibility, suspend accounts, preserve relevant records, or remove content when reasonably necessary to protect members, comply with law, or enforce these terms. We may act without advance notice when urgent safety or fraud concerns exist.</p></section>
  <section><h2>6. No guarantees</h2><p>We do not guarantee employment, applicants, projects, revenue, credential validity, member conduct, availability, or uninterrupted service. The service is provided on an “as available” basis to the extent permitted by law.</p></section>
  <section><h2>7. Liability</h2><p>To the fullest extent permitted by law, TradesCraftConnect is not responsible for member-to-member disputes, jobsite incidents, hiring decisions, payment disputes, lost profits, or indirect damages arising from use of the service.</p></section>
  <section><h2>8. Changes</h2><p>We may update these terms as the platform develops. Material changes will be communicated through the service when practical. Continued use after an update means you accept the revised terms.</p></section>
</PolicyLayout> }

