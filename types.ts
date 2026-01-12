
export enum Province {
  AB = "Alberta",
  BC = "British Columbia",
  MB = "Manitoba",
  NB = "New Brunswick",
  NL = "Newfoundland and Labrador",
  NS = "Nova Scotia",
  NT = "Northwest Territories",
  NU = "Nunavut",
  ON = "Ontario",
  PE = "Prince Edward Island",
  QC = "Quebec",
  SK = "Saskatchewan",
  YT = "Yukon"
}

export type StoreType = 'Licensed' | 'Aboriginal';

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface OperatingHours {
  day: string;
  time: string;
}

export interface Store {
  id: string;
  name: string;
  type: StoreType;
  province: Province;
  address: string;
  rating?: number;
  featuredOfferings?: string[];
  isClaimed: boolean;
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  sourceUrl?: string;
  reviews?: Review[];
  hours?: OperatingHours[];
}

export interface ServicePackage {
  id: string;
  title: string;
  description: string;
  category: 'Digital' | 'Logistics' | 'Growth';
  icon: string;
}
