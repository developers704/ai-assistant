export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  companyDescription: string;
  timezone: string;
  communicationStyle: "formal" | "professional" | "casual";
  priorities: string[];
  preferences: {
    confirmBeforeSend: boolean;
    confirmBeforeCall: boolean;
    confirmBeforeMeeting: boolean;
    dailyBriefingTime: string;
    voiceEnabled: boolean;
    /** SIM dialer vs magicApp for international calls (India, Pakistan, etc.) */
    defaultCallApp: "sim" | "magicapp";
  };
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  isImportant: boolean;
}

export interface StoreLocation {
  id: string;
  city: string;
  state: string;
  mall: string;
  region: "California" | "Nevada" | "Arizona" | "Texas";
  status: "open" | "opening_soon";
  storeManager?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  recurring?: "daily" | "weekly" | "monthly" | null;
  recurringDay?: number;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: string[];
  status: "confirmed" | "tentative" | "cancelled";
  reminders?: number[];
}

export interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  /** Original HTML part when Gmail provides text/html (rendered safely in the UI). */
  bodyHtml?: string;
  receivedAt: string;
  isImportant: boolean;
  isRead: boolean;
  needsReply: boolean;
  category: "urgent" | "important" | "normal" | "promotional";
}

export interface WhatsAppMessage {
  id: string;
  contactId: string;
  contactName: string;
  content: string;
  direction: "incoming" | "outgoing";
  status: "draft" | "pending_confirmation" | "sent" | "scheduled";
  scheduledFor?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  type: "pdf" | "excel" | "csv" | "word" | "powerpoint" | "image" | "other";
  size: number;
  uploadedAt: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
}

export type ProductCategory = "Rings" | "Bands" | "Earrings" | "Necklaces" | "Bracelets";

export type ProductBrand =
  | "Ovani"
  | "Bella by Ovani"
  | "Novello"
  | "Link N Lock"
  | "Diani Bridal"
  | "Aanika V."
  | "Ovaris";

export interface Product {
  id: string;
  name: string;
  brand: ProductBrand;
  category: ProductCategory;
  price: number;
  caratWeight?: string;
  isNew?: boolean;
  isTrending?: boolean;
  description?: string;
}

export interface CustomerReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
}

export interface SalesData {
  date: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface SalesSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  comparisonPreviousDay: number;
  comparisonPreviousWeek: number;
  topStores: { name: string; revenue: number; change: number }[];
  topProducts: { name: string; itemNumber?: string; revenue: number; units: number }[];
  underperformingStores: { name: string; revenue: number; change: number }[];
  recommendations: string[];
}

export interface ImageAnalysis {
  id: string;
  name: string;
  uploadedAt: string;
  description: string;
  extractedText?: string;
  insights: string[];
  actionItems?: string[];
}

export interface CallLog {
  id: string;
  contactName: string;
  contactPhone: string;
  purpose: string;
  status: "draft" | "pending_confirmation" | "completed" | "missed";
  notes?: string;
  followUpTaskId?: string;
  createdAt: string;
}

export interface PendingAction {
  id: string;
  type: "email" | "whatsapp" | "call" | "meeting_create" | "meeting_update" | "meeting_cancel" | "document_share";
  title: string;
  preview: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  pendingAction?: PendingAction;
  attachments?: { name: string; type: string }[];
  imageUrl?: string;
}

export interface AIAction {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

export interface GoogleIntegration {
  connected: boolean;
  email?: string;
  syncError?: string;
}

export interface PlaidIntegration {
  connected: boolean;
  configured: boolean;
  institutionName?: string;
  connectedAt?: string;
  env?: string;
}

export interface AppIntegrations {
  google: GoogleIntegration;
  plaid?: PlaidIntegration;
  llm?: { configured: boolean; mode: "hybrid" | "rules" };
  rag?: { available: boolean; chunks: number; faqs: number };
  news?: { configured: boolean };
}

export interface PortfolioSnapshot {
  totalValue: number;
  institutionName?: string;
  accounts: { id: string; name: string; type: string; subtype?: string; balance: number }[];
  holdings: {
    securityName: string;
    ticker?: string;
    value: number;
    quantity: number;
    price: number;
    accountName: string;
  }[];
  lastUpdated: string;
}

export interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  reminders: Reminder[];
  events: CalendarEvent[];
  emails: Email[];
  contacts: Contact[];
  documents: Document[];
  whatsappMessages: WhatsAppMessage[];
  callLogs: CallLog[];
  pendingActions: PendingAction[];
  chatHistory: ChatMessage[];
  recentActions: AIAction[];
  imageAnalyses: ImageAnalysis[];
  integrations?: AppIntegrations;
  portfolio?: PortfolioSnapshot;
  voiceLastImage?: { prompt: string; src: string; createdAt: string };
}

export type IntentType =
  | "greeting"
  | "daily_briefing"
  | "sales_report"
  | "schedule_meeting"
  | "email_summary"
  | "email_draft"
  | "whatsapp_draft"
  | "reminder_create"
  | "reminder_list"
  | "calendar_today"
  | "document_summarize"
  | "image_analyze"
  | "call_prepare"
  | "task_complete"
  | "task_delete"
  | "confirm_action"
  | "reject_action"
  | "acknowledgment"
  | "portfolio_summary"
  | "store_list"
  | "image_generate"
  | "general"
  | "help";

export interface AIResponse {
  message: string;
  intent: IntentType;
  pendingAction?: PendingAction;
  data?: Record<string, unknown>;
  speak?: boolean;
}
