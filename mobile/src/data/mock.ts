// Mock data mirroring the prototype — used until real cooks/dishes are seeded via backend.

export interface MockDish {
  id: string;
  title: string;
  description: string;
  cookNote?: string;
  price: number;
  slotsLeft: number;
  totalSlots: number;
  allergens?: string[];
  photoTint: string;
  photoLabel: string;
  sides?: { name: string; optional: boolean; included: boolean }[];
  note?: string;
  tint?: string;
}

export interface MockCook {
  id: string;
  username: string;
  name: string;
  initial: string;
  pronouns: 'she_her' | 'he_him' | 'they_them';
  avatarBg: string;
  distance: string;
  area: string;
  cookingSince: string;
  openHours: string;
  status: 'cooking-now' | 'prepping' | 'done';
  statusLabel: string;
  closesAt?: string;
  followers: number;
  repeatRate: number;
  totalOrders: number;
  avgRating: number;
  activeDiscount?: { type: string; label: string };
  bio?: string;
  storefrontTitle?: string;
  credentials?: string[];
  healthKitchen?: boolean;
  todayDish: MockDish;
  menu?: MockDish[];
  weekly?: { day: string; date: number; items: number; rest?: boolean }[];
}

export const MOCK_COOKS: MockCook[] = [
  {
    id: 'dami',
    username: 'chefdami',
    name: 'Chef Dami',
    initial: 'D',
    pronouns: 'she_her',
    avatarBg: '#B36A2E',
    distance: '2.3 km',
    area: 'Lekki Phase 1',
    cookingSince: 'cooking since 2021',
    openHours: 'Open 7am – 9pm',
    status: 'cooking-now',
    statusLabel: 'Taking orders now',
    closesAt: 'Closes at 9pm',
    followers: 1204,
    repeatRate: 89,
    totalOrders: 489,
    avgRating: 4.9,
    activeDiscount: { type: 'general_pct', label: '15% off this week' },
    bio: "Trained at École Lenôtre, raised on my grandmother's pot. I cook the way I was taught — slow, on firewood when I can, no shortcuts.",
    storefrontTitle: "Dami's table",
    credentials: ['NAFDAC', 'Trained chef', 'NIN verified'],
    weekly: [
      { day: 'Mon', date: 18, items: 2 },
      { day: 'Tue', date: 19, items: 3 },
      { day: 'Wed', date: 20, items: 0, rest: true },
      { day: 'Thu', date: 21, items: 4 },
      { day: 'Fri', date: 22, items: 3 },
      { day: 'Sat', date: 23, items: 5 },
      { day: 'Sun', date: 24, items: 2 },
    ],
    todayDish: {
      id: 'jollof',
      title: 'Smoky party jollof, grilled croaker',
      description: "West African firewood style — slow-smoked, finished with mama's pepper sauce. Comes with sweet plantains.",
      cookNote: "I only do this on Saturdays. I start the firewood at 11.",
      price: 7500,
      slotsLeft: 4,
      totalSlots: 12,
      allergens: ['fish', 'capsicum'],
      photoTint: '#C97A35',
      photoLabel: 'Jollof',
      sides: [
        { name: 'Sweet plantain', optional: true, included: true },
        { name: 'Pepper sauce (extra)', optional: true, included: true },
        { name: 'Coleslaw', optional: true, included: false },
      ],
    },
    menu: [
      { id: 'jollof', title: 'Smoky party jollof, grilled croaker', note: 'Saturdays only', price: 7500, slotsLeft: 4, totalSlots: 12, tint: '#C97A35', photoTint: '#C97A35', photoLabel: 'Jollof', description: "West African firewood style." },
      { id: 'efo',    title: 'Efo riro with assorted',               note: "Tomorrow's lunch",  price: 6200, slotsLeft: 7, totalSlots: 15, tint: '#5C7A2A', photoTint: '#5C7A2A', photoLabel: 'Efo riro', description: "Rich Yoruba stew." },
      { id: 'asun',   title: 'Asun, peppered & smoky',                note: 'For sharing',       price: 4800, slotsLeft: 9, totalSlots: 20, tint: '#9C3A1F', photoTint: '#9C3A1F', photoLabel: 'Asun', description: "Smoky peppered goat." },
      { id: 'plntn',  title: 'Plantain & egg breakfast bowl',         note: 'Sunday mornings',   price: 3200, slotsLeft: 10, totalSlots: 15, tint: '#D9A55C', photoTint: '#D9A55C', photoLabel: 'Plantain bowl', description: "Weekend breakfast." },
      { id: 'pep',    title: 'Pepper soup, goat or fish',              note: 'Friday nights',     price: 5500, slotsLeft: 6, totalSlots: 12, tint: '#A8421C', photoTint: '#A8421C', photoLabel: 'Pepper soup', description: "Warming and deep." },
    ],
  },
  {
    id: 'bisi',
    username: 'mamabisi',
    name: 'Mama Bisi',
    initial: 'B',
    pronouns: 'she_her',
    avatarBg: '#7E4A1F',
    distance: '4.1 km',
    area: 'Ikeja GRA',
    cookingSince: 'cooking since 1996',
    openHours: 'Open 11am – 8pm',
    status: 'prepping',
    statusLabel: 'Prepping for 6pm',
    followers: 2840,
    repeatRate: 92,
    totalOrders: 198,
    avgRating: 5.0,
    credentials: ['NIN verified', 'NAFDAC in progress'],
    todayDish: {
      id: 'egusi',
      title: 'Egusi & pounded yam',
      description: "Pounded by hand. Egusi cooked slow with assorted meat — shaki, kpomo, beef.",
      price: 6200,
      slotsLeft: 2,
      totalSlots: 10,
      photoTint: '#6F8235',
      photoLabel: 'Egusi',
    },
  },
  {
    id: 'ronke',
    username: 'aunty.ronke',
    name: 'Aunty Ronke',
    initial: 'R',
    pronouns: 'she_her',
    avatarBg: '#A35C2E',
    distance: '1.8 km',
    area: 'Victoria Island',
    cookingSince: 'cooking since 2019',
    openHours: 'Open 9am – 7pm',
    status: 'cooking-now',
    statusLabel: 'Taking orders now',
    followers: 612,
    repeatRate: 74,
    totalOrders: 156,
    avgRating: 4.8,
    healthKitchen: true,
    activeDiscount: { type: 'loyalty_pct', label: 'Free delivery on 3rd order' },
    credentials: ['Health Kitchen', 'Nutritionist'],
    todayDish: {
      id: 'zobo',
      title: 'Zobo with pineapple & ginger',
      description: "No sugar. Cold-brewed for 18 hours. Sold in 500ml jars.",
      price: 1800,
      slotsLeft: 14,
      totalSlots: 20,
      photoTint: '#8E2C2C',
      photoLabel: 'Zobo',
    },
  },
  {
    id: 'ada',
    username: 'chefadaeze',
    name: 'Chef Adaeze',
    initial: 'A',
    pronouns: 'she_her',
    avatarBg: '#8A4520',
    distance: '5.6 km',
    area: 'Yaba',
    cookingSince: 'cooking since 2018',
    openHours: 'Open 12pm – 10pm',
    status: 'cooking-now',
    statusLabel: 'Taking orders now',
    followers: 902,
    repeatRate: 71,
    totalOrders: 234,
    avgRating: 4.9,
    credentials: ['NAFDAC', 'Trained chef'],
    todayDish: {
      id: 'nsala',
      title: 'Ofe nsala with catfish',
      description: "White soup, Anambra style. Catfish from Epe, fresh today.",
      price: 8200,
      slotsLeft: 6,
      totalSlots: 10,
      photoTint: '#A78250',
      photoLabel: 'Ofe nsala',
    },
  },
  {
    id: 'tola',
    username: 'tolabakes',
    name: 'Tola Bakes',
    initial: 'T',
    pronouns: 'they_them',
    avatarBg: '#B36A2E',
    distance: '3.2 km',
    area: 'Ikoyi',
    cookingSince: 'cooking since 2022',
    openHours: 'Bakes Sun–Thu',
    status: 'prepping',
    statusLabel: 'Ready tomorrow',
    followers: 318,
    repeatRate: 58,
    totalOrders: 89,
    avgRating: 4.7,
    credentials: ['NAFDAC'],
    todayDish: {
      id: 'chinchin',
      title: 'Coconut chin chin loaf',
      description: "Toasted coconut, browned butter. Each loaf hand-cut. 24h lead time.",
      price: 4800,
      slotsLeft: 8,
      totalSlots: 15,
      photoTint: '#C8995C',
      photoLabel: 'Chin chin',
    },
  },
];

