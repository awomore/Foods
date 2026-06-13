'use client';

import { FileText, Download } from 'lucide-react';

type Doc = {
  id: string;
  title: string;
  desc: string;
  pages: number;
  sections: { heading: string; body: string }[];
};

const DOCS: Doc[] = [
  {
    id: 'fleet-partner-guide',
    title: 'Fleet Partner Guide',
    desc: 'The complete overview of how partnership works, from sign-up to settlement.',
    pages: 12,
    sections: [
      { heading: 'Welcome to the network', body: 'FOODS connects food creators with the people who love their food. Fleet partners power the delivery layer that makes the whole economy move. This guide walks you through how partnership works and how to grow.' },
      { heading: 'How partnership works', body: 'You provide riders and local knowledge; FOODS provides the technology, brand, and order flow. Orders are routed to your fleet automatically based on proximity, capacity, and reliability. You earn on every delivered order with transparent settlement.' },
      { heading: 'Getting started', body: 'Apply online, complete a verification call, attend onboarding and training, then go live in your territory. Most partners are earning within a week of approval.' },
      { heading: 'Earnings & settlement', body: 'Earnings accrue per delivered order. Your dashboard shows pending and settled amounts in real time, paid to your registered account on a regular cycle.' },
      { heading: 'Growing your fleet', body: 'Prove reliability to unlock higher volume, add riders, and eventually claim a defined territory. The strongest partners started with one bike.' },
    ],
  },
  {
    id: 'operations-handbook',
    title: 'Operations Handbook',
    desc: 'Day-to-day standards: dispatch, rider management, service quality, and safety.',
    pages: 18,
    sections: [
      { heading: 'Daily operations', body: 'Start-of-day checks, rider availability, and shift planning. Keep enough riders online to match demand windows in your area — lunch and evening peaks drive most volume.' },
      { heading: 'Rider management', body: 'Onboarding new riders, setting expectations, and using the fleet dashboard to monitor activity, on-time rate, and earnings per rider.' },
      { heading: 'Service quality', body: 'Handling standards for hot and cold items, contactless handoff, and customer communication. Service quality directly affects how many orders route to you.' },
      { heading: 'Safety first', body: 'Helmet and gear requirements, safe-riding standards, and incident reporting. Partner reliability scores include safety compliance.' },
    ],
  },
  {
    id: 'territory-guide',
    title: 'Territory Guide',
    desc: 'How territories work, how to qualify, and how to expand into adjacent zones.',
    pages: 9,
    sections: [
      { heading: 'What is a territory?', body: 'A defined operating zone where you have priority order assignment. Territories reward partners who consistently deliver reliable service.' },
      { heading: 'Qualifying for a territory', body: 'Maintain a strong on-time rate and rider availability over a sustained period. Our ops team reviews qualifying partners for territory grants.' },
      { heading: 'Expanding', body: 'Once you’ve mastered one territory, you can apply to take on adjacent zones, growing into a regional operation.' },
    ],
  },
  {
    id: 'franchise-information-pack',
    title: 'Franchise Information Pack',
    desc: 'For regional partners: commercial terms, brand standards, and launch playbook.',
    pages: 16,
    sections: [
      { heading: 'The franchise model', body: 'Regional franchise partners build and run FOODS delivery for an entire region under exclusive territory rights, full brand support, and a proven launch playbook.' },
      { heading: 'Commercial terms', body: 'Tailored commercial terms based on territory size and market. Includes growth incentives tied to coverage and reliability milestones.' },
      { heading: 'Brand standards', body: 'Operating under the FOODS brand means meeting consistent standards for service, presentation, and rider conduct. The brand kit covers everything you need.' },
      { heading: 'Launch playbook', body: 'A step-by-step plan for launching delivery in a new region — recruitment, training, demand seeding, and go-live.' },
    ],
  },
  {
    id: 'partnership-deck',
    title: 'Partnership Deck',
    desc: 'The vision, the opportunity, and the economics — ideal for stakeholders.',
    pages: 14,
    sections: [
      { heading: 'The opportunity', body: 'Africa’s food economy is being rebuilt around creators. Every creator order needs delivery — and that network is owned by partners, not the platform.' },
      { heading: 'Why partner-owned', body: 'We believe the people moving the food should build equity too. The model is designed for wealth creation, not gig churn.' },
      { heading: 'The economics', body: 'Transparent per-order earnings, real settlement, and a clear path from one bike to a territory. Use the Revenue Calculator to model your fleet.' },
      { heading: 'Get involved', body: 'Apply online, talk to partnerships, or request a call. We onboard partners across Lagos and expanding cities every week.' },
    ],
  },
];

function printDoc(doc: Doc) {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) return;
  const today = new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
  const sections = doc.sections
    .map(
      (s) => `<section><h2>${s.heading}</h2><p>${s.body}</p></section>`
    )
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>FOODSbyme — ${doc.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DM Sans',sans-serif; color:#111827; background:#FFFFFF; line-height:1.6; }
    .page { max-width:780px; margin:0 auto; padding:64px 56px; }
    .cover { background:#111827; color:#FAFAFA; border-radius:24px; padding:56px 48px; margin-bottom:48px; position:relative; overflow:hidden; }
    .cover::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 10%, rgba(200,75,49,.4), transparent 55%); }
    .brand { font-family:'Playfair Display',serif; font-size:20px; font-weight:600; position:relative; }
    .kicker { color:#FF6B35; font-size:11px; letter-spacing:.22em; text-transform:uppercase; font-weight:600; margin-top:40px; position:relative; }
    h1 { font-family:'Playfair Display',serif; font-size:44px; line-height:1.05; margin-top:14px; font-weight:600; position:relative; }
    .meta { color:rgba(255, 255, 255,.5); font-size:13px; margin-top:24px; position:relative; }
    section { margin-bottom:30px; }
    h2 { font-family:'Playfair Display',serif; font-size:22px; color:#E85A2A; margin-bottom:8px; }
    p { color:#1F2937; font-weight:300; }
    .foot { margin-top:48px; padding-top:24px; border-top:1px solid #E5E7EB; color:#6B7280; font-size:12px; display:flex; justify-content:space-between; }
    @media print { body { background:#fff; } .page { padding:0 24px; } .noprint { display:none; } }
    .btn { display:inline-block; margin:24px 0; background:#FF6B35; color:#fff; padding:12px 22px; border-radius:99px; text-decoration:none; font-weight:600; font-size:14px; }
  </style></head><body>
  <div class="page">
    <a class="btn noprint" href="#" onclick="window.print();return false;">Save as PDF / Print</a>
    <div class="cover">
      <div class="brand">FOODSbyme</div>
      <div class="kicker">Fleet Partner Kit</div>
      <h1>${doc.title}</h1>
      <div class="meta">${doc.pages} pages · Generated ${today} · partnerships@foodsbyme.com</div>
    </div>
    ${sections}
    <div class="foot"><span>© ${new Date().getFullYear()} FOODSbyme Technologies</span><span>foodsbyme.com</span></div>
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
