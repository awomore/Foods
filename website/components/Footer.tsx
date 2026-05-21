export default function Footer() {
  return (
    <footer className="bg-ink text-white/50 py-12">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-white/10">
          <div>
            <p className="font-serif text-xl text-white font-bold mb-1">FOODSbyme</p>
            <p className="text-sm">Home-cooked meals from your neighbourhood</p>
          </div>

          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-white font-semibold mb-3">Product</p>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#for-cooks" className="hover:text-white transition-colors">For cooks</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Company</p>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Legal</p>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Privacy policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of service</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} FOODSbyme. All rights reserved.</p>
          <p>Made with ❤️ in Lagos, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
