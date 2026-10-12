// Legal documents. Published in English only; the English text is the binding one.
// Changes made 2026-10-12 for international users need review by counsel before relying on them.

export type LegalSection = { title: string; content: string; bullets?: string[]; footer?: string };
export type LegalDoc = { updated: string; email: string; sections: LegalSection[] };

const OFFICE = 'FOODSbyme Technologies\n42, Oba Yekini Elegushi Rd, Lagos, Nigeria';

export const PRIVACY: LegalDoc = {
  updated: '2026-10-12',
  email: 'privacy@foodsbyme.com',
  sections: [
    {
      title: '1. Who We Are',
      content:
        'FOODSbyme Technologies operates the FOODSbyme platform, including our mobile apps, website and APIs, for users around the world. Our registered office is at 42, Oba Yekini Elegushi Rd, Lagos, Nigeria. We are the data controller for the personal data described in this policy. For privacy questions, contact privacy@foodsbyme.com.',
    },
    {
      title: '2. Data We Collect',
      content: 'We collect the following categories of personal data:',
      bullets: [
        'Account data — name, email address, phone number, profile photo, and password hash.',
        'Usage data — pages visited, features used, device identifiers, browser type, and IP address.',
        'Location data — delivery pickup and drop-off locations provided when placing or fulfilling orders, and the approximate country and city we derive from your IP address to show local information.',
        'Payment data — we do not store full card numbers. Payments are tokenised and handled by our certified payment partners.',
        'Creator data — kitchen name and description, menu items, pricing, food images, and bank account details for settlement.',
        'Fleet partner data — vehicle type, operating area, rider records, and earnings history.',
        'Communications — messages sent to our support team and any correspondence with FOODSbyme.',
      ],
    },
    {
      title: '3. How We Use Your Data',
      content: 'We use your personal data to:',
      bullets: [
        'Operate the platform — matching orders, processing payments, and coordinating deliveries.',
        'Communicate with you — order updates, account notifications, support responses, and (where you have agreed) marketing.',
        'Show you the right local information — your language, currency and local time.',
        'Improve our service — internal analytics, feature testing, and fraud and abuse prevention.',
        'Settle payments — calculating and paying out earnings to creators and fleet partners.',
        'Comply with legal obligations — tax reporting, regulatory requirements, and responding to lawful requests from authorities.',
      ],
    },
    {
      title: '4. Legal Bases for Processing',
      content: 'We process personal data only where the law that applies to you allows it. Depending on where you live, we rely on:',
      bullets: [
        'Contract — processing necessary to provide the services you signed up for.',
        'Legitimate interests — platform safety, fraud prevention, and service improvement, where our interests are not overridden by your rights.',
        'Legal obligation — compliance with the tax, consumer-protection and data-protection laws that apply to us.',
        'Consent — where we ask for your explicit permission, such as for optional marketing. You may withdraw consent at any time.',
      ],
      footer:
        'These bases correspond to those in the Nigeria Data Protection Act 2023, the EU and UK General Data Protection Regulation, and comparable laws in other countries.',
    },
    {
      title: '5. Who We Share Data With',
      content: 'We share your data only with:',
      bullets: [
        'Payment processors — to authorise and settle transactions.',
        'Cloud and infrastructure providers — to host and operate the platform securely.',
        'Delivery fleet partners — limited order details (pickup address, delivery address, order summary) necessary to fulfil your order.',
        'Analytics providers — aggregated and anonymised data only; no individual user data is sold.',
        'Legal and regulatory authorities — where required by applicable law or a lawful court order.',
      ],
      footer: 'We do not sell, rent, or trade your personal data to third parties for their own commercial purposes.',
    },
    {
      title: '6. International Transfers',
      content:
        'FOODSbyme is a global service. Your personal data may be processed in countries other than the one you live in, including Nigeria and the countries where our cloud, payment and support providers operate. When we transfer personal data across borders, we take steps to keep it protected in line with this policy and with the law that applies to you.',
    },
    {
      title: '7. Data Retention',
      content:
        'We retain personal data for as long as your account is active and for seven (7) years after account closure, to meet our tax and regulatory obligations. Order history and transaction records are similarly retained for seven years. Data that is not subject to a legal retention requirement is deleted within 30 days of a verified deletion request.',
    },
    {
      title: '8. Your Rights',
      content: 'Wherever you live, you can ask us to:',
      bullets: [
        'Access — give you a copy of the personal data we hold about you.',
        'Correct — fix inaccurate or incomplete data.',
        'Delete — erase data we are not legally required to keep.',
        'Object or restrict — stop or limit processing based on legitimate interests, or for marketing.',
        'Port — give you your data in a structured, machine-readable format.',
      ],
      footer:
        'To exercise any of these rights, email privacy@foodsbyme.com. We respond within 30 days, or sooner where your local law requires it. You can also complain to the data protection authority where you live — for example the Nigeria Data Protection Commission, a supervisory authority in the European Union, or the UK Information Commissioner’s Office.',
    },
    {
      title: '9. Security',
      content:
        'We use industry-standard security measures including encryption in transit (TLS), encryption at rest for sensitive fields, access controls, and regular security reviews. No system is perfectly secure; if you have reason to believe your account has been compromised, contact support@foodsbyme.com immediately.',
    },
    {
      title: '10. Children',
      content:
        'FOODSbyme is for users aged 18 and over. We do not knowingly collect personal data from anyone under 18. If you believe a minor has created an account or given us personal data, email privacy@foodsbyme.com and we will delete it promptly.',
    },
    {
      title: '11. Changes to This Policy',
      content:
        'We will notify registered users of material changes to this policy by email at least 14 days before they take effect. The date at the top of this page always reflects the most recent version.',
    },
    { title: '12. Contact', content: `For any privacy question or request:\n\nprivacy@foodsbyme.com\n${OFFICE}` },
  ],
};

