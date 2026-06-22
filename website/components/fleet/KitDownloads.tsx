'use client';

import { FileText, Download } from 'lucide-react';

type Section = { heading: string; body: string; bullets?: string[] };

type Doc = {
  id: string;
  title: string;
  desc: string;
  pages: number;
  page1: Section[];
  page2: Section[];
};

const DOCS: Doc[] = [
  {
    id: 'fleet-partner-guide',
    title: 'Fleet Partner Guide',
    desc: 'The complete overview of how partnership works, from sign-up to settlement.',
    pages: 2,
    page1: [
      {
        heading: 'Welcome to the FOODS Network',
        body: 'FOODSbyme connects food creators with the people who love their food. Every order a creator fulfils needs to move — and the people who move it build real businesses on FOODS infrastructure. This guide walks you through how fleet partnership works, what you earn, what you receive, and how you grow from your first bike to a territory operation.',
      },
      {
        heading: 'How Partnership Works',
        body: 'You provide riders and local knowledge; FOODS provides the technology, brand, and order flow. Orders are routed to your fleet automatically based on proximity, capacity, and reliability. You and your riders are supported at every stage with training resources, operational tools, and a transparent settlement system that ensures what you earn is what you receive.',
      },
      {
        heading: 'What You Get as a Fleet Partner',
        body: 'From day one, you plug into infrastructure we have spent years building:',
        bullets: [
          'Automatic order routing — no chasing jobs, no bidding; orders come to you',
          'Real-time fleet dashboard with earnings, dispatch, and rider analytics',
          'Rider training programme and onboarding documentation',
          'FOODS brand kit — vest, helmet stickers, and thermal bag guidelines',
          'Transparent, weekly settlement to your registered bank account',
          'Dedicated operations support for escalations and account queries',
        ],
      },
    ],
    page2: [
      {
        heading: 'Getting Started',
        body: 'From application to first delivered order, most partners are earning within a week of approval:',
        bullets: [
          'Apply online at foodsbyme.com/fleet/apply — takes under 10 minutes',
          'Verification call with our partnerships team within 24–48 hours of approval',
          'Rider onboarding, driver app setup, and brand kit distribution',
          'Territory activation and first orders routed to your fleet',
        ],
      },
      {
        heading: 'Your Earnings Model',
        body: 'You earn a per-order delivery fee on every successfully completed order. Fees are set by distance tier and order type, with no subscription charge, platform tax, or hidden deduction. Earnings accrue in real time on your dashboard and settle to your bank account on a weekly cycle. Adjustments and disputes are handled transparently through the partner portal with full transaction history available at any time.',
      },
      {
        heading: 'The Growth Path',
        body: 'Partnership is designed as a wealth-creation model, not a gig arrangement. Prove reliability to unlock higher order volume, add riders to your fleet, and eventually qualify for a defined territory with priority routing rights. The strongest partners in the FOODS network started with a single bicycle or motorbike and now operate multi-rider fleets across entire city zones. Every milestone unlocks better tools, higher volume, and stronger commercial terms.',
      },
      {
        heading: 'Ready to Apply?',
        body: 'Visit foodsbyme.com/fleet/apply to submit your application. Our partnerships team reviews every application personally and responds within 48 hours. For direct enquiries, reach us at partnerships@foodsbyme.com or +234 807 235 0602.',
      },
    ],
  },
  {
    id: 'operations-handbook',
    title: 'Operations Handbook',
    desc: 'Day-to-day standards: dispatch, rider management, service quality, and safety.',
    pages: 2,
    page1: [
      {
        heading: 'Day-to-Day Operations',
        body: 'Consistent daily operations separate strong fleet partners from unreliable ones. Each shift should begin with a rider check-in, a brief on current demand expectations, and confirmation that all bikes are roadworthy and riders have their branded kit. Demand peaks reliably around lunch (12pm–2pm WAT) and dinner (6pm–9pm WAT) — plan your rider availability to match these windows. Under-staffing a peak will drag your on-time rate; over-staffing off-peak is avoidable cost.',
      },
      {
        heading: 'Managing Your Riders',
        body: 'Your riders are your product. Their performance directly determines how many orders route to your fleet. When onboarding new riders, complete all steps before their first live order:',
        bullets: [
          'Complete the FOODS Rider Training Module (available in the dashboard)',
          'Issue full branded kit — helmet sticker, vest or shirt, and thermal bag',
          'Walk through the rider app: accepting orders, live location, proof-of-delivery photo',
          'Set clear shift expectations, check-in procedures, and escalation contacts',
          'Review the code of conduct — particularly the customer communication rules',
        ],
      },
      {
        heading: 'Using the Fleet Dashboard',
        body: 'Your partner dashboard is your command centre. The dispatch screen shows all active riders with live locations and current assignment status. The analytics tab surfaces weekly on-time rate, acceptance rate, and per-rider earnings so you can identify performance gaps early. Settlement history, pending earnings, and transaction records are all accessible without contacting support. Log in at dashboard.foodsbyme.com using your partner credentials.',
      },
    ],
    page2: [
      {
        heading: 'Service Quality Standards',
        body: 'Service quality is scored on every order and feeds directly into your fleet reliability rating — which drives order volume. Every rider in your fleet must meet these standards on every delivery:',
        bullets: [
          'Arrive at the creator's collection point within the assigned pickup window',
          'Keep all food sealed and upright in the thermal bag throughout transit',
          'Communicate with the customer only through the FOODS in-app channel — no personal numbers',
          'Deliver to the exact confirmed address; submit the in-app proof-of-delivery photo before leaving',
          'Maintain a professional and respectful manner at every interaction with creators and customers',
        ],
      },
      {
        heading: 'Safety Requirements',
        body: 'Safety compliance is non-negotiable and tracked as part of your reliability score. All motorbike riders must wear a certified helmet and carry a valid rider's licence and third-party insurance. Bicycle riders must have functioning brakes and front and rear lights for any order after sunset. Fleet operators are responsible for verifying compliance before each shift. Any road incident must be reported to your fleet admin within 2 hours using the incident form in the dashboard.',
      },
      {
        heading: 'Maintaining Your Reliability Score',
        body: 'Your reliability score is a composite of on-time delivery rate, order acceptance rate, safety compliance, and customer feedback. A strong score (green zone) maximises your order volume; a declining score triggers a review conversation with our ops team. We do not suspend partners without warning — if your score drops, you will receive a notification and a 14-day remediation window with direct ops support to recover.',
      },
      {
        heading: 'Support & Escalations',
        body: 'For operational issues during active hours, use the in-app support channel for fastest response. For account, settlement, or fleet-level matters, contact partnerships@foodsbyme.com or call +234 807 235 0602. The ops team is available Monday–Saturday, 7am–10pm WAT. Emergency escalations (accident, theft, rider safety) go directly to the emergency line provided in your onboarding documentation.',
      },
    ],
  },
  {
    id: 'territory-guide',
    title: 'Territory Guide',
    desc: 'How territories work, how to qualify, and how to expand into adjacent zones.',
    pages: 2,
    page1: [
      {
        heading: 'What Is a Territory?',
        body: 'A territory is a defined geographic zone in which a fleet partner holds priority order assignment rights. When a creator order originates within your territory, your fleet receives first right of assignment before any other active partners in the area. Territories are not purchased — they are earned through sustained reliability, service quality, and demonstrated capacity to serve the zone without gaps or degraded performance.',
      },
      {
        heading: 'Benefits of Holding a Territory',
        body: 'Territory status is the most significant milestone in a fleet partner's growth journey. Beyond priority routing, territory partners receive:',
        bullets: [
          'Guaranteed minimum order flow during peak windows in your zone',
          'Official FOODS territory branding on your fleet vehicles and rider kit',
          'A named account manager as your dedicated FOODS operations contact',
          'Early access to new creator launches, campaigns, and promotional order surges in your area',
          'Anchor partner status in FOODS community events and public marketing',
          'Priority consideration for adjacent zone expansion as your fleet grows',
        ],
      },
      {
        heading: 'Territory Tiers in the FOODS Network',
        body: 'Territories are structured in three tiers based on geographic scope and fleet size requirements. A Micro-Zone covers a single neighbourhood or commercial cluster — ideal for a small, highly-focused fleet of 3–8 active riders. A City Zone covers a major urban district or several adjacent neighbourhoods, typically requiring 8–20 active riders to serve consistently. A Regional Zone covers a full metropolitan area and is suited to large fleets or franchise partners operating 20 or more riders across multiple sub-zones.',
      },
    ],
    page2: [
      {
        heading: 'Qualifying for a Territory',
        body: 'Territory eligibility is reviewed quarterly. To qualify, your fleet must sustain these metrics over a consecutive 60-day window before the review date:',
        bullets: [
          'On-time delivery rate of 90% or above (visible on your dashboard)',
          'Rider availability during both daily peak windows of 85% or above',
          'Fleet reliability score in the green zone throughout the review period',
          'Zero unresolved safety incidents in the 60-day window',
          'Active, consistent order volume demonstrating real demand coverage in the target zone',
        ],
      },
      {
        heading: 'The Territory Review Process',
        body: 'When your fleet meets the qualification criteria, submit a territory expression of interest through your partner dashboard or by emailing partnerships@foodsbyme.com. Our operations team conducts a zone analysis — checking demand levels, existing territory holders, and fleet fit for the area. Review typically completes within 5–10 business days. If approved, your territory is formally activated, your dashboard is upgraded with territory-level tools, and the branding kit is dispatched within 48 hours.',
      },
      {
        heading: 'Expanding into Adjacent Zones',
        body: 'Territory holders in good standing can apply to take on adjacent micro-zones or city zones as their fleet grows. Expansion applications are assessed on the same reliability metrics, plus evidence of sufficient rider supply to cover the new zone without degrading existing territory performance. Most partners who successfully expand have at least 15 consistently active riders before applying for a second zone. FOODS supports expansion with a zone-specific launch plan and temporary volume boost to seed demand in the new area.',
      },
      {
        heading: 'Your Rights and Obligations',
        body: 'Priority routing is maintained as long as your reliability score stays in the qualifying range. If your score drops below the threshold, priority routing is suspended and the zone enters a 30-day remediation review. FOODS provides full transparency on any score changes and works actively with partners through a recovery plan before any formal action is taken. Consistently underperforming territory holders receive at least two formal reviews and a remediation offer before any territory rights are reassigned.',
      },
    ],
  },
  {
    id: 'franchise-information-pack',
    title: 'Franchise Information Pack',
    desc: 'For regional partners: commercial terms, brand standards, and launch playbook.',
    pages: 2,
    page1: [
      {
        heading: 'The Regional Franchise Model',
        body: 'The FOODS Regional Franchise is the highest tier of fleet partnership. A franchise partner takes exclusive operational responsibility for delivery within a defined region — building and managing the full rider network, maintaining brand standards, and serving as the FOODS delivery anchor for all creators in that area. This is a serious business arrangement with significant commercial upside and clear mutual obligations between the partner and FOODSbyme.',
      },
      {
        heading: 'What Partners Bring',
        body: 'Franchise partners are expected to arrive as operators, not applicants. The minimum requirements for franchise consideration are:',
        bullets: [
          'A registered business entity (or firm intent to register before launch)',
          'Evidence of capital or access to funding sufficient to build and run the fleet',
          'Local market knowledge and an existing or recruitable rider base in the target region',
          'At least one dedicated operations lead with logistics or field management experience',
          'Full commitment to FOODS brand standards and service quality across all rider touchpoints',
        ],
      },
      {
        heading: 'Commercial Framework',
        body: 'Franchise partners operate on a negotiated commercial arrangement calibrated to territory size, market complexity, and projected order volume. Revenue share rates are competitive with standard fleet partnership rates at baseline, with significant growth incentives that activate as volume milestones are reached. A one-time onboarding fee covers the brand kit, launch support package, training programme delivery, and 90 days of priority account management. Full commercial terms are presented during the evaluation stage and are not subject to change once signed.',
      },
    ],
    page2: [
      {
        heading: 'FOODS Brand Standards',
        body: 'Operating under the FOODS name means representing the brand at every customer and creator interaction. Franchise partners are audited quarterly and must maintain:',
        bullets: [
          'All riders in full FOODS-branded kit at all times during active shifts',
          'Fleet vehicles displaying FOODS branding per the brand guidelines kit provided at launch',
          'Rider conduct that reflects FOODS service values — prompt, professional, and respectful',
          'Any public-facing communication using the FOODS name must be pre-approved by the brand team',
          'Responses to customer feedback within 24 hours of escalation, logged in the partner portal',
        ],
      },
      {
        heading: 'Launch Playbook Summary',
        body: 'Every franchise launch follows a structured 8-week playbook from contract signing to first live public order:',
        bullets: [
          'Weeks 1–2: Legal completion, business setup finalisation, and brand kit delivery',
          'Weeks 3–4: Rider recruitment, FOODS training programme delivery, and driver app setup',
          'Weeks 5–6: Soft launch with a limited creator pool for quality calibration and score baseline',
          'Weeks 7–8: Full go-live across all territory creators with a coordinated public launch',
        ],
      },
      {
        heading: 'What FOODSbyme Provides',
        body: 'Franchise partners are never operating in isolation. FOODS provides the full technology stack — order assignment engine, live tracking, rider app, fleet dashboard, and settlement infrastructure. Beyond technology, partners receive the full brand kit, an ongoing rider training programme, a dedicated account manager throughout launch and scale, direct access to operations leadership for strategic decisions, and marketing support for creator onboarding in the new territory. We succeed when our franchise partners succeed.',
      },
      {
        heading: 'Starting the Conversation',
        body: 'Franchise opportunities are assessed on a case-by-case basis and are available in a limited number of markets. To express interest, email partnerships@foodsbyme.com with a brief overview of your proposed region, your operational background, and your intended fleet size. Our regional partnerships team will respond within 3 business days to arrange an initial conversation.',
      },
    ],
  },
  {
    id: 'partnership-deck',
    title: 'Partnership Deck',
    desc: 'The vision, the opportunity, and the economics — ideal for stakeholders.',
    pages: 2,
    page1: [
      {
        heading: 'The Opportunity',
        body: 'Africa's food economy is undergoing a generational shift. A new wave of food creators — home cooks, private chefs, culinary entrepreneurs — is building real businesses and loyal audiences outside the traditional restaurant model. These creators generate orders that need to move reliably, affordably, and at scale. FOODSbyme is building the delivery network that makes this possible, and making it partner-owned from day one.',
      },
      {
        heading: 'Why a Partner-Owned Network?',
        body: 'Most delivery platforms treat riders as disposable gig labour — no equity, no stability, no stake in the outcome. We took a different position. The people moving the food should build real equity in the network they power. Partner-ownership produces better service quality, dramatically lower rider churn, and a more resilient network — because partners who own a stake in outcomes behave differently from those who don't. This model is not charity; it is the most commercially durable way to build a logistics network in our markets.',
      },
      {
        heading: 'The Economics',
        body: 'Every FOODS order generates a transparent delivery fee. There is no subscription, no bidding, and no hidden deduction. A single active rider in a well-served zone generates ₦80,000–₦120,000 in monthly gross earnings. A managed fleet of 10 riders operating at target efficiency generates ₦800,000–₦1.2m in monthly gross delivery revenue before growth incentives and territory bonuses. The Revenue Calculator at foodsbyme.com/fleet/resources lets you model your fleet size and zone for a personalised estimate.',
      },
    ],
    page2: [
      {
        heading: 'What FOODSbyme Provides',
        body: 'Partners plug into an infrastructure built over years and continuously improved:',
        bullets: [
          'Order assignment engine — routes jobs to your fleet automatically with no dispatch overhead',
          'Live tracking and proof-of-delivery for every order, visible to creators, customers, and your dashboard',
          'Weekly settlement with full transaction transparency and a partner-facing audit trail',
          'Brand kit, rider training programme, and ongoing operational support',
          'Marketing visibility — your fleet is presented to creators as a verified FOODS partner',
          'Technology updates, new product features, and platform improvements at no additional charge',
        ],
      },
      {
        heading: 'Your Path from Bike to Business',
        body: 'The partnership growth journey moves through three clear stages. In the Starting stage (1–5 riders), you build reputation and reliability within your area and establish your operational baseline. In the Growing stage (5–20 riders), you qualify for territory status, unlock priority routing, and expand your rider team with confidence. In the Operating stage (20+ riders), you hold territorial rights, benefit from anchor partner status, and may qualify for regional expansion or franchise designation. Each stage unlocks better tools, more volume, and stronger commercial terms.',
      },
      {
        heading: 'Our Commitment to Partners',
        body: 'We make specific, binding commitments to every fleet partner: fair and transparent settlement with no retroactive changes, access to the operations team for escalations with a guaranteed response SLA, advance notice of any platform changes that materially affect earnings, and a genuine growth path with the tools and support to achieve it. We do not extract value from partners — we build it with them. That is the only model that works at the scale we are building towards.',
      },
      {
        heading: 'Join the Network',
        body: 'Apply online at foodsbyme.com/fleet/apply — the process takes under 10 minutes and our partnerships team responds personally within 48 hours. For stakeholder conversations, investor briefings, or franchise enquiries, contact partnerships@foodsbyme.com or call +234 807 235 0602. We onboard new fleet partners across Nigeria every week, with additional markets opening through 2026.',
      },
    ],
  },
];

