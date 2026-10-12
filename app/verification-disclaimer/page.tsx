import type { Metadata } from 'next'
import PolicyLayout from '../components/PolicyLayout'

export const metadata: Metadata = { title: 'Credential Verification Disclaimer' }
export default function VerificationDisclaimerPage() { return <PolicyLayout title="Credential Verification Disclaimer" summary="What the TradesCraftConnect Verified badge means—and what it does not mean.">
  <section><h2>Meaning of Verified</h2><p>A Verified badge means an administrator reviewed a submitted credential document and found that it appeared consistent with the member and certification information provided at the time of review.</p></section>
  <section><h2>Limits of review</h2><p>Verification is not a guarantee that a credential is authentic, current, unrestricted, suitable for a particular job, or recognized in every jurisdiction. It is not an endorsement of workmanship, character, safety, insurance, work authorization, or future performance.</p></section>
  <section><h2>Your independent checks</h2><p>Employers, customers, contractors, and members must independently confirm licenses, expiration dates, disciplinary history, insurance, references, permits, identity, and job-specific requirements with the appropriate issuer or authority before hiring or contracting.</p></section>
  <section><h2>Changes and reporting</h2><p>Credentials can expire, be suspended, or change after review. Members must keep records accurate. Report suspected false, altered, expired, or misused credentials through the profile reporting control.</p></section>
</PolicyLayout> }