export const TERMS: LegalDoc = {
  updated: '2026-10-12',
  email: 'hello@foodsbyme.com',
  sections: [
    {
      title: '1. About FOODSbyme',
      content:
        'FOODSbyme is a creator commerce platform operated by FOODSbyme Technologies, a company registered in Nigeria. We connect food creators, customers and delivery fleet partners in the countries where FOODSbyme is available. FOODSbyme is a marketplace operator: we do not prepare food, employ riders, or hold inventory. By using our platform, you agree to these terms.',
    },
    {
      title: '2. Eligibility and Your Account',
      content:
        'You must be at least 18 years old to create an account. By registering, you confirm that the information you provide is accurate and kept up to date. You are responsible for keeping your login credentials confidential and for all activity under your account. If you believe your account has been compromised, contact support@foodsbyme.com immediately. We may suspend or terminate accounts that violate these terms or harm other users or FOODSbyme.',
    },
    {
      title: '3. For Creators',
      content: 'By selling on FOODSbyme, you confirm and agree that:',
      bullets: [
        'All food is prepared in sanitary conditions and complies with the food-safety laws and regulations of the place where you prepare and sell it.',
        'Pricing, descriptions, ingredient lists and allergen information are accurate and kept current.',
        'You hold any registrations, permits, licences or health certifications required to prepare and sell food from your location.',
        'You will fulfil orders you accept. Persistent cancellations or failure to fulfil confirmed orders will lead to a performance review and may lead to account suspension.',
        'You grant FOODSbyme a licence to display your profile, images and menu content on the platform and in marketing materials.',
      ],
      footer:
        'FOODSbyme charges a platform commission on each completed order. Current rates are shown in your creator dashboard and may be updated with 14 days’ notice.',
    },
    {
      title: '4. For Customers',
      content: 'By placing an order, you confirm that:',
      bullets: [
        'The delivery address you provide is accurate and accessible.',
        'Someone will be available to receive the order at the delivery time.',
        'You are authorised to use the payment method for the transaction.',
      ],
      footer:
        'Refund and dispute requests must be raised through the in-app resolution centre within the window set out in our Refund and Cancellation Policy. We aim to resolve disputes within 5 business days. Our decision on a dispute does not affect your statutory rights as a consumer.',
    },
    {
      title: '5. For Fleet Partners',
      content: 'By joining as a fleet partner, you confirm and agree that:',
      bullets: [
        'All vehicles in your fleet are roadworthy, properly maintained, and insured as the law where you operate requires.',
        'All riders hold any licence their vehicle type requires locally and follow applicable road regulations.',
        'You will comply with the FOODSbyme Operations Handbook and its service quality standards.',
        'Your fleet will operate within the area specified in your application and any territory approved later.',
      ],
      footer:
        'Fleet partner earnings, settlement cycles, territory rights and performance standards are governed by the Fleet Partner Agreement, which forms part of these terms for registered fleet partners.',
    },
    {
      title: '6. Payments and Settlement',
      content:
        'Customer transactions are processed by our certified payment partners. By completing a purchase, you authorise the charge to your selected payment method. Prices are shown in the currency the creator sells in. If you pay in a different currency, your bank or card provider may convert the amount and charge its own fees. Creator and fleet partner earnings can be withdrawn on request to a verified bank account. FOODSbyme may withhold settlement in cases of suspected fraud, disputed transactions or confirmed policy violations while they are investigated.',
    },
    {
      title: '7. Prohibited Conduct',
      content: 'You may not use FOODSbyme to:',
      bullets: [
        'Do anything that violates the law of the country you are in.',
        'Misrepresent your identity, credentials, or the nature of your business or food products.',
        'Post false, misleading or defamatory content, reviews or information.',
        'Interfere with or disrupt the operation, security or integrity of the platform.',
        'Bypass, undermine or circumvent our payment, settlement or order-routing systems.',
        'Harvest user data, scrape content, or use automated tools to interact with the platform without authorisation.',
        'Harass, threaten or harm other users.',
      ],
      footer: 'Violations may result in immediate account suspension and, where applicable, referral to law enforcement.',
    },
    {
      title: '8. Intellectual Property',
      content:
        'All content on FOODSbyme, including our name, logo, brand mark, design system, code and editorial content, is owned by or licensed to FOODSbyme Technologies. You may not copy, reproduce, distribute or use our intellectual property without express written permission. User-generated content (creator profiles, food images, reviews) remains the property of the user; by posting it, you grant FOODSbyme a non-exclusive licence to display and promote it on the platform.',
    },
    {
      title: '9. Limitation of Liability',
      content: 'To the maximum extent permitted by applicable law, FOODSbyme is not liable for:',
      bullets: [
        'Food safety issues resulting from a creator’s preparation, storage or handling practices.',
        'Delivery delays caused by traffic, weather, road conditions or force majeure events.',
        'Loss of income, profits or business opportunity arising from platform downtime or service changes.',
        'Indirect, consequential or punitive damages of any kind.',
      ],
      footer:
        'Our total liability to any user for any claim arising out of these terms or the platform is limited to the value of the relevant transaction. Nothing in these terms limits liability that cannot be limited under the law that applies to you.',
    },
    {
      title: '10. Governing Law and Disputes',
      content:
        'These terms are governed by the laws of the Federal Republic of Nigeria. If you use FOODSbyme as a consumer, you also keep the protection of the mandatory laws of the country where you live, and you may bring a claim in the courts of that country. Otherwise, disputes are subject to the non-exclusive jurisdiction of the Nigerian courts. We will always try to resolve a dispute in good faith before formal proceedings.',
    },
    {
      title: '11. Changes to These Terms',
      content:
        'We may update these terms from time to time. We will notify registered users of material changes by email at least 14 days before they take effect. The date at the top of this page reflects the most recent version.',
    },
    { title: '12. Contact', content: `For questions about these terms:\n\nhello@foodsbyme.com\n${OFFICE}` },
  ],
};

