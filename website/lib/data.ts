// Long-form content shown on the site. Blog posts and job titles are published in English.

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorRole: string;
  iso: string; // publication date; formatted per language at render time
  readMins: number;
  image: string;
  body: string[];
};

export const POSTS: Post[] = [
  {
    slug: 'why-we-are-building-the-creator-food-economy',
    title: 'Why we’re building the creator food economy',
    excerpt:
      'Food is the most universal culture there is. We think the people who make it should be able to build audiences and businesses around it, the way creators do everywhere else.',
    category: 'Vision',
    author: 'FOODSbyme',
    authorRole: 'Founders’ note',
    iso: '2026-06-02',
    readMins: 5,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    body: [
      'For most of the last decade, food apps treated cooking as a commodity. A restaurant uploaded a menu, a customer tapped a button, a rider carried a bag. The person who actually made the food was invisible: interchangeable, unfollowable, forgotten the moment the box was empty.',
      'We think that’s backwards. The most talented cooks are not interchangeable. They have a hand, a story, a signature. People don’t crave ramen, jollof or sourdough in the abstract. They crave a particular cook’s version, the one they would cross town for.',
      'FOODS is built on a simple belief: food is creator content, and creators deserve infrastructure. Audiences, followers, weekly menus, courses, digital products, private dining, community gifting. The same building blocks that let a musician or a writer build a career, applied to the kitchen.',
      'A creator opens a kitchen. People follow. They see what’s cooking today. They crave, they order, they share. Some join the creator’s community and gift meals to others. The best creators earn real, compounding income, not from a race to the bottom on delivery fees, but from a relationship with people who believe in them.',
      'Underneath it runs a delivery network owned by fleet partners: bicycle and motorbike riders, cooperatives and community transport groups who get the technology, brand and order flow to build businesses of their own.',
      'This is not another delivery app. FOODS started in Lagos, where food culture runs deep, and it’s built for kitchens everywhere, in their own language and their own currency.',
    ],
  },
  {
    slug: 'building-a-delivery-network-owned-by-partners',
    title: 'Building a delivery network owned by partners',
    excerpt:
      'Why we chose a partner-owned fleet model, and how a single bike owner can grow into a territory operator on FOODS.',
    category: 'Fleet',
    author: 'FOODSbyme',
    authorRole: 'Operations',
    iso: '2026-05-09',
    readMins: 4,
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    body: [
      'Delivery is the hardest, most capital-intensive part of food logistics. The instinct of most platforms is to own it outright or to treat riders as disposable gig labour. We took a different path: a network owned by partners.',
      'On FOODS, the bikes and the businesses around them belong to local entrepreneurs. We provide the technology (order assignment, live tracking, settlement, analytics) and the brand and training. Partners provide the riders, the local knowledge and the ambition.',
      'A single bike owner starts by accepting orders in their area. As they prove reliability, they unlock more volume, then the ability to add riders, then a defined territory. The model is built so that one motorcycle can grow into a fleet.',
      'This is deliberately a wealth-creation model, not a gig model. The economy we’re building only works if the people moving the food are building equity too.',
    ],
  },
];

export type Job = {
  title: string;
  team: string;
  location: string;
  type: string;
};

export const JOBS: Job[] = [
  { title: 'Senior Product Designer', team: 'Design', location: 'Lagos / Remote', type: 'Full-time' },
  { title: 'Staff Engineer, Marketplace', team: 'Engineering', location: 'Lagos / Remote', type: 'Full-time' },
  { title: 'Creator Partnerships Lead', team: 'Growth', location: 'Lagos', type: 'Full-time' },
  { title: 'Fleet Operations Manager', team: 'Operations', location: 'Lagos', type: 'Full-time' },
  { title: 'Community Manager', team: 'Community', location: 'Lagos / Hybrid', type: 'Full-time' },
  { title: 'Data Scientist, Logistics', team: 'Data', location: 'Remote', type: 'Full-time' },
];
