export type Score = "hot" | "warm" | "cold";
export type Stage = "New" | "Contacted" | "Qualified" | "Appointment" | "Site Visit" | "Closed Won" | "Closed Lost";
export type Source = "Google Ads" | "Facebook" | "Organic" | "Referral";

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  budget: string;
  budgetMin: number;
  budgetMax: number;
  timeline: string;
  score: Score;
  scorePoints: number;
  stage: Stage;
  source: Source;
  aiStatus: "Replied" | "Awaiting" | "No response";
  receivedAt: string;
  preApproved: "Yes" | "No" | "In progress";
  bedrooms: number;
  style: string;
  zip: string;
  living: "Renting" | "Owns";
}

export const leads: Lead[] = [];
export const activityFeed: any[] = [];
export const weeklyVolume: any[] = [];
export const campaigns: any[] = [];
export const aiConversations: any[] = [];
export const appointments: any[] = [];
export const monthlyTrend: any[] = [];
export const leadsBySource: any[] = [];

