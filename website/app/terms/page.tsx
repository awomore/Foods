import type { Metadata } from 'next';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Terms of Service',
  description: 'The terms that govern your use of the FOODSbyme platform — for customers, creators, and fleet partners.',
  path: '/terms',
});

const sections = [
  {
    title: '1. About FOODSbyme',
    content: `FOODSbyme is a creator commerce platform operated by FOODSbyme Technologies, registered in Nigeria. We connect food creators, customers, and delivery fleet partners. FOODSbyme is a marketplace operator — we do not prepare food, employ riders, or hold inventory. By using our platform, you agree to these terms.`,
  },
  {
    title: '2. Eligibility and Your Account',
    content: `You must be at least 18 years old to create an account. By registering, you confirm that all information you provide is accurate and kept up to date. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. If you believe your account has been compromised, contact support@foodsbyme.com immediately. We reserve the right to suspend or terminate accounts that violate these terms or engage in conduct harmful to other users or to FOODSbyme.`,
  },
  {
    title: '3. For Creators',
    content: `By selling on FOODSbyme, you confirm and agree that:`,
    bullets: [
      'All food is prepared in sanitary conditions and complies with applicable food safety laws and regulations in your jurisdiction.',
      'Pricing, descriptions, ingredient lists, and allergen information are accurate and kept current at all times.',
      'You hold any permits, licences, or health certifications required to prepare and sell food from your location.',
      'You will fulfil orders you accept. Persistent cancellations or failure to fulfil confirmed orders will result in a performance review and may lead to account suspension.',
      'You grant FOODSbyme a licence to display your profile, images, and menu content on the platform and in marketing materials.',
    ],
    footer: 'FOODSbyme charges a platform commission on each completed order. Current rates are displayed in your creator dashboard and may be updated with 14 days\' notice.',
  },
  {
    title: '4. For Customers',
    content: `By placing an order, you confirm that:`,
    bullets: [
      'The delivery address provided is accurate and accessible.',
      'Someone will be available to receive the order at the delivery time.',
      'You have authorised the payment method used for the transaction.',
    ],
    footer: 'Refund and dispute requests must be raised through the in-app resolution centre within 24 hours of delivery. We aim to resolve all disputes within 5 business days. FOODSbyme\'s decision on disputes is final subject to applicable consumer protection law.',
  },
  {
    title: '5. For Fleet Partners',
    content: `By joining as a fleet partner, you confirm and agree that:`,
    bullets: [
      'All vehicles in your fleet are roadworthy, properly maintained, and covered by valid third-party insurance.',
      'All motorbike riders hold a valid rider\'s licence for their vehicle type; bicycle riders comply with all applicable road regulations.',
      'You will comply with the FOODSbyme Operations Handbook and maintain the service quality standards set out therein.',
      'Your fleet will operate within the geographic zone specified in your application and any subsequently approved territory.',
    ],
    footer: 'Fleet partner earnings, settlement cycles, territory rights, and performance standards are governed by the Fleet Partner Agreement, which forms part of these terms for all registered fleet partners.',
  },
  {
    title: '6. Payments and Settlement',
    content: `All customer transactions are processed by our certified payment partners. By completing a purchase, you authorise the charge to your selected payment method. All prices on FOODSbyme are displayed in Nigerian Naira (₦) unless otherwise stated. Creator and fleet partner earnings are settled on a weekly cycle to registered bank accounts. FOODSbyme reserves the right to withhold settlement in cases of suspected fraud, disputed transactions, or confirmed policy violations pending investigation.`,
  },
  {
    title: '7. Prohibited Conduct',
    content: `You may not use FOODSbyme to:`,
    bullets: [
      'Engage in any activity that violates Nigerian law or the law of your jurisdiction.',
      'Misrepresent your identity, credentials, or the nature of your business or food products.',
      'Post false, misleading, or defamatory content, reviews, or information.',
      'Interfere with or disrupt the operation, security, or integrity of the platform.',
      'Attempt to bypass, undermine, or circumvent our payment, settlement, or order-routing systems.',
      'Harvest user data, scrape content, or use automated tools to interact with the platform without authorisation.',
      'Use the platform to harass, threaten, or harm other users.',
    ],
    footer: 'Violations may result in immediate account suspension and, where applicable, referral to law enforcement authorities.',
  },
  {
    title: '8. Intellectual Property',
    content: `All content on FOODSbyme — including but not limited to our name, logo, brand mark, design system, codebase, and editorial content — is owned by or licensed to FOODSbyme Technologies. You may not copy, reproduce, distribute, or use our intellectual property without express written permission. User-generated content (creator profiles, food images, reviews) remains the property of the user; by posting it, you grant FOODSbyme a non-exclusive licence to display and promote it on the platform.`,
  },
  {
    title: '9. Limitation of Liability',
    content: `To the maximum extent permitted by applicable law, FOODSbyme is not liable for:`,
    bullets: [
      'Food safety issues resulting from a creator\'s preparation, storage, or handling practices.',
      'Delivery delays attributable to traffic, weather, road conditions, or force majeure events.',
      'Loss of income, profits, or business opportunity arising from platform downtime or service changes.',
      'Indirect, consequential, or punitive damages of any kind.',
    ],
    footer: 'Our total liability to any user for any claim arising out of or in connection with these terms or the platform is limited to the value of the relevant transaction.',
  },
  {
    title: '10. Governing Law',
    content: `These terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with these terms shall be subject to the non-exclusive jurisdiction of the Nigerian courts. Where required by applicable law, we will engage in good-faith dispute resolution before initiating formal proceedings.`,
  },
  {
    title: '11. Changes to These Terms',
    content: `We may update these terms from time to time. We will notify registered users of material changes by email at least 14 days before they take effect. The "Last updated" date at the top of this page reflects the most recent version. Continued use of FOODSbyme after a change takes effect constitutes acceptance of the revised terms.`,
  },
  {
    title: '12. Contact',
    content: `For terms-related queries:\n\nhello@foodsbyme.com\nFOODSbyme Technologies\n42, Oba Yekini Elegushi Rd, Lagos, Nigeria`,
  },
];

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          kicker="Legal"
          title="Terms of Service"
          intro="Last updated: June 2026. These terms govern your use of the FOODSbyme platform. They apply to all users — customers, creators, and fleet partners."
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
                Questions about these terms?{' '}
                <a href="mailto:hello@foodsbyme.com" className="text-spice hover:underline">
                  hello@foodsbyme.com
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