export const REFUNDS: LegalDoc = {
  updated: '2026-10-12',
  email: 'support@foodsbyme.com',
  sections: [
    {
      title: '1. Who This Policy Covers',
      content: `FOODSbyme Technologies operates the FOODSbyme platform, a marketplace where customers order from independent food creators and fleet partners deliver those orders. Our registered office is at 42, Oba Yekini Elegushi Rd, Lagos, Nigeria.

This policy applies to every payment made through the FOODSbyme mobile apps and website, in every country, and explains when an order can be cancelled, when a refund is due, and how long it takes to reach you. Payments are processed by licensed payment partners; FOODSbyme does not store your full card details.`,
    },
    {
      title: '2. Your Money Is Held Until the Order Is Complete',
      content: `When you pay for an order, the money does not go straight to the creator. FOODSbyme holds it until the order has been delivered and the resolution window described in section 5 has closed.

This matters for refunds: if an order is cancelled before delivery, the funds are still being held, and returning them does not depend on recovering money from anyone. The creator is only paid once the order has completed without an unresolved issue.`,
    },
    {
      title: '3. Cancelling Before Delivery',
      content:
        'You can cancel an order yourself, in the app, at any point before a rider has collected it — that is, while the order is awaiting payment, confirmed, accepted by the creator, being prepared, or ready for collection. Cancelling at any of these stages refunds the full amount you paid.',
      bullets: [
        'Cancel from the order screen in the FOODSbyme app.',
        'Once a rider is in transit the order can no longer be cancelled in the app, because the food has been made and is on its way. Contact support and we will look at it case by case.',
        'Cancelling repeatedly after a creator has accepted and started cooking may affect your account reliability score. It does not affect your refund for that order.',
      ],
      footer: 'A creator preparing your food has already spent money on ingredients. Cancelling early costs them nothing; cancelling once cooking has started does not.',
    },
    {
      title: '4. If the Creator or FOODSbyme Cancels',
      content:
        'If a creator cancels your order, or FOODSbyme cancels it, or the order is never delivered, you receive a full refund of everything you paid, including the delivery fee. You do not need to request this and there is no penalty to your account.',
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
      footer:
        'Once the 24 hours have passed we can no longer reverse the payment automatically. You can still contact support — we will help where we can, but the options are more limited.',
    },
    {
      title: '6. What We Refund',
      content: 'You are entitled to a refund in the following circumstances:',
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
      content: 'We will usually decline a refund where:',
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
      content:
        'Refunds are returned to the payment method you used, in the currency you paid in. We do not charge a fee to process a refund, and we do not issue store credit in place of a refund unless you ask for it.',
      bullets: [
        'Card and bank payments — the refund is submitted to our payment partner once approved, and typically reaches your account within 3 to 5 business days. The exact timing is set by your bank, not by FOODSbyme.',
        'FOODSbyme wallet payments — returned to your wallet balance, usually immediately.',
        'Cancelled orders — processed as soon as the cancellation is recorded.',
      ],
      footer:
        'If an approved refund has not reached you after 5 business days, contact support@foodsbyme.com with your order number and we will trace it with our payment partner.',
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
Post — ${OFFICE.replace('\n', ', ')}

We aim to respond to refund enquiries within 2 business days, and to resolve escalated disputes within 5 business days.`,
      footer:
        'Nothing in this policy limits the rights you have as a consumer under the law of the country where you live — including, in Nigeria, the Federal Competition and Consumer Protection Act 2018.',
    },
  ],
};

export const IMPRINT: LegalDoc = {
  updated: '2026-10-12',
  email: 'hello@foodsbyme.com',
  sections: [
    { title: 'Operator', content: 'FOODSbyme Technologies' },
    { title: 'Registered office', content: '42, Oba Yekini Elegushi Rd\nLagos\nNigeria' },
    { title: 'Contact', content: 'Email: hello@foodsbyme.com\nPhone: +234 807 235 0602' },
    { title: 'Responsible for content', content: 'FOODSbyme Technologies, at the address above.' },
  ],
};
