// FOODSbyme — mock data. Five cooks. Dami is the hero we open.
// Every name, dish, and quote is intentional: editorial-feeling Lagos cooks.

const COOKS = [
  {
    id: 'dami',
    username: 'chefdami',
    name: 'Chef Dami',
    initial: 'D',
    pronouns: 'she_her',
    avatarBg: '#B36A2E',   // Spice
    distance: '2.3 km',
    area: 'Lekki Phase 1',
    cookingSince: 'cooking since 2021',
    openHours: 'Open 7am – 9pm',
    status: 'cooking-now',   // cooking-now | prepping | done
    statusLabel: 'Taking orders now',
    closesAt: 'Closes at 9pm',
    followers: 1204,
    talking: 47,
    repeatRate: 89,
    totalOrders: 489,
    avgRating: 4.9,
    activeDiscount: { type: 'general_pct', label: '15% off this week' },
    bio: "Trained at École Lenôtre, raised on my grandmother's pot. I cook the way I was taught — slow, on firewood when I can, no shortcuts.",
    storefrontTitle: "Dami's table",
    credentials: ['NAFDAC', 'Trained chef', 'NIN verified'],
    instagram: 'chefdami.lagos',
    tiktok: 'chefdami',
    todayDish: {
      id: 'jollof',
      title: 'Smoky party jollof, grilled croaker',
      description: "Old Lagos style — smoked on firewood, finished with mama's pepper sauce. Comes with sweet plantains.",
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
    weekly: [
      { day: 'Mon', date: 18, items: 2 },
      { day: 'Tue', date: 19, items: 3 },
      { day: 'Wed', date: 20, items: 0, rest: true },
      { day: 'Thu', date: 21, items: 4 },
      { day: 'Fri', date: 22, items: 3 },
      { day: 'Sat', date: 23, items: 5 },
      { day: 'Sun', date: 24, items: 2 },
    ],
    menu: [
      { id: 'jollof', title: 'Smoky party jollof, grilled croaker', note: 'Saturdays only', price: 7500, slotsLeft: 4, tint: '#C97A35' },
      { id: 'efo',    title: 'Efo riro with assorted',               note: "Tomorrow's lunch",  price: 6200, slotsLeft: 7, tint: '#5C7A2A' },
      { id: 'asun',   title: 'Asun, peppered & smoky',                note: 'For sharing',       price: 4800, slotsLeft: 9, tint: '#9C3A1F' },
      { id: 'plntn',  title: 'Plantain & egg breakfast bowl',         note: 'Sunday mornings',   price: 3200, slotsLeft: 10, tint: '#D9A55C' },
      { id: 'pep',    title: 'Pepper soup, goat or fish',              note: 'Friday nights',     price: 5500, slotsLeft: 6, tint: '#A8421C' },
    ],
    reviews: [
      { name: 'Tomi A.', n: 6, rating: 5, body: 'I have ordered from Dami six times. It tastes the same every time. The packaging is beautiful — she writes a small note on the side.', verified: true },
      { name: 'Yemi O.', n: 3, rating: 5, body: 'The smoke on the jollof. I do not know how she does it on a Lagos balcony but she does.', verified: true },
      { name: 'Ada N.',  n: 2, rating: 5, body: "I cried a little. It tasted like my mother's.", verified: true },
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
    talking: 64,
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
    talking: 22,
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
    talking: 31,
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
    talking: 9,
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

const FOODS_PICKS = [
  { category: 'Cook of the week', headline: 'The woman who smokes jollof on a Lagos balcony', cookId: 'dami', tint: '#C97A35' },
  { category: 'Dish of the week', headline: "Aunty Ronke's 18-hour zobo", cookId: 'ronke', tint: '#8E2C2C' },
  { category: 'Health Kitchen', headline: 'Three cooks the nutritionists co-sign', cookId: 'ronke', tint: '#3B6647' },
];

const CHOP_TALK = [
  { name: 'Chisom O.', initial: 'C', avatarBg: '#7E4A1F', orders: 8, when: '2 days ago',
    body: 'The ofada rice hit different this week. She added more iru and I could taste it. Week 3 in a row ordering this.',
    replies: 4, cookReplied: true, pinned: true },
  { name: 'Funmi A.', initial: 'F', avatarBg: '#A35C2E', orders: 11, when: '4 days ago',
    body: 'Eleventh order. The note she leaves on the side of the pack is the best part of my Saturday.',
    replies: 2, milestone: true },
  { name: 'Kunle B.', initial: 'K', avatarBg: '#8A4520', orders: 3, when: '1 week ago',
    body: 'I asked her to leave out the pepper for my mum and she did. The whole portion. That is care.',
    replies: 1 },
];

function P(cook, key) {
  const sets = {
    she_her:   { subj: 'she', obj: 'her', poss: 'her', possPron: 'hers', table: 'her table', kitchen: 'her kitchen', cap: 'She' },
    he_him:    { subj: 'he',  obj: 'him', poss: 'his', possPron: 'his',  table: 'his table', kitchen: 'his kitchen', cap: 'He' },
    they_them: { subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', table: 'their table', kitchen: 'their kitchen', cap: 'They' },
  };
  return sets[cook?.pronouns || 'she_her'][key];
}

const DELIVERY_WINDOWS = [
  { id: 'w1', label: '1pm – 2pm', sub: 'in 2 hours' },
  { id: 'w2', label: '2pm – 3pm', sub: 'most chosen' },
  { id: 'w3', label: '6pm – 7pm', sub: 'evening' },
  { id: 'w4', label: '7pm – 8pm', sub: 'late evening' },
];

const CUSTOMER = {
  firstName: 'Tomi',
  area: 'Lekki Phase 1',
  address: '14B Admiralty Way, Lekki Phase 1',
  allergens: ['shellfish', 'peanuts'],
};

const TRAY_SEED = [
  { cookId: 'dami', dishId: 'jollof', qty: 1, window: 'Saturday 2–3pm', address: 'Home', price: 7500 },
];

function nairaFmt(n) { return '₦' + n.toLocaleString('en-NG'); }

const ORDER_STEPS = [
  { key: 'paid',       label: 'You claimed your portion',    time: '11:42 am' },
  { key: 'confirmed',  label: 'Chef Dami confirmed',          time: '11:45 am' },
  { key: 'preparing',  label: 'She is cooking',               time: '12:30 pm' },
  { key: 'ready',      label: 'She filmed it for you',         time: '1:18 pm'  },
  { key: 'picked_up',  label: 'A rider has it',                time: '1:24 pm'  },
  { key: 'in_transit', label: 'Her pot is on its way',         time: '1:31 pm'  },
  { key: 'delivered',  label: 'At your table',                 time: '1:47 pm'  },
];

Object.assign(window, {
  COOKS, FOODS_PICKS, DELIVERY_WINDOWS, CUSTOMER, ORDER_STEPS, CHOP_TALK, TRAY_SEED, P, nairaFmt,
});
