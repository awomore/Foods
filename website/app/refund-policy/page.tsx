import type { Metadata } from 'next';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Refund & Cancellation Policy',
  description:
    'When FOODSbyme orders can be cancelled, how refunds are decided, and how long your money takes to come back. Covers food orders, courses, catering and private chef bookings.',
  path: '/refund-policy',
  keywords: [
    'FOODSbyme refund policy',
    'cancel an order',
    'food delivery refund Nigeria',
    'refund timeline',
    'dispute resolution',
  ],
});

const sections = [
  {
    title: '1. Who This Policy Covers',
    content: `FOODSbyme Technologies operates the FOODSbyme platform — a marketplace where customers order from independent food creators, and fleet partners deliver those orders. Our registered address is 42, Oba Yekini Elegushi Rd, Lagos, Nigeria.

This policy applies to every payment made through the FOODSbyme mobile apps and website, and explains when an order can be cancelled, when a refund is due, and how long it takes to reach you. Payments are processed by licensed payment partners; FOODSbyme does not store your full card details.`,
  },
  {
    title: '2. Your Money Is Held Until the Order Is Complete',
    content: `When you pay for an order, the money does not go straight to the creator. FOODSbyme holds it until the order has been delivered and the resolution window described in section 5 has closed.

This matters for refunds: if an order is cancelled before delivery, the funds are still being held, and returning them does not depend on recovering money from anyone. The creator is only paid once the order has completed without an unresolved issue.`,
  },
  {
    title: '3. Cancelling Before Delivery',
    content: `You can cancel an order yourself, in the app, at any point before a rider has collected it — that is, while the order is awaiting payment, confirmed, accepted by the creator, being prepared, or ready for collection. Cancelling at any of these stages refunds the full amount you paid.`,
    bullets: [
      'Cancel from the order screen in the FOODSbyme app.',
      'Once a rider is in transit the order can no longer be cancelled in the app, because the food has been made and is on its way. Contact support and we will look at it case by case.',
      'Cancelling repeatedly after a creator has accepted and started cooking may affect your account reliability score. It does not affect your refund for that order.',
    ],
    footer: 'A creator preparing your food has already spent money on ingredients. Cancelling early costs them nothing; cancelling once cooking has started does not.',
  },
  {
    title: '4. If the Creator or FOODSbyme Cancels',
    content: `If a creator cancels your order, or FOODSbyme cancels it, or the order is never delivered, you receive a full refund of everything you paid, including the delivery fee. You do not need to request this and there is no penalty to your account.`,
  },
  {
    title: '5. After Delivery — the 24-Hour Resolution Window',
    content: `If something is wrong with an order that has been delivered, raise it through the resolution centre in the app within 24 hours of the order being marked delivered.

Raise it as soon as you can. Food is perishable and the condition it arrived in is what we are assessing, so a report made straight away — with photos — is far easier to decide in your favour than one made a day later.`,
    bullets: [
      'Open the order in the app and choose Report an issue, within 24 hours of delivery.',
      'Describe what was wrong and attach photos where you can. Photos of the food as it arrived carry the most weight.',
      'We review the report with the creator and decide on one of three outcomes: a full refund, a partial refund, or no refund.',
      'You will be told the outcome and the reason for it.',
    ],
    footer: 'Once the 24 hours have passed we can no longer reverse the payment automatically. You can still contact support — we will help where we can, but the options are more limited.',
  },
  {
    title: '6. What We Refund',
    content: `You are entitled to a refund in the following circumstances:`,
    bullets: [
      'The order was never delivered.',
      'The creator or FOODSbyme cancelled the order.',
      'You cancelled before a rider collected the order.',
      'Items were missing from what arrived, or you were sent the wrong items.',
      'The food was materially different from how it was described or pictured.',
      'The food arrived in an unsafe or inedible condition — spilled, spoiled, or cold when it should have been hot.',
      'You were charged more than once for the same order, or charged in error.',
    ],
  },
  {
    title: '7. What We Do Not Normally Refund',
    content: `We will usually decline a refund where:`,
    bullets: [
      'You changed your mind after the creator had begun preparing the food.',
      'The delivery address or phone number you supplied was wrong, or nobody was available to receive the order.',
      'The food matched its description and the complaint is about personal taste or preference.',
      'The issue is raised after the 24-hour resolution window and there is no supporting evidence.',
      'We find the claim to be fraudulent, or an account shows a pattern of unfounded refund requests.',
    ],
    footer: 'Every decision is made on the specific order. If you think a decision was wrong, you can ask for it to be reviewed — see section 11.',
  },
  {
    title: '8. How and When You Get Your Money Back',
    content: `Refunds are returned to the payment method you used. We do not charge a fee to process a refund, and we do not issue store credit in place of a refund unless you ask for it.`,
    bullets: [
      'Card and bank payments — the refund is submitted to our payment partner once approved, and typically reaches your account within 3 to 5 business days. The exact timing is set by your bank, not by FOODSbyme.',
      'FOODSbyme wallet payments — returned to your wallet balance, usually immediately.',
      'Cancelled orders — processed as soon as the cancellation is recorded.',
    ],
    footer: 'If an approved refund has not reached you after 5 business days, contact support@foodsbyme.com with your order number and we will trace it with our payment partner.',
  },
  {
    title: '9. Courses, Digital Products, Catering and Private Chef Bookings',
    content: `Purchases other than food orders — cooking courses, digital products, catering events and private chef bookings — are arranged directly with the creator and may carry their own terms, including deposits that are not refundable once the creator has committed the date or begun buying ingredients. Where such terms apply, they are shown to you before you pay.

These requests are not handled by the automatic in-app flow described above. Email support@foodsbyme.com with your booking or purchase reference and we will assess the request with the creator, case by case.`,
  },
  {
    title: '10. Chargebacks',
    content: `If you believe you have been charged incorrectly, please contact us before raising a chargeback with your bank. We can almost always resolve it faster directly, and a chargeback freezes the payment while the bank investigates.

If you do raise one, we cooperate fully with your bank and payment provider and will supply the order records they ask for. Accounts found to be raising fraudulent chargebacks may be suspended and the matter referred to our payment partners.`,
  },
  {
    title: '11. Contact and Escalation',
    content: `For any refund question, or to ask for a decision to be reviewed, contact us with your order number:

Email — support@foodsbyme.com
Phone — +234 807 235 0602
Post — FOODSbyme Technologies, 42, Oba Yekini Elegushi Rd, Lagos, Nigeria

We aim to respond to refund enquiries within 2 business days, and to resolve escalated disputes within 5 business days.`,
    footer: 'Nothing in this policy limits your rights under the Federal Competition and Consumer Protection Act 2018 or any other applicable Nigerian consumer protection law.',
  },
];

export default function RefundPolicyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          kicker="Legal"
          title="Refund & Cancellation Policy"
          intro="Last updated: August 2026. When an order can be cancelled, how we decide refunds, and how long your money takes to come back."
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
                Questions about a refund?{' '}
                <a href="mailto:support@foodsbyme.com" className="text-spice hover:underline">
                  support@foodsbyme.com
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
