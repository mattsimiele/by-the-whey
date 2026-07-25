export type Role = 'admin' | 'cheesemonger' | 'turophile';

export type Cheese = {
  id: string;
  name: string;
  creamery: string;
  location: string;
  milkType: string;
  rennet: string;
  style: string;
  age: string;
  flavorProfile: string[];
  story: string;
  pairings: string[];
  rating: number;
  logs: number;
  color: string;
};

export type Post = {
  id: string;
  user: string;
  handle: string;
  initials: string;
  role: Role;
  cheeseId: string;
  rating: number;
  note: string;
  place: string;
  time: string;
  likes: number;
  comments: number;
};

export const cheeses: Cheese[] = [
  {
    id: 'shelburne-2-year',
    name: 'Shelburne 2 Year',
    creamery: 'Shelburne Farms',
    location: 'Shelburne, Vermont',
    milkType: 'Raw cow’s milk',
    rennet: 'Animal',
    style: 'Cheddar',
    age: 'Minimum two years',
    flavorProfile: ['Brothy', 'Caramelized onions', 'Toasted nuts'],
    story: 'Uses a pasture-raised Brown Swiss herd and is processed by hand. A classic Vermont-style cheddar.',
    pairings: ['Granny Smith apples', 'Crisp pears', 'Raw honey', 'Fig spread', 'Sourdough bread', 'Cabernet Sauvignon', 'Merlot', 'Oaked Chardonnay', 'Dry Riesling'],
    rating: 4.7,
    logs: 824,
    color: '#D4A846',
  },
  {
    id: 'harbison',
    name: 'Harbison',
    creamery: 'Jasper Hill Farm',
    location: 'Greensboro, Vermont',
    milkType: 'Pasteurized cow’s milk',
    rennet: 'Microbial',
    style: 'Bloomy rind',
    age: '6–9 weeks',
    flavorProfile: ['Woodsy', 'Custardy', 'Mustard seed'],
    story: 'A spoonable, spruce-wrapped cheese with a silky paste and deep woodland character.',
    pairings: ['Baguette', 'Roasted mushrooms', 'Wildflower honey', 'Saison', 'Light-bodied red wine'],
    rating: 4.7,
    logs: 1284,
    color: '#C8A14D',
  },
  {
    id: 'rogue-river',
    name: 'Rogue River Blue',
    creamery: 'Rogue Creamery',
    location: 'Central Point, Oregon',
    milkType: 'Organic cow’s milk',
    rennet: 'Vegetarian',
    style: 'Blue',
    age: '9–11 months',
    flavorProfile: ['Pear brandy', 'Fig', 'Hazelnut'],
    story: 'A seasonal blue wrapped in Syrah grape leaves, with fruit, spice, and a lingering savory finish.',
    pairings: ['Fresh figs', 'Dark chocolate', 'Walnuts', 'Port', 'Syrah'],
    rating: 4.8,
    logs: 943,
    color: '#7B8795',
  },
  {
    id: 'comte',
    name: 'Comté 24 Month',
    creamery: 'Marcel Petite',
    location: 'Jura, France',
    milkType: 'Raw cow’s milk',
    rennet: 'Animal',
    style: 'Alpine',
    age: '24 months',
    flavorProfile: ['Toasted hazelnut', 'Brown butter', 'Broth'],
    story: 'A long-aged mountain cheese with crystalline texture and layers of roasted, savory flavor.',
    pairings: ['Cornichons', 'Toasted hazelnuts', 'Crusty bread', 'Vin jaune', 'Dry cider'],
    rating: 4.6,
    logs: 2310,
    color: '#D8B869',
  },
  {
    id: 'humboldt',
    name: 'Humboldt Fog',
    creamery: 'Cypress Grove',
    location: 'Arcata, California',
    milkType: 'Pasteurized goat’s milk',
    rennet: 'Microbial',
    style: 'Soft-ripened',
    age: 'Approximately 3 weeks',
    flavorProfile: ['Citrus', 'Cream', 'Fresh herbs'],
    story: 'A bright, creamy goat cheese marked by its dramatic line of vegetable ash.',
    pairings: ['Marcona almonds', 'Apples', 'Honey', 'Sauvignon Blanc', 'Sparkling wine'],
    rating: 4.4,
    logs: 3651,
    color: '#97978F',
  },
  {
    id: 'taleggio',
    name: 'Taleggio',
    creamery: 'Arnoldi',
    location: 'Lombardy, Italy',
    milkType: 'Cow’s milk',
    rennet: 'Animal',
    style: 'Washed rind',
    age: '35–40 days',
    flavorProfile: ['Yeasty', 'Meaty', 'Mushroom'],
    story: 'A fragrant washed-rind classic whose tender paste is milder and fruitier than its aroma suggests.',
    pairings: ['Polenta', 'Mushrooms', 'Pear mostarda', 'Nebbiolo', 'Belgian dubbel'],
    rating: 4.2,
    logs: 1718,
    color: '#D58D69',
  },
];

export const posts: Post[] = [
  {
    id: 'p1',
    user: 'Sophie Laurent',
    handle: '@thebriekeeper',
    initials: 'SL',
    role: 'cheesemonger',
    cheeseId: 'harbison',
    rating: 4.8,
    note: 'Perfectly ripe tonight. Spoon-soft with roasted maitake, warm baguette, and a little wildflower honey.',
    place: 'The Rind Room · Brooklyn',
    time: '18m',
    likes: 42,
    comments: 8,
  },
  {
    id: 'p2',
    user: 'Noah Williams',
    handle: '@curiouscurd',
    initials: 'NW',
    role: 'turophile',
    cheeseId: 'rogue-river',
    rating: 4.9,
    note: 'My first Rogue River Blue. The pear-brandy sweetness is unreal—bold, balanced, and worth the wait.',
    place: 'At home · Philadelphia',
    time: '1h',
    likes: 67,
    comments: 12,
  },
  {
    id: 'p3',
    user: 'Maya Chen',
    handle: '@mayamakesboards',
    initials: 'MC',
    role: 'cheesemonger',
    cheeseId: 'comte',
    rating: 4.6,
    note: 'Those little crystals! Nutty, brothy, and deeply satisfying beside a glass of vin jaune.',
    place: 'June & Rind · Boston',
    time: '3h',
    likes: 31,
    comments: 4,
  },
];
