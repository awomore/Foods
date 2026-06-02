import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Data Deletion — FOODSbyme',
  description: 'Request deletion of your FOODSbyme account data.',
  robots: { index: false, follow: false },
};

export default function DataDeletionPage() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px', lineHeight: 1.7, color: '#222', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#e85d04' }}>Request Data Deletion</h1>

        <p>
          To delete all personal data FOODSbyme holds about you, email{' '}
          <a href="mailto:privacy@foodsbyme.com">privacy@foodsbyme.com</a> with
          the subject line <strong>"Data Deletion Request"</strong> and include
          the email address linked to your account. We will permanently delete
          your data within 30 days and send you a confirmation.
        </p>

        <h2>Connected via Facebook?</h2>
        <p>
          If you signed in or connected your account through Facebook, you can
          also trigger deletion directly from{' '}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook Settings → Apps and Websites
          </a>
          . Remove FOODSbyme and we will automatically receive and process your
          deletion request.
        </p>

        <h2>What gets deleted</h2>
        <ul>
          <li>Your account profile (name, email, photo)</li>
          <li>Order history and associated addresses</li>
          <li>Creator profile, menu items, and earnings history</li>
          <li>Any connected social account tokens</li>
        </ul>

        <p>
          Questions? Email{' '}
          <a href="mailto:privacy@foodsbyme.com">privacy@foodsbyme.com</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
