// Single source of truth for site-wide config and navigation structure.
// All visible wording comes from the dictionaries in /messages.

import type { Dict } from './i18n/dict';

export const SITE = {
  name: 'FOODSbyme',
  legalName: 'FOODSbyme Technologies',
  domain: 'foodsbyme.com',
  url: 'https://foodsbyme.com',
  email: {
    hello: 'hello@foodsbyme.com',
    support: 'support@foodsbyme.com',
    partnerships: 'partnerships@foodsbyme.com',
    press: 'press@foodsbyme.com',
    careers: 'careers@foodsbyme.com',
    creators: 'creators@foodsbyme.com',
    privacy: 'privacy@foodsbyme.com',
  },
  // Registered office. Shown on Contact and the legal pages only.
  phone: { display: '+234 807 235 0602', href: 'tel:+2348072350602' },
  address: { street: '42, Oba Yekini Elegushi Rd', city: 'Lagos', country: 'Nigeria' },
  social: {
    instagram: 'https://instagram.com/foodsbyme_ig',
    twitter: 'https://x.com/foodsbyme_x',
    tiktok: 'https://tiktok.com/@foodsbyme_tiktok',
    linkedin: 'https://linkedin.com/company/foodsbyme',
  },
  // The production API. Shared-link pages read public cook profiles from it.
  api: 'https://foodsbyme-api-production.up.railway.app/api',
  app: {
    ios: 'https://apps.apple.com/app/foodsbyme',
    android: 'https://play.google.com/store/apps/details?id=com.foodsbyme.app',
  },
} as const;

export type NavLink = { label: string; href: string; desc?: string };
export type NavGroup = { label: string; href?: string; links?: NavLink[] };

/** Header navigation. Hrefs are language-neutral; components prefix the language. */
export function primaryNav(n: Dict['common']['nav']): NavGroup[] {
  return [
    {
      label: n.discover,
      links: [
        { label: n.howItWorks, href: '/how-it-works', desc: n.howItWorksDesc },
        { label: n.forCustomers, href: '/for-customers', desc: n.forCustomersDesc },
        { label: n.communities, href: '/communities', desc: n.communitiesDesc },
        { label: n.stories, href: '/blog', desc: n.storiesDesc },
      ],
    },
    { label: n.forCreators, href: '/for-creators' },
    {
      label: n.fleet,
      links: [
        { label: n.becomePartner, href: '/fleet', desc: n.becomePartnerDesc },
        { label: n.partnerTypes, href: '/fleet/partner-types', desc: n.partnerTypesDesc },
        { label: n.apply, href: '/fleet/apply', desc: n.applyDesc },
        { label: n.partnerKit, href: '/fleet/resources', desc: n.partnerKitDesc },
      ],
    },
    {
      label: n.developers,
      links: [
        { label: n.platformOverview, href: '/developers', desc: n.platformOverviewDesc },
        { label: n.orderApi, href: '/developers/order-assignment', desc: n.orderApiDesc },
        { label: n.trackingApi, href: '/developers/tracking', desc: n.trackingApiDesc },
        { label: n.webhooks, href: '/developers/webhooks', desc: n.webhooksDesc },
      ],
    },
    {
      label: n.company,
      links: [
        { label: n.about, href: '/about', desc: n.aboutDesc },
        { label: n.careers, href: '/careers', desc: n.careersDesc },
        { label: n.press, href: '/press', desc: n.pressDesc },
        { label: n.contact, href: '/contact', desc: n.contactDesc },
      ],
    },
  ];
}

export function footerNav(c: Dict['common']): NavGroup[] {
  const n = c.nav;
  const f = c.footer;
  return [
    {
      label: f.platform,
      links: [
        { label: n.howItWorks, href: '/how-it-works' },
        { label: n.forCustomers, href: '/for-customers' },
        { label: n.forCreators, href: '/for-creators' },
        { label: n.communities, href: '/communities' },
        { label: n.support, href: '/support' },
      ],
    },
    {
      label: f.partners,
      links: [
        { label: n.becomePartner, href: '/fleet' },
        { label: n.partnerTypes, href: '/fleet/partner-types' },
        { label: n.apply, href: '/fleet/apply' },
        { label: n.partnerKit, href: '/fleet/resources' },
      ],
    },
    {
      label: f.developers,
      links: [
        { label: f.overview, href: '/developers' },
        { label: n.orderApi, href: '/developers/order-assignment' },
        { label: n.trackingApi, href: '/developers/tracking' },
        { label: n.webhooks, href: '/developers/webhooks' },
      ],
    },
    {
      label: f.company,
      links: [
        { label: n.about, href: '/about' },
        { label: n.stories, href: '/blog' },
        { label: n.careers, href: '/careers' },
        { label: n.press, href: '/press' },
        { label: n.contact, href: '/contact' },
      ],
    },
  ];
}

export function legalNav(l: Dict['common']['legalNav']): NavLink[] {
  return [
    { label: l.privacy, href: '/privacy' },
    { label: l.terms, href: '/terms' },
    { label: l.refunds, href: '/refund-policy' },
    { label: l.dataDeletion, href: '/data-deletion' },
    { label: l.imprint, href: '/imprint' },
  ];
}
