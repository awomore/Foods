import { StoreBadge } from './StoreBadge';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white">
      {/* Top CTA strip */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h3 className="font-serif text-2xl md:text-3xl text-white mb-1">Ready to order?</h3>
            <p className="text-white/50 text-sm">Download the app and find a cook near you.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StoreBadge store="apple" variant="outline" />
            <StoreBadge store="google" variant="outline" />
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-1">
          <p className="font-serif text-xl text-white mb-3">FOODSbyme</p>
          <p className="text-white/40 text-sm leading-relaxed">
            Home-cooked meals from your neighbourhood.
          </p>
        </div>

        <div>
          <p className="text-white text-xs font-semibold uppercase tracking-widest mb-4">Product</p>
          <ul className="space-y-3 text-sm text-white/50">
            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            <li><a href="#for-cooks" className="hover:text-white transition-colors">For cooks</a></li>
            <li><a href="#download" className="hover:text-white transition-colors">Download</a></li>
          </ul>
        </div>

        <div>
          <p className="text-white text-xs font-semibold uppercase tracking-widest mb-4">Company</p>
          <ul className="space-y-3 text-sm text-white/50">
            <li><a href="#" className="hover:text-white transition-colors">About</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            <li><a href="mailto:hello@foodsbyme.com" className="hover:text-white transition-colors">hello@foodsbyme.com</a></li>
            <li><a href="mailto:support@foodsbyme.com" className="hover:text-white transition-colors">support@foodsbyme.com</a></li>
          </ul>
        </div>

        <div>
          <p className="text-white text-xs font-semibold uppercase tracking-widest mb-4">Legal</p>
          <ul className="space-y-3 text-sm text-white/50">
            <li><a href="#" className="hover:text-white transition-colors">Privacy policy</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Terms of service</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">&copy; {year} FOODSbyme. All rights reserved.</p>
          <p className="text-white/30 text-xs">Made in Lagos, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