function renderSection(s: Section): string {
  const bullets = s.bullets
    ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';
  return `<section><h2>${s.heading}</h2><p>${s.body}</p>${bullets}</section>`;
}

function printDoc(doc: Doc) {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) return;
  const today = new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
  const p1 = doc.page1.map(renderSection).join('');
  const p2 = doc.page2.map(renderSection).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>FOODSbyme — ${doc.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DM Sans',sans-serif; color:#111827; background:#FFFFFF; line-height:1.7; }
    .page { max-width:780px; margin:0 auto; padding:48px 56px; }
    .cover { background:#111827; color:#FAFAFA; border-radius:20px; padding:48px 44px; margin-bottom:40px; position:relative; overflow:hidden; }
    .cover::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 10%, rgba(200,75,49,.4), transparent 55%); pointer-events:none; }
    .brand { font-family:'Playfair Display',serif; font-size:18px; font-weight:600; position:relative; }
    .kicker { color:#FF6B35; font-size:11px; letter-spacing:.22em; text-transform:uppercase; font-weight:600; margin-top:36px; position:relative; }
    h1 { font-family:'Playfair Display',serif; font-size:36px; line-height:1.08; margin-top:12px; font-weight:600; position:relative; }
    .meta { color:rgba(255,255,255,.45); font-size:12px; margin-top:20px; position:relative; }
    section { margin-bottom:22px; }
    h2 { font-family:'Playfair Display',serif; font-size:18px; color:#E85A2A; margin-bottom:6px; }
    p { color:#1F2937; font-weight:300; font-size:13.5px; }
    ul { padding-left:18px; margin-top:8px; }
    ul li { color:#1F2937; font-weight:300; font-size:13px; margin-bottom:5px; line-height:1.55; }
    .page-break { page-break-before:always; break-before:page; padding-top:48px; }
    .page-header { font-size:10px; color:#9CA3AF; text-transform:uppercase; letter-spacing:.18em; margin-bottom:30px; padding-bottom:10px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; }
    .foot { margin-top:40px; padding-top:18px; border-top:1px solid #E5E7EB; color:#6B7280; font-size:11px; display:flex; justify-content:space-between; }
    @media print { body{background:#fff;} .page{padding:0 28px;} .noprint{display:none;} }
    .btn { display:inline-block; margin:0 0 28px; background:#FF6B35; color:#fff; padding:11px 20px; border-radius:99px; text-decoration:none; font-weight:600; font-size:13px; }
  </style></head><body>
  <div class="page">
    <a class="btn noprint" href="#" onclick="window.print();return false;">⬇ Save as PDF / Print</a>
    <div class="cover">
      <div class="brand">FOODSbyme</div>
      <div class="kicker">Fleet Partner Kit</div>
      <h1>${doc.title}</h1>
      <div class="meta">Partner Kit · Generated ${today} · partnerships@foodsbyme.com</div>
    </div>
    ${p1}
    <div class="page-break">
      <div class="page-header"><span>FOODSbyme — ${doc.title}</span><span>Continued</span></div>
      ${p2}
    </div>
    <div class="foot">
      <span>© ${new Date().getFullYear()} FOODSbyme Technologies</span>
      <span>foodsbyme.com · partnerships@foodsbyme.com</span>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}</script>
  </body></html>`);
  w.document.close();
}

export default function KitDownloads() {
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {DOCS.map((doc) => (
        <div key={doc.id} className="card p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center">
              <FileText size={20} />
            </span>
            <span className="text-[11px] text-muted font-medium">{doc.pages} pages · PDF</span>
          </div>
          <h3 className="font-serif text-xl text-ink mb-2">{doc.title}</h3>
          <p className="text-stone font-light text-[14px] leading-relaxed flex-1">{doc.desc}</p>
          <button onClick={() => printDoc(doc)} className="btn-ghost btn-sm mt-5 self-start">
            <Download size={15} /> Download
          </button>
        </div>
      ))}
    </div>
  );
}
