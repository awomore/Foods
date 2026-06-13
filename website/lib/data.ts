// Shared content used across the site. Real, written content — no lorem ipsum.

export type Creator = {
  name: string;
  handle: string;
  kitchen: string;
  city: string;
  specialty: string;
  followers: string;
  rating: number;
  tags: string[];
  image: string;
  avatar: string;
};

export const CREATORS: Creator[] = [
  {
    name: 'Titilayo Adeyemi',
    handle: '@mamatiti',
    kitchen: "Mama Titi's Kitchen",
    city: 'Lekki, Lagos',
    specialty: 'Smoky party jollof & peppered snails',
    followers: '24.1k',
    rating: 4.9,
    tags: ['Jollof', 'Egusi', 'Pepper soup'],
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Chuka Obi',
    handle: '@chukaeats',
    kitchen: 'The Suya Lab',
    city: 'Yaba, Lagos',
    specialty: 'Charcoal suya flights & yaji blends',
    followers: '18.7k',
    rating: 4.8,
    tags: ['Suya', 'Asun', 'Grills'],
    image: 'https://images.unsplash.com/photo-1633321088355-d0f81134ca3b?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Amara Nwosu',
    handle: '@amarabakes',
    kitchen: 'Flour & Honey',
    city: 'Ikoyi, Lagos',
    specialty: 'Brown-butter banana bread & celebration cakes',
    followers: '31.4k',
    rating: 5.0,
    tags: ['Pastry', 'Cakes', 'Bread'],
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Ifeoma Eze',
    handle: '@chefify',
    kitchen: 'Private dining by Ife',
    city: 'Victoria Island, Lagos',
    specialty: 'Modern West-African tasting menus',
    followers: '12.9k',
    rating: 4.9,
    tags: ['Private chef', 'Tasting menu', 'Events'],
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Bisi Akande',
    handle: '@bisiskitchen',
    kitchen: 'Soup Republic',
    city: 'Surulere, Lagos',
    specialty: 'Slow-cooked native soups & swallow',
    followers: '9.3k',
    rating: 4.8,
    tags: ['Banga', 'Oha', 'Ofada'],
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Tomi Lawson',
    handle: '@smalltomi',
    kitchen: 'Small Chops Society',
    city: 'Ajah, Lagos',
    specialty: 'Premium small chops & grazing boxes',
    followers: '27.6k',
    rating: 4.9,
    tags: ['Small chops', 'Grazing', 'Events'],
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=80',
    avatar: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=200&q=80',
  },
];

export type Stat = { value: number; suffix?: string; prefix?: string; decimals?: number; label: string };

export const PLATFORM_STATS: Stat[] = [
  { value: 4200, suffix: '+', label: 'Food creators earning' },
  { value: 1.2, suffix: 'M', prefix: '₦', decimals: 1, label: 'Avg. top-creator monthly revenue' },
  { value: 380, suffix: 'k+', label: 'Community members' },
  { value: 96, suffix: '%', label: 'Orders delivered on time' },
];

export type Testimonial = { quote: string; name: string; role: string; avatar: string };

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I started posting what I cooked on Sundays. Eight months later FOODS is my full-time income — I have regulars who plan their week around my menu.',
    name: 'Titilayo Adeyemi',
    role: "Mama Titi's Kitchen · 24k followers",
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  },
  {
    quote:
      'It doesn’t feel like ordering food. It feels like following someone you believe in, and getting to taste what they make.',
    name: 'Daniel Okafor',
    role: 'Customer · Lagos',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  },
  {
    quote:
      'Three bikes became a nine-rider fleet in one territory. The app routes the orders, handles settlement, and I focus on my riders.',
    name: 'Samuel Adebayo',
    role: 'Fleet partner · Ikeja territory',
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=160&q=80',
  },
];

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorRole: string;
  date: string; // dd/mm/yyyy displayed; ISO stored
  iso: string;
  readMins: number;
  image: string;
  body: string[];
};

