const REVIEWS = [
  {
    name: 'Adaeze O.',
    role: 'Customer, Lagos',
    text: 'I found Mama Titi through FOODSbyme and she makes the best jollof I\'ve ever had. Better than any restaurant, cheaper too.',
    avatar: 'A',
  },
  {
    name: 'Emeka T.',
    role: 'Home cook, Lekki',
    text: 'I was sceptical at first but I made ₦80k in my first month just cooking what I already make for my family. The app is very easy to use.',
    avatar: 'E',
  },
  {
    name: 'Funmilayo B.',
    role: 'Customer, Ikeja',
    text: 'As someone with a nut allergy, I never felt safe ordering online. The allergen profiles on FOODSbyme changed everything for me.',
    avatar: 'F',
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-14">
          <p className="text-spice text-sm font-semibold uppercase tracking-widest mb-3">Early users</p>
          <h2 className="font-serif text-4xl md:text-5xl text-ink">People love it</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              className="bg-cream rounded-2xl p-6 border border-warm flex flex-col gap-4"
            >
              <p className="text-stone text-sm leading-relaxed flex-1">&ldquo;{r.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-spice text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {r.avatar}
                </div>
                <div>
                  <p className="font-semibold text-ink text-sm">{r.name}</p>
                  <p className="text-stone text-xs">{r.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