export const DELIVERY_WINDOWS = [
  { id: 'w1', label: '1pm – 2pm',  sub: 'in 2 hours' },
  { id: 'w2', label: '2pm – 3pm',  sub: 'most chosen' },
  { id: 'w3', label: '6pm – 7pm',  sub: 'evening' },
  { id: 'w4', label: '7pm – 8pm',  sub: 'late evening' },
];

export const ORDER_STEPS = [
  { key: 'paid',       label: 'You claimed your portion',  time: '11:42 am' },
  { key: 'confirmed',  label: 'Chef confirmed your order', time: '11:45 am' },
  { key: 'preparing',  label: 'She is cooking',            time: '12:30 pm' },
  { key: 'ready',      label: 'She filmed it for you',     time: '1:18 pm'  },
  { key: 'picked_up',  label: 'A rider has it',            time: '1:24 pm'  },
  { key: 'in_transit', label: "Her pot is on its way",     time: '1:31 pm'  },
  { key: 'delivered',  label: 'At your table',             time: '1:47 pm'  },
];

// Currency formatter — symbol swappable when multi-currency lands
export function nairaFmt(n: number, symbol = '₦') {
  return symbol + n.toLocaleString('en');
}

export function pronouns(cook: MockCook, key: 'subj' | 'obj' | 'poss' | 'cap' | 'table' | 'kitchen') {
  const sets: Record<string, Record<string, string>> = {
    she_her:   { subj: 'she', obj: 'her',  poss: 'her',   cap: 'She',  table: 'her table',   kitchen: 'her kitchen'   },
    he_him:    { subj: 'he',  obj: 'him',  poss: 'his',   cap: 'He',   table: 'his table',   kitchen: 'his kitchen'   },
    they_them: { subj: 'they',obj: 'them', poss: 'their', cap: 'They', table: 'their table', kitchen: 'their kitchen' },
  };
  return sets[cook.pronouns]?.[key] ?? sets.she_her[key];
}
