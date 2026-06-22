import type { Metadata } from 'next';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Privacy Policy',
  description: 'How FOODSbyme collects, uses, and protects your personal data. Governed by the Nigeria Data Protection Act 2023.',
  path: '/privacy',
});

const sections = [
  {
    title: '1. Who We Are',
    content: `FOODSbyme Technologies operates the FOODSbyme platform — including our mobile apps, website, and APIs. Our registered address is 42, Oba Yekini Elegushi Rd, Lagos, Nigeria. We process personal data as a data controller under the Nigeria Data Protection Act 2023 (NDPA). For privacy-related queries, contact privacy@foodsbyme.com.`,
  },
  {
    title: '2. Data We Collect',
    content: `We collect the following categories of personal data:`,
    bullets: [
      'Account data — name, email address, phone number, profile photo, and password hash.',
      'Usage data — pages visited, features used, device identifiers, browser type, and IP address.',
      'Location data — delivery pickup and drop-off locations provided when placing or fulfilling orders.',
      'Payment data — we do not store full card numbers. Payments are tokenised and handled by our certified payment partners.',
      'Creator data — kitchen name and description, menu items, pricing, food images, and bank account details for settlement.',
      'Fleet partner data — vehicle type, operating area, rider records, and earnings history.',
      'Communications — messages sent to our support team and any correspondence with FOODSbyme.',
    ],
  },
  {
    title: '3. How We Use Your Data',
    content: `We use your personal data to:`,
    bullets: [
      'Operate the platform — matching orders, processing payments, and coordinating deliveries.',
      'Communicate with you — order updates, account notifications, support responses, and (where consented) marketing.',
      'Improve our service — internal analytics, feature testing, and fraud and abuse prevention.',
      'Settle payments — calculating and disbursing earnings to creators and fleet partners.',
      'Comply with legal obligations — tax reporting, regulatory requirements, and responding to lawful requests from authorities.',
    ],
  },
  {
    title: '4. Legal Basis for Processing',
    content: `We rely on the following legal grounds under the NDPA:`,
    bullets: [
      'Contract — processing necessary to provide the services you signed up for.',
      'Legitimate interests — platform safety, fraud prevention, and service improvement, where our interests are not overridden by your rights.',
      'Legal obligation — compliance with Nigerian tax law, the NDPA, and other applicable regulations.',
      'Consent — where we ask for explicit permission, such as for optional marketing communications. You may withdraw consent at any time.',
    ],
  },
  {
    title: '5. Who We Share Data With',
    content: `We share your data only with:`,
    bullets: [
      'Payment processors — to authorise and settle transactions.',
      'Cloud and infrastructure providers — to host and operate the platform securely.',
      'Delivery fleet partners — limited order details (pickup address, delivery address, order summary) necessary to fulfil your order.',
      'Analytics providers — aggregated and anonymised data only; no individual user data is sold.',
      'Legal and regulatory authorities — where required by applicable Nigerian law or lawful court order.',
    ],
    footer: 'We do not sell, rent, or trade your personal data to third parties for their own commercial purposes.',
  },
  {
    title: '6. Data Retention',
    content: `We retain personal data for as long as your account is active and for seven (7) years after account closure, to meet our tax and regulatory obligations. Order history and transaction records are similarly retained for seven years. Data that is not subject to a legal retention requirement will be deleted within 30 days of a verified deletion request.`,
  },
  {
    title: '7. Your Rights',
    content: `Under the NDPA 2023, you have the right to:`,
    bullets: [
      'Access — request a copy of the personal data we hold about you.',
      'Correction — request that inaccurate or incomplete data be corrected.',
      'Deletion — request erasure of data we are not legally required to retain.',
      'Objection — object to processing based on legitimate interests.',
      'Portability — receive your data in a structured, machine-readable format.',
      'Complaint — lodge a complaint with the Nigeria Data Protection Commission (NDPC) at ndpc.gov.ng.',
    ],
    footer: 'To exercise any of these rights, email privacy@foodsbyme.com. We will respond within 30 days.',
  },
  {
    title: '8. Security',
    content: `We implement industry-standard security measures including encryption in transit (TLS), encryption at rest for sensitive fields, access controls, and regular security audits. No system is perfectly secure; if you have reason to believe your account has been compromised, contact support@foodsbyme.com immediately.`,
  },
  {
    title: '9. Children',
    content: `FOODSbyme is for users aged 18 and over. We do not knowingly collect personal data from anyone under 18. If you believe a minor has created an account or provided us with personal data, email privacy@foodsbyme.com and we will delete the data promptly.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We will notify registered users of material changes to this policy by email at least 14 days before they take effect. The "Last updated" date at the top of this page always reflects the most recent version. Continued use of FOODSbyme after a change takes effect constitutes acceptance of the revised policy.`,
  },
  {
    title: '11. Contact',
    content: `For any privacy-related queries or requests:\n\nprivacy@foodsbyme.com\nFOODSbyme Technologies\n42, Oba Yekini Elegushi Rd, Lagos, Nigeria`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          kicker="Legal"
          title="Privacy Policy"
          intro="Last updated: June 2026. This policy explains what personal data FOODSbyme collects, how we use it, and your rights under the Nigeria Data Protection Act 2023."
        />

        <section className="bg-cream py-16 md:py-24">
          <div className="container-x max-w-2xl">
            <div className="space-y-10">
              {sections.map((s) => (
                <div key={s.title}>
                  <h2 className="font-serif text-xl text-ink mb-3">{s.title}</h2>
                  <p className="text-stone font-light text-[15px] leading-relaxed whitespace-pre-line">{s.content}</p>
                  {s.bullets && (
                    <ul className="mt-3 space-y-2">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-stone font-light text-[14px] leading-relaxed">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-spice flex-shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.footer && (
                    <p className="mt-3 text-stone font-light text-[14px] leading-relaxed italic">{s.footer}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-14 pt-10 border-t border-border">
              <p className="text-muted text-[13px] font-light">
                Questions about this policy?{' '}
                <a href="mailto:privacy@foodsbyme.com" className="text-spice hover:underline">
                  privacy@foodsbyme.com
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
