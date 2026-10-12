import type { Metadata } from 'next'
import PolicyLayout from '../components/PolicyLayout'

export const metadata: Metadata = { title: 'Privacy Policy' }
export default function PrivacyPage() { return <PolicyLayout title="Privacy Policy" summary="How TradesCraftConnect collects, uses, and protects member information.">
  <section><h2>Information we collect</h2><p>We collect account details, profile information, work preferences, job postings, applications, messages, certification records, uploaded files, reports, saved items, and basic technical information needed to secure and operate the service.</p></section>
  <section><h2>How we use information</h2><ul><li>Provide profiles, matching, applications, messaging, notifications, and saved items.</li><li>Review credentials and safety reports.</li><li>Prevent fraud, protect accounts, troubleshoot problems, and improve the platform.</li><li>Communicate service and account updates.</li><li>Meet legal obligations and enforce platform rules.</li></ul></section>
  <section><h2>Visibility</h2><p>Profile and opportunity information intended for discovery is visible to signed-in members. Applications and messages are restricted to their participants. Credential files, reports, and administrator notes are private and accessible only as needed for review and platform operation.</p></section>
  <section><h2>Service providers</h2><p>We use vendors such as hosting, database, authentication, storage, and email providers to operate the platform. They process information under their own contractual and security obligations. We do not sell personal information.</p></section>
  <section><h2>Retention and security</h2><p>We retain information for as long as reasonably needed to provide the service, resolve disputes, protect members, and meet legal requirements. We use access controls and private storage for sensitive records, but no online system can guarantee absolute security.</p></section>
  <section><h2>Your choices</h2><p>You may update profile information through your account. You may request access, correction, or deletion where applicable, subject to records we must retain for safety, fraud prevention, disputes, or law.</p></section>
  <section><h2>Children and international use</h2><p>The service is not intended for children under 13. Members using the platform outside the United States are responsible for local requirements; international privacy and credential features may be introduced gradually.</p></section>
</PolicyLayout> }