export const POSTS: Post[] = [
  {
    slug: 'why-we-are-building-the-creator-food-economy',
    title: 'Why we’re building the creator food economy',
    excerpt:
      'Food is the most universal form of culture in Africa. We think the people who make it should be able to build audiences and businesses around it — the way creators do everywhere else.',
    category: 'Vision',
    author: 'FOODSbyme',
    authorRole: 'Founders’ note',
    date: '02/06/2026',
    iso: '2026-06-02',
    readMins: 6,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    body: [
      'For most of the last decade, food apps treated cooking as a commodity. A restaurant uploaded a menu, a customer tapped a button, a rider carried a bag. The person who actually made the food was invisible — interchangeable, unfollowable, forgotten the moment the box was empty.',
      'We think that’s backwards. The most talented cooks in Lagos, Accra, and Nairobi are not interchangeable. They have a hand, a story, a signature. People don’t crave “jollof” in the abstract — they crave Mama Titi’s smoky party jollof, the one with the right amount of char.',
      'FOODS is built on a simple belief: food is creator content, and creators deserve infrastructure. Audiences, followers, weekly menus, courses, digital products, private dining, community gifting — the same building blocks that let a musician or a writer build a career, applied to the kitchen.',
      'A creator opens a kitchen. People follow. They see what’s cooking today. They crave, they order, they share. Some join the creator’s community and gift meals to others. The best creators earn real, compounding income — not from a race to the bottom on delivery fees, but from a relationship with people who believe in them.',
      'Underneath it runs a delivery network owned by thousands of fleet partners — bike owners, cooperatives, logistics companies — who get the technology, brand, and order flow to build real businesses of their own.',
      'This is not another delivery app. It’s the digital headquarters of a new food economy, and it’s being built in Africa first because this is where food culture is richest and the opportunity is largest.',
    ],
  },
  {
    slug: 'how-mama-titi-turned-sunday-cooking-into-a-business',
    title: 'How Mama Titi turned Sunday cooking into a business',
    excerpt:
      'A weekly menu, a few hundred followers, and a refusal to compromise on her pepper game. Inside one creator’s path to full-time income.',
    category: 'Creator stories',
    author: 'Zainab Bello',
    authorRole: 'Editorial',
    date: '21/05/2026',
    iso: '2026-05-21',
    readMins: 5,
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80',
    body: [
      'Titilayo Adeyemi never planned to run a food business. She cooked for her family on Sundays and, on a friend’s nudge, started posting photos of what she made.',
      'The first week, eleven people followed her kitchen. The next, forty. Within two months she published her first weekly menu on FOODS — a fixed Sunday drop of party jollof, peppered snails, and pepper soup — and sold out by Saturday night.',
      '“The menu changed everything,” she says. “People could plan around me. They’d message: are snails on this week? It stopped being random orders and became a rhythm.”',
      'Today Mama Titi’s Kitchen has more than 24,000 followers and a waitlist for her festive boxes. She runs a course on the platform teaching her base stew, sells a downloadable spice guide, and caters private dinners booked entirely through her profile.',
      'Her advice to new creators is unglamorous: pick one thing, make it unmistakably yours, and show up every week. “The followers come for consistency. The income comes after the trust.”',
    ],
  },
  {
    slug: 'building-a-delivery-network-owned-by-partners',
    title: 'Building a delivery network owned by partners',
    excerpt:
      'Why we chose a partner-owned fleet model — and how a single bike owner can grow into a territory operator on FOODS.',
    category: 'Fleet',
    author: 'FOODSbyme',
    authorRole: 'Operations',
    date: '09/05/2026',
    iso: '2026-05-09',
    readMins: 7,
    image: 'https://images.unsplash.com/photo-1591768793355-74d04bb6608f?auto=format&fit=crop&w=1200&q=80',
    body: [
      'Delivery is the hardest, most capital-intensive part of food logistics. The instinct of most platforms is to own it outright or to treat riders as disposable gig labour. We took a different path: a network owned by partners.',
      'On FOODS, the bikes and the businesses around them belong to local entrepreneurs. We provide the technology — order assignment, live tracking, settlement, analytics — and the brand and training. Partners provide the riders, the local knowledge, and the ambition.',
      'A single bike owner starts by accepting orders in their area. As they prove reliability, they unlock more volume, then the ability to add riders, then a defined territory. Some of our strongest partners began with one motorcycle and now run double-digit fleets.',
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

export type PressItem = { outlet: string; title: string; date: string; href: string };

export const PRESS_ITEMS: PressItem[] = [
  { outlet: 'TechCabal', title: 'FOODS wants to turn African cooks into creators', date: '28/05/2026', href: '#' },
  { outlet: 'TechCrunch', title: 'The creator economy comes for food, starting in Lagos', date: '14/05/2026', href: '#' },
  { outlet: 'Rest of World', title: 'Inside the partner-owned delivery network powering FOODS', date: '30/04/2026', href: '#' },
  { outlet: 'BusinessDay', title: 'How a Lagos startup is reframing food delivery as creator commerce', date: '12/04/2026', href: '#' },
];
