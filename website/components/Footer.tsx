const navGroups = [
  {
    label: 'Platform',
    links: [
      { label: 'Discover cooks', href: '#featured-cooks' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'For cooks', href: '#why-exists' },
      { label: 'Trust & safety', href: '#trust' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
    ],
  },
  {
    label: 'Support',
    links: [
      { label: 'Help centre', href: '/support' },
      { label: 'hello@foodsbyme.com', href: 'mailto:hello@foodsbyme.com' },
      { label: 'support@foodsbyme.com', href: 'mailto:support@foodsbyme.com' },
      { label: '+234 807 235 0602', href: 'tel:+2348072350602' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Privacy policy', href: '#' },
      { label: 'Terms of service', href: '#' },
      { label: 'Cookie policy', href: '#' },
    ],
  },
];

const socialLinks = [
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
  },
  {
    label: 'Twitter / X',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.83a8.23 8.23 0 0 0 4.81 1.53V6.89a4.85 4.85 0 0 1-1.04-.2z"/>
      </svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-cream">
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-16">
          {/* Brand column */}
          <div className="md:col-span-1">
            <a href="/" className="font-serif text-xl text-cream font-semibold tracking-tight block mb-4">
              FOODSbyme
            </a>
            <p className="text-cream/40 text-sm leading-relaxed font-light mb-6 max-w-[14rem]">
              A premium discovery platform for home cooks and the communities that love them.
            </p>
            {/* Social links */}
            <div className="mb-5">
              <p className="text-cream/25 text-[11px] font-light leading-relaxed">
                42, Oba Yekini Elegushi Rd,<br />Lagos, Nigeria
              </p>
            </div>
            <div className="flex gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-8 h-8 rounded-full border border-cream/15 flex items-center justify-center text-cream/40 hover:text-cream hover:border-cream/30 transition-all duration-200"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav groups */}
          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-cream/30 text-[10px] font-semibold uppercase tracking-[0.18em] mb-4">
                  {group.label}
                </p>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-cream/50 text-[13px] hover:text-cream transition-colors duration-200 font-light"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-cream/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-cream/25 text-xs font-light">
            &copy; {year} FOODSbyme. All rights reserved.
          </p>
          <p className="text-cream/20 text-xs font-light">
            Made with care in Lagos, Nigeria
          </p>
        </div>
      </div>
    </footer>
  );
}
