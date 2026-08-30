export type Role = 'admin' | 'cheesemonger' | 'turophile';

export type Cheese = {
  id: string;
  name: string;
  creamery: string;
  location: string;
  milkType: string;
  rennet: string;
  style: string;
  category: string;
  age: string;
  flavorProfile: string[];
  story: string;
  pairings: string[];
  rating: number;
  logs: number;
  color: string;
  createdAt: string;
  inCurdNerdCase: boolean;
  imageUrl?: string;
};

export type Post = {
  id: string;
  user: string;
  handle: string;
  initials: string;
  role: Role;
  userId?: string;
  cheeseId: string;
  rating: number;
  note: string;
  place: string;
  time: string;
  likes: number;
  comments: number;
  photoUrl?: string;
  photoPending?: boolean;
  avatarUrl?: string;
};
