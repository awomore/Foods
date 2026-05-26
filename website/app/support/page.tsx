import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SupportContent from '@/components/SupportContent';

export const metadata: Metadata = {
  title: 'Support — FOODSbyme',
  description: 'Get help with your FOODSbyme account, orders, payments, private chef bookings, and more. Contact our team at support@foodsbyme.com.',
};

export default function SupportPage() {
  return (
    <>
      <Nav />
      <main>
        <SupportContent />
      </main>
      <Footer />
    </>
  );
}
