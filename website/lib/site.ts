// Single source of truth for site-wide config, navigation, and brand constants.

export const SITE = {
  name: 'FOODSbyme',
  legalName: 'FOODSbyme Technologies',
  domain: 'foodsbyme.com',
  url: 'https://foodsbyme.com',
  tagline: 'Where food creators build audiences, earn income, and grow communities.',
  description:
    'FOODSbyme is the home of Africa’s creator-commerce food economy. Discover food creators, follow their kitchens, order experiences, join communities, and power delivery as a fleet partner.',
  email: {
    hello: 'hello@foodsbyme.com',
    support: 'support@foodsbyme.com',
    partnerships: 'partnerships@foodsbyme.com',
    press: 'press@foodsbyme.com',
    careers: 'careers@foodsbyme.com',
    creators: 'creators@foodsbyme.com',
  },
  phone: { display: '+234 807 235 0602', href: 'tel:+2348072350602' },
  address: { street: '42, Oba Yekini Elegushi Rd', city: 'Lagos', country: 'Nigeria' },
  social: {
    instagram: 'https://instagram.com/foodsbyme_ig',
    twitter: 'https://x.com/foodsbyme_x',
    tiktok: 'https://tiktok.com/@foodsbyme_tiktok',
    linkedin: 'https://linkedin.com/company/foodsbyme',
  },
  app: {
    ios: 'https://apps.apple.com/app/foodsbyme',
    android: 'https://play.google.com/store/apps/details?id=com.foodsbyme.app',
  },
} as const;

export type NavLink = { label: string; href: string; desc?: string };
export type NavGroup = { label: string; href?: string; links?: NavLink[] };

// Primary header navigation — multi-page information architecture.
export const PRIMARY_NAV: NavGroup[] = [
  {
    label: 'Discover',
    links: [
      { label: 'How it works', href: '/how-it-works', desc: 'From craving to community in five moves.' },
      { label: 'For customers', href: '/for-customers', desc: 'Follow kitchens you love, order experiences.' },
      { label: 'Communities', href: '/communities', desc: 'Gift meals, build food communities.' },
      { label: 'Stories', href: '/blog', desc: 'Creator journeys, recipes, and culture.' },
    ],
  },
  {
    label: 'For creators',
    href: '/for-creators',
  },
  {
    label: 'Fleet partners',
    links: [
      { label: 'Become a partner', href: '/fleet', desc: 'Power the delivery network behind the economy.' },
      { label: 'Partner types', href: '/fleet/partner-types', desc: 'From single bikes to logistics fleets.' },
      { label: 'Apply now', href: '/fleet/apply', desc: 'A five-step application. No long forms.' },
      { label: 'Partner kit', href: '/fleet/resources', desc: 'Guides, handbooks, and the revenue calculator.' },
    ],
  },
  {
    label: 'Developers',
    links: [
      { label: 'Platform overview', href: '/developers', desc: 'FOODS as infrastructure, not just an app.' },
      { label: 'Order Assignment API', href: '/developers/order-assignment', desc: 'Route orders to your fleet.' },
      { label: 'Tracking API', href: '/developers/tracking', desc: 'Real-time location and status.' },
      { label: 'Webhooks', href: '/developers/webhooks', desc: 'React to events as they happen.' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: '/about', desc: 'The vision for a creator food economy.' },
      { label: 'Careers', href: '/careers', desc: 'Build the future of food with us.' },
      { label: 'Press', href: '/press', desc: 'Media kit, news, and brand assets.' },
      { label: 'Contact', href: '/contact', desc: 'Talk to the right team, fast.' },
    ],
  },
];

// Footer columns.
export const FOOTER_NAV: NavGroup[] = [
  {
    label: 'Platform',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'For customers', href: '/for-customers' },
      { label: 'For creators', href: '/for-creators' },
      { label: 'Communities', href: '/communities' },
    ],
  },
  {
    label: 'Fleet',
    links: [
      { label: 'Become a partner', href: '/fleet' },
      { label: 'Partner types', href: '/fleet/partner-types' },
      { label: 'Apply now', href: '/fleet/apply' },
      { label: 'Partner kit', href: '/fleet/resources' },
    ],
  },
  {
    label: 'Developers',
    links: [
      { label: 'Platform overview', href: '/developers' },
      { label: 'Order Assignment API', href: '/developers/order-assignment' },
      { label: 'Tracking API', href: '/developers/tracking' },
      { label: 'Webhooks', href: '/developers/webhooks' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Stories', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

export const LEGAL_NAV: NavLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Data deletion', href: '/data-deletion' },
];
