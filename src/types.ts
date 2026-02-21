export interface DamageRecord {
  personeelsnr: string;
  naam: string;
  locatie: string;
  datum: string;
  link: string;
  type: string; // This is the vehicle category (Standaard, etc.)
  damageType: string; // This is the damage description
  bus_tram: string; // This is the mode (Bus or Tram)
  rawData: any;
}

export interface DashboardStats {
  totalIncidents: number;
  byType: { name: string; value: number }[];
  byVehicle: { name: string; value: number }[];
  byLocation: { name: string; value: number }[];
}
