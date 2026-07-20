import type {
  UserProfile,
  Contact,
  StoreLocation,
  Reminder,
  CalendarEvent,
  Email,
  Document,
  SalesData,
  AIAction,
} from "@/types";

export const defaultUser: UserProfile = {
  id: "user-1",
  name: "Kash Valliani",
  email: "kash@vallianijewelers.com",
  role: "Founder & President",
  company: "Valliani Jewelers",
  companyDescription:
    "Leading fine jewelry retailer founded in 1999. Built on four pillars — Value, Vogue, Verve, and Variety — Valliani offers diamonds, gemstones, engagement rings, bridal jewelry, and luxury timepieces across 29 locations. House of Brands includes Ovani, Novello, Link N Lock, Diani Bridal, Aanika V., and Ovaris.",
  timezone: "Asia/Karachi",
  communicationStyle: "professional",
  priorities: [
    "Multi-store sales across 29 locations (27+ in California)",
    "Ovani and Diani Bridal engagement ring growth",
    "Texas expansion — Baybrook & Deerbrook openings",
    "Trending lab-grown diamond and Aanika V. gemstone collections",
    "Customer experience — 4.9/5 rating, 1,250+ reviews",
  ],
  preferences: {
    confirmBeforeSend: true,
    confirmBeforeCall: true,
    confirmBeforeMeeting: true,
    voiceEnabled: true,
    defaultCallApp: "magicapp",
  },
};

export const mockStores: StoreLocation[] = [
  { id: "st01", city: "Roseville", state: "CA", mall: "Westfield Galleria Mall", region: "California", status: "open", storeManager: "David Nguyen" },
  { id: "st02", city: "San Jose", state: "CA", mall: "Eastridge Centre", region: "California", status: "open", storeManager: "Priya Sharma" },
  { id: "st03", city: "San Jose", state: "CA", mall: "Westfield Oakridge", region: "California", status: "open", storeManager: "Michael Torres" },
  { id: "st04", city: "Santa Clara", state: "CA", mall: "Westfield Valley Fair", region: "California", status: "open", storeManager: "Maria Santos" },
  { id: "st05", city: "Milpitas", state: "CA", mall: "Great Mall", region: "California", status: "open", storeManager: "James Liu" },
  { id: "st06", city: "Hayward", state: "CA", mall: "Southland Mall", region: "California", status: "open", storeManager: "Angela Brooks" },
  { id: "st07", city: "Daly City", state: "CA", mall: "Serramonte Center", region: "California", status: "open", storeManager: "Kevin Park" },
  { id: "st08", city: "Livermore", state: "CA", mall: "San Francisco Premium Outlets", region: "California", status: "open", storeManager: "Rachel Kim" },
  { id: "st09", city: "Fairfield", state: "CA", mall: "Solano Town Center", region: "California", status: "open", storeManager: "Tom Bradley" },
  { id: "st10", city: "Santa Rosa", state: "CA", mall: "Santa Rosa Plaza", region: "California", status: "open", storeManager: "Lisa Chen" },
  { id: "st11", city: "Sacramento", state: "CA", mall: "Arden Fair", region: "California", status: "open", storeManager: "Robert Hayes" },
  { id: "st12", city: "Stockton", state: "CA", mall: "Weberstown Mall", region: "California", status: "open", storeManager: "Sandra Ortiz" },
  { id: "st13", city: "Salinas", state: "CA", mall: "Northridge Mall", region: "California", status: "open", storeManager: "Chris Martinez" },
  { id: "st14", city: "Fresno", state: "CA", mall: "Fashion Fair Mall", region: "California", status: "open", storeManager: "Amanda Wright" },
  { id: "st15", city: "Visalia", state: "CA", mall: "Visalia Mall", region: "California", status: "open", storeManager: "Daniel Foster" },
  { id: "st16", city: "Bakersfield", state: "CA", mall: "Valley Plaza", region: "California", status: "open", storeManager: "Nicole Adams" },
  { id: "st17", city: "San Bernardino", state: "CA", mall: "Inland Center", region: "California", status: "open", storeManager: "Jason Rivera" },
  { id: "st18", city: "Ontario", state: "CA", mall: "Ontario Mills", region: "California", status: "open", storeManager: "Emily Johnson" },
  { id: "st19", city: "Victorville", state: "CA", mall: "Mall of Victor Valley", region: "California", status: "open", storeManager: "Mark Stevens" },
  { id: "st20", city: "Arcadia", state: "CA", mall: "The Shops at Santa Anita", region: "California", status: "open", storeManager: "Grace Wu" },
  { id: "st21", city: "Culver City", state: "CA", mall: "Westfield Culver City", region: "California", status: "open", storeManager: "Brian Cooper" },
  { id: "st22", city: "National City", state: "CA", mall: "Westfield Plaza Bonita", region: "California", status: "open", storeManager: "Diana Flores" },
  { id: "st23", city: "Northridge", state: "CA", mall: "Northridge Fashion Center", region: "California", status: "open", storeManager: "Paul Nguyen" },
  { id: "st24", city: "Palmdale", state: "CA", mall: "Antelope Valley Mall", region: "California", status: "open", storeManager: "Sarah Mitchell" },
  { id: "st25", city: "Reno", state: "NV", mall: "Meadowood Mall", region: "Nevada", status: "open", storeManager: "Tyler Jackson" },
  { id: "st26", city: "Chandler", state: "AZ", mall: "Chandler Fashion Center", region: "Arizona", status: "open", storeManager: "Olivia Reed" },
  { id: "st27", city: "Longview", state: "TX", mall: "Longview Mall", region: "Texas", status: "open", storeManager: "Marcus Hill" },
  { id: "st28", city: "Friendswood", state: "TX", mall: "Baybrook Mall", region: "Texas", status: "open" },
  { id: "st29", city: "Humble", state: "TX", mall: "Deerbrook Mall", region: "Texas", status: "open" },
];

export const mockContacts: Contact[] = [
  {
    id: "c1",
    name: "Ross",
    role: "Global Director",
    company: "Valliani Jewelers",
    phone: "+1 (510) 298-6571",
    whatsapp: "+1 (510) 298-6571",
    isImportant: true,
    notes: "Global leadership — strategy and oversight across all regions.",
  },
  {
    id: "c2",
    name: "Umair",
    role: "Director Operations",
    company: "Valliani Jewelers",
    phone: "+92 335 1006205",
    whatsapp: "+92 335 1006205",
    isImportant: true,
    notes: "Operations leadership — store performance, processes, and day-to-day execution.",
  },
  {
    id: "c3",
    name: "Zaima",
    role: "Assistant Director Operations",
    company: "Valliani Jewelers",
    phone: "+92 335 1006202",
    whatsapp: "+92 335 1006202",
    isImportant: true,
    notes: "Supports operations director — coordination, follow-ups, and operational projects.",
  },
  {
    id: "c4",
    name: "Shaun",
    role: "District Manager",
    company: "Valliani Jewelers",
    phone: "+1 (661) 615-0456",
    whatsapp: "+1 (661) 615-0456",
    isImportant: true,
    notes: "District-level store management and regional performance.",
  },
  {
    id: "c5",
    name: "AJ",
    role: "District Manager",
    company: "Valliani Jewelers",
    phone: "+1 (770) 905-6477",
    whatsapp: "+1 (770) 905-6477",
    isImportant: true,
    notes: "District-level store management and regional performance.",
  },
  {
    id: "c6",
    name: "Karla",
    role: "Special Orders",
    company: "Valliani Jewelers",
    phone: "+1 (408) 624-7126",
    whatsapp: "+1 (408) 624-7126",
    isImportant: true,
    notes: "Special orders, custom pieces, and client order follow-through.",
  },
  {
    id: "c7",
    name: "Rahim",
    role: "Dubai Office",
    company: "Valliani Jewelers — Dubai",
    phone: "+92 335 1006200",
    whatsapp: "+92 335 1006200",
    isImportant: true,
    notes: "Dubai office — international operations and Middle East coordination.",
  },
  {
    id: "c8",
    name: "Sawera",
    role: "Assistant",
    company: "Valliani Jewelers",
    phone: "+92 335 1006199",
    whatsapp: "+92 335 1006199",
    isImportant: false,
    notes: "Executive and office support — scheduling, tasks, and general assistance.",
  },
  {
    id: "c9",
    name: "Aziz",
    role: "India Office",
    company: "Valliani Jewelers — India",
    phone: "+91 98339 90602",
    whatsapp: "+91 98339 90602",
    isImportant: true,
    notes: "India office — regional operations and coordination.",
  },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const todayStr = today.toISOString().split("T")[0];
const yesterdayStr = yesterday.toISOString().split("T")[0];

function formatDate(d: Date, hour: number, minute = 0): string {
  const date = new Date(d);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function emailTime(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const mockEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "Weekly Leadership Standup",
    description: "Review KPIs across 29 locations and Texas expansion update",
    start: formatDate(today, 9, 0),
    end: formatDate(today, 9, 45),
    location: "HQ — Executive Conference Room",
    attendees: ["Ali Rahman", "James Chen", "Lisa Park"],
    status: "confirmed",
  },
  {
    id: "e2",
    title: "Diamond Inventory Review — Premier Diamond Imports",
    description: "Q2 diamond allocation, new bridal collection stones, and shipment schedule",
    start: formatDate(today, 11, 0),
    end: formatDate(today, 12, 0),
    location: "Video Call",
    attendees: ["Ahmed Hassan", "Robert Hayes"],
    status: "confirmed",
  },
  {
    id: "e3",
    title: "Store Performance Review — Bay Area",
    description: "Santa Clara Valley Fair, San Jose Oakridge, and Milpitas Great Mall metrics",
    start: formatDate(today, 14, 0),
    end: formatDate(today, 15, 0),
    location: "Executive Office",
    attendees: ["Maria Santos", "Ali Rahman"],
    status: "confirmed",
  },
  {
    id: "e4",
    title: "Texas Expansion Planning",
    description: "Baybrook Mall (Friendswood) and Deerbrook Mall (Humble) opening timelines",
    start: formatDate(today, 16, 0),
    end: formatDate(today, 17, 0),
    location: "Video Call",
    attendees: ["Marcus Hill", "James Chen"],
    status: "confirmed",
  },
  {
    id: "e5",
    title: "Bridal Collection Launch — Fall Preview",
    start: formatDate(tomorrow, 10, 0),
    end: formatDate(tomorrow, 11, 30),
    location: "HQ — Showroom",
    attendees: ["Lisa Park", "Robert Hayes", "Leadership Team"],
    status: "tentative",
  },
];

export const mockReminders: Reminder[] = [];

export const mockEmails: Email[] = (() => {
  const ahmed1: Email = {
    id: "em1a",
    threadId: "thread-ahmed",
    from: "Ahmed Hassan",
    fromEmail: "ahmed@premierdiamonds.com",
    subject: "URGENT: Diamond Shipment Delay — Bridal Collection Affected",
    preview: "Our certified diamond shipment (Order #PDI-4821) has been delayed at customs. Expected arrival pushed to...",
    body: "Dear Kash,\n\nI wanted to inform you that our certified diamond shipment (Order #PDI-4821) has been delayed at customs inspection. The expected arrival date has been pushed from June 8 to June 14.\n\nThis affects your Q2 bridal collection inventory: 1ct solitaires, halo engagement rings, and matching wedding bands for 8 California locations.\n\nSanta Clara Valley Fair and Ontario Mills are your highest-volume bridal stores — I recommend prioritizing partial shipment to those locations.\n\nPlease let me know how you'd like to proceed.\n\nBest regards,\nAhmed Hassan\nPremier Diamond Imports",
    receivedAt: emailTime(9, 0),
    isImportant: true,
    isRead: true,
    needsReply: false,
    category: "urgent",
    rfcMessageId: "<ahmed-1@premierdiamonds.com>",
  };
  const ahmed2: Email = {
    id: "em1b",
    threadId: "thread-ahmed",
    from: "Kash Valliani",
    fromEmail: "kash@vallianijewelers.com",
    subject: "Re: URGENT: Diamond Shipment Delay — Bridal Collection Affected",
    preview: "Thanks Ahmed — please prioritize Santa Clara Valley Fair first, then Ontario Mills...",
    body: "Hi Ahmed,\n\nThanks for the heads-up. Please prioritize a partial shipment to Santa Clara Valley Fair first, then Ontario Mills. Hold the remaining units until June 14 if needed.\n\nConfirm once customs clears.\n\nBest regards,\nKash Valliani\nFounder & President | Valliani Jewelers",
    receivedAt: emailTime(8, 15),
    isImportant: true,
    isRead: true,
    needsReply: false,
    category: "urgent",
    rfcMessageId: "<kash-reply-1@vallianijewelers.com>",
    inReplyTo: "<ahmed-1@premierdiamonds.com>",
    references: "<ahmed-1@premierdiamonds.com>",
  };
  const ahmed3: Email = {
    id: "em1",
    threadId: "thread-ahmed",
    from: "Ahmed Hassan",
    fromEmail: "ahmed@premierdiamonds.com",
    subject: "Re: URGENT: Diamond Shipment Delay — Bridal Collection Affected",
    preview: "Understood — Santa Clara first. Customs update expected tomorrow morning...",
    body: "Dear Kash,\n\nUnderstood — Santa Clara Valley Fair first, then Ontario Mills.\n\nCustoms confirmed inspection is scheduled for tomorrow morning. I'll send tracking as soon as the partial clears.\n\nOne question: should we ship the remaining bridal bands with the June 14 lot, or hold until you confirm store demand?\n\nBest regards,\nAhmed Hassan\nPremier Diamond Imports",
    receivedAt: emailTime(7, 15),
    isImportant: true,
    isRead: false,
    needsReply: true,
    category: "urgent",
    rfcMessageId: "<ahmed-2@premierdiamonds.com>",
    inReplyTo: "<kash-reply-1@vallianijewelers.com>",
    references: "<ahmed-1@premierdiamonds.com> <kash-reply-1@vallianijewelers.com>",
  };

  const threadAhmed: Email = {
    ...ahmed3,
    isRead: false,
    needsReply: true,
    messageCount: 3,
    threadMessages: [ahmed1, ahmed2, ahmed3],
    preview: ahmed3.preview,
  };

  const withThread = (email: Email, threadId: string, rfcMessageId: string): Email => ({
    ...email,
    threadId,
    rfcMessageId,
    messageCount: 1,
    threadMessages: [{ ...email, threadId, rfcMessageId, messageCount: 1 }],
  });

  return [
    threadAhmed,
    withThread(
      {
        id: "em2",
        threadId: "thread-james",
        from: "James Chen",
        fromEmail: "james.chen@vallianijewelers.com",
        subject: "Q2 Financial Summary — 29 Locations Performance",
        preview: "Q2 financial summary ready. Revenue up 14% YoY across all open locations...",
        body: "Hi Kash,\n\nThe Q2 financial summary is ready for your review. Key highlights across our 29 locations:\n\n- Total Revenue: $18.6M (+14% YoY)\n- Gross margin: 52.4% (strong bridal and diamond sales)\n- Top store: Santa Clara — Valley Fair ($1.2M)\n- Texas (Longview): On track, new stores pending\n- Operating expenses within budget\n\nPlease review before today's leadership standup.\n\nJames",
        receivedAt: emailTime(6, 30),
        isImportant: true,
        isRead: true,
        needsReply: false,
        category: "important",
      },
      "thread-james",
      "<james-q2@vallianijewelers.com>"
    ),
    withThread(
      {
        id: "em3",
        threadId: "thread-maria",
        from: "Maria Santos",
        fromEmail: "maria.santos@vallianijewelers.com",
        subject: "Valley Fair Store — Bridal Consultant Short-Staffed",
        preview: "We have 2 unexpected absences today during peak bridal season. Need approval for temp staff...",
        body: "Kash,\n\nWe have 2 unexpected absences at the Santa Clara Valley Fair store today — our busiest bridal season weekend. I've contacted our temp agency but need your approval for the additional $480 in staffing costs.\n\nWe have 6 engagement ring appointments scheduled this afternoon.\n\nCan you approve?\n\nMaria Santos\nStore Manager — Westfield Valley Fair",
        receivedAt: emailTime(8, 0),
        isImportant: true,
        isRead: false,
        needsReply: true,
        category: "important",
      },
      "thread-maria",
      "<maria-staff@vallianijewelers.com>"
    ),
    withThread(
      {
        id: "em4",
        threadId: "thread-lisa",
        from: "Lisa Park",
        fromEmail: "lisa.park@vallianijewelers.com",
        subject: "Summer Bridal Campaign — All 29 Locations",
        preview: "Draft campaign for engagement season across California, Nevada, Arizona, and Texas...",
        body: "Hi Kash,\n\nPlease find attached the draft for our summer bridal campaign rolling out to all 29 locations. Key themes:\n\n- \"Celebrate Your Moment\" — engagement ring focus\n- Free ring sizing and cleaning at every store\n- Texas grand opening tie-in for Baybrook and Deerbrook\n\nWould love your feedback by Friday.\n\nLisa",
        receivedAt: emailTime(7, 45),
        isImportant: false,
        isRead: true,
        needsReply: true,
        category: "normal",
      },
      "thread-lisa",
      "<lisa-campaign@vallianijewelers.com>"
    ),
    withThread(
      {
        id: "em5",
        threadId: "thread-marcus",
        from: "Marcus Hill",
        fromEmail: "marcus.hill@vallianijewelers.com",
        subject: "Texas Expansion Update — Baybrook & Deerbrook Timeline",
        preview: "Construction update for Friendswood and Humble locations. Target opening dates...",
        body: "Kash,\n\nQuick update on our Texas expansion:\n\n- Baybrook Mall (Friendswood): Buildout 85% complete. Target opening: August 2026.\n- Deerbrook Mall (Humble): Permits approved. Construction starts next week.\n- Longview Mall: Steady performance, up 11% this quarter.\n\nHappy to walk through details in today's 4 PM meeting.\n\nMarcus Hill\nTexas Operations",
        receivedAt: emailTime(7, 0),
        isImportant: true,
        isRead: false,
        needsReply: false,
        category: "important",
      },
      "thread-marcus",
      "<marcus-tx@vallianijewelers.com>"
    ),
    withThread(
      {
        id: "em6",
        threadId: "thread-digest",
        from: "Jewelry Industry Digest",
        fromEmail: "news@jewelryinsights.com",
        subject: "Weekly Fine Jewelry Market Report",
        preview: "Lab-grown vs natural diamond trends, bridal season forecasts, luxury watch demand...",
        body: "Weekly fine jewelry industry trends and market insights...",
        receivedAt: emailTime(5, 0),
        isImportant: false,
        isRead: true,
        needsReply: false,
        category: "promotional",
      },
      "thread-digest",
      "<digest-weekly@jewelryinsights.com>"
    ),
  ];
})();

export const mockDocuments: Document[] = [
  {
    id: "d1",
    name: "Q2_Sales_Report_All_Stores.xlsx",
    type: "excel",
    size: 385000,
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    summary: "Q2 sales report showing 14% revenue growth. Ovani lab-grown bridal and Aanika V. gemstone collections driving category growth.",
    keyPoints: [
      "Total revenue: $18.6M (+14% YoY)",
      "Top product line: Ovani lab-grown bridal rings ($4.2M)",
      "Aanika V. gemstone necklaces up 28%",
      "Link N Lock men's collection strong at outlet locations",
      "Victorville underperforming (-6%) — low-ticket mix",
    ],
    actionItems: [
      "Restock Ovani Yellow Diamond bridal rings at Valley Fair and Ontario Mills",
      "Expand Aanika V. display at underperforming stores",
      "Push Father's Day Link N Lock campaign",
    ],
  },
  {
    id: "d2",
    name: "Premier_Diamond_Imports_Contract_2026.pdf",
    type: "pdf",
    size: 1450000,
    uploadedAt: new Date(Date.now() - 172800000).toISOString(),
    summary: "Annual diamond and gemstone supply agreement with Premier Diamond Imports.",
    keyPoints: [
      "Contract term: 12 months, renewable",
      "Certified natural diamonds — GIA graded",
      "Payment terms: Net 45",
      "Minimum quarterly order: $250,000",
      "Penalty clause for late delivery: 3% per week",
    ],
  },
  {
    id: "d3",
    name: "Texas_Expansion_Plan_Baybrook_Deerbrook.docx",
    type: "word",
    size: 92000,
    uploadedAt: new Date(Date.now() - 604800000).toISOString(),
    summary: "Expansion plan for two new Texas locations at Baybrook Mall and Deerbrook Mall.",
    keyPoints: [
      "Baybrook Mall (Friendswood): 1,800 sq ft, target August 2026",
      "Deerbrook Mall (Humble): 2,100 sq ft, target Q4 2026",
      "Combined buildout budget: $1.4M",
      "Staffing plan: 12 associates per location",
    ],
    actionItems: [
      "Sign Deerbrook lease by June 15",
      "Order display cases for Baybrook",
      "Hire store managers for both locations",
      "Launch pre-opening marketing in Houston metro",
    ],
  },
  {
    id: "d4",
    name: "Store_Locations_Master_List.pdf",
    type: "pdf",
    size: 210000,
    uploadedAt: new Date(Date.now() - 1209600000).toISOString(),
    summary: "Official store locator listing all 29 Valliani Jewelers locations across CA, NV, AZ, and TX.",
    keyPoints: [
      "24 California locations (Roseville through Palmdale)",
      "1 Nevada location: Reno — Meadowood Mall",
      "1 Arizona location: Chandler — Chandler Fashion Center",
      "3 Texas locations: Longview (open), Friendswood & Humble (opening soon)",
    ],
  },
];

export const mockSalesData: SalesData[] = [
  // Yesterday — Valliani catalog products
  { date: yesterdayStr, storeId: "st04", storeName: "Santa Clara — Valley Fair", productId: "pr01", productName: "Ovani Lab-grown Diamond Pear and Marquise Ring", category: "Rings", quantity: 2, revenue: 5998 },
  { date: yesterdayStr, storeId: "st04", storeName: "Santa Clara — Valley Fair", productId: "pr02", productName: "Bella by Ovani Lab-grown Diamond Tennis Bracelet", category: "Bracelets", quantity: 1, revenue: 3749 },
  { date: yesterdayStr, storeId: "st18", storeName: "Ontario — Ontario Mills", productId: "pr09", productName: "Ovani Lab-grown Yellow Diamond Oval Bridal Ring", category: "Rings", quantity: 1, revenue: 5249 },
  { date: yesterdayStr, storeId: "st18", storeName: "Ontario — Ontario Mills", productId: "pr11", productName: "Ovani Lab-grown Diamond Pear Wave Bridal Set", category: "Rings", quantity: 2, revenue: 6758 },
  { date: yesterdayStr, storeId: "st03", storeName: "San Jose — Oakridge", productId: "pr03", productName: "Novello Lab-grown Diamond Flower Marquise Pavé Hoops", category: "Earrings", quantity: 5, revenue: 2245 },
  { date: yesterdayStr, storeId: "st05", storeName: "Milpitas — Great Mall", productId: "pr04", productName: "Bella by Ovani Lab-grown Diamond Station Necklace", category: "Necklaces", quantity: 3, revenue: 3297 },
  { date: yesterdayStr, storeId: "st19", storeName: "Victorville — Victor Valley", productId: "pr14", productName: "Link N Lock Black Treated Diamond Cuban Men's Ring", category: "Rings", quantity: 2, revenue: 738 },
  { date: yesterdayStr, storeId: "st19", storeName: "Victorville — Victor Valley", productId: "pr13", productName: "Link N Lock Octagon And Textured Rings Pendant", category: "Necklaces", quantity: 4, revenue: 316 },
  { date: yesterdayStr, storeId: "st25", storeName: "Reno — Meadowood Mall", productId: "pr18", productName: "Aanika V. Sapphire & Diamond Pear Halo Pendant", category: "Necklaces", quantity: 2, revenue: 1998 },
  { date: yesterdayStr, storeId: "st26", storeName: "Chandler — Fashion Center", productId: "pr07", productName: "Ovani Lab-grown Yellow Diamond Radiant Bridal Ring", category: "Rings", quantity: 1, revenue: 3749 },
  { date: yesterdayStr, storeId: "st27", storeName: "Longview — Longview Mall", productId: "pr06", productName: "Ovani Lab-grown Diamond Pear Spiral Wrap Ring", category: "Rings", quantity: 2, revenue: 5258 },
  { date: yesterdayStr, storeId: "st11", storeName: "Sacramento — Arden Fair", productId: "pr21", productName: "Aanika V. Sapphire & Diamond Floral Station Necklace", category: "Necklaces", quantity: 1, revenue: 1479 },
  // Today
  { date: todayStr, storeId: "st04", storeName: "Santa Clara — Valley Fair", productId: "pr01", productName: "Ovani Lab-grown Diamond Pear and Marquise Ring", category: "Rings", quantity: 3, revenue: 8997 },
  { date: todayStr, storeId: "st04", storeName: "Santa Clara — Valley Fair", productId: "pr10", productName: "Ovani Lab-grown Pink Diamond Princess Bridal Ring", category: "Rings", quantity: 1, revenue: 4749 },
  { date: todayStr, storeId: "st18", storeName: "Ontario — Ontario Mills", productId: "pr11", productName: "Ovani Lab-grown Diamond Pear Wave Bridal Set", category: "Rings", quantity: 2, revenue: 6758 },
  { date: todayStr, storeId: "st18", storeName: "Ontario — Ontario Mills", productId: "pr02", productName: "Bella by Ovani Lab-grown Diamond Tennis Bracelet", category: "Bracelets", quantity: 1, revenue: 3749 },
  { date: todayStr, storeId: "st03", storeName: "San Jose — Oakridge", productId: "pr08", productName: "Ovani Lab-grown Yellow Diamond Pear Bridal Ring", category: "Rings", quantity: 1, revenue: 3749 },
  { date: todayStr, storeId: "st05", storeName: "Milpitas — Great Mall", productId: "pr22", productName: "Aanika V. Ruby & Diamond Floral Station Necklace", category: "Necklaces", quantity: 2, revenue: 2898 },
  { date: todayStr, storeId: "st19", storeName: "Victorville — Victor Valley", productId: "pr16", productName: "Link N Lock Black CZ Leather & Stainless Bracelet", category: "Bracelets", quantity: 3, revenue: 237 },
  { date: todayStr, storeId: "st25", storeName: "Reno — Meadowood Mall", productId: "pr23", productName: "Aanika V. Ruby & Diamond Oval Halo Split Shank Ring", category: "Rings", quantity: 1, revenue: 1829 },
  { date: todayStr, storeId: "st26", storeName: "Chandler — Fashion Center", productId: "pr20", productName: "Aanika V. Sapphire & Diamond Pear & Marquise Hoops", category: "Earrings", quantity: 2, revenue: 1398 },
  { date: todayStr, storeId: "st27", storeName: "Longview — Longview Mall", productId: "pr12", productName: "Ovani Lab-grown Yellow Diamond Oval Bridal Ring", category: "Rings", quantity: 1, revenue: 3499 },
  { date: todayStr, storeId: "st08", storeName: "Livermore — Premium Outlets", productId: "pr05", productName: "Bella by Ovani Lab-grown Diamond Evil Eye Pendant", category: "Necklaces", quantity: 4, revenue: 1796 },
  { date: todayStr, storeId: "st20", storeName: "Arcadia — Santa Anita", productId: "pr26", productName: "Aanika V. Ruby & Diamond Oval Halo Pendant", category: "Necklaces", quantity: 1, revenue: 2749 },
];

export const mockRecentActions: AIAction[] = [
  {
    id: "a1",
    type: "email_summary",
    description: "Summarized 6 important emails including diamond shipment alert",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
  },
  {
    id: "a2",
    type: "sales_report",
    description: "Generated daily sales summary across stores",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: "completed",
  },
  {
    id: "a3",
    type: "email_summary",
    description: "Summarized inbox highlights",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: "completed",
  },
  {
    id: "a4",
    type: "document",
    description: "Summarized Texas Expansion Plan document",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    status: "completed",
  },
];

export function computeSalesSummary(data: SalesData[], targetDate?: string): import("@/types").SalesSummary {
  const date = targetDate || new Date().toISOString().split("T")[0];
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split("T")[0];

  const todayData = data.filter((d) => d.date === date);
  const prevData = data.filter((d) => d.date === prevDateStr);

  const totalRevenue = todayData.reduce((sum, d) => sum + d.revenue, 0);
  const prevRevenue = prevData.reduce((sum, d) => sum + d.revenue, 0);
  const comparisonPreviousDay = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const storeMap = new Map<string, number>();
  const prevStoreMap = new Map<string, number>();
  todayData.forEach((d) => storeMap.set(d.storeName, (storeMap.get(d.storeName) || 0) + d.revenue));
  prevData.forEach((d) => prevStoreMap.set(d.storeName, (prevStoreMap.get(d.storeName) || 0) + d.revenue));

  const topStores = Array.from(storeMap.entries())
    .map(([name, revenue]) => ({
      name,
      revenue,
      change: prevStoreMap.has(name)
        ? ((revenue - (prevStoreMap.get(name) || 0)) / (prevStoreMap.get(name) || 1)) * 100
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const productMap = new Map<string, { revenue: number; units: number }>();
  todayData.forEach((d) => {
    const existing = productMap.get(d.productName) || { revenue: 0, units: 0 };
    productMap.set(d.productName, {
      revenue: existing.revenue + d.revenue,
      units: existing.units + d.quantity,
    });
  });

  const topProducts = Array.from(productMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  const worstStores = [...topStores].sort((a, b) => a.revenue - b.revenue).slice(0, 10);
  const underperformingStores = topStores.filter((s) => s.change < 0);

  const recommendations: string[] = [];
  if (comparisonPreviousDay < 0) {
    recommendations.push("Overall sales are down compared to yesterday. Consider a bridal promotion at underperforming locations.");
  }
  if (underperformingStores.length > 0) {
    recommendations.push(`${underperformingStores[0].name} needs attention — revenue declined ${Math.abs(underperformingStores[0].change).toFixed(1)}%. Review staffing and display.`);
  }
  if (topProducts.length > 0) {
    recommendations.push(topProducts[0].name + " is the best seller today. Restock Ovani and Bella by Ovani lab-grown inventory at top stores.");
  }
  recommendations.push("Promote Father's Day Link N Lock collection — men's rings and pendants from $79.");
  recommendations.push("Santa Clara Valley Fair and Ontario Mills lead in Ovani bridal — replicate display strategy at Victorville.");
  recommendations.push("Prepare Aanika V. gemstone and Ovani yellow diamond inventory for Baybrook and Deerbrook Texas openings.");

  return {
    totalRevenue,
    totalTransactions: todayData.reduce((sum, d) => sum + d.quantity, 0),
    averageOrderValue: todayData.length > 0 ? totalRevenue / todayData.reduce((sum, d) => sum + d.quantity, 0) : 0,
    comparisonPreviousDay,
    comparisonPreviousWeek: 8.4,
    topStores,
    worstStores,
    topProducts,
    underperformingStores,
    recommendations,
  };
}

export function getStoreStats() {
  const open = mockStores.filter((s) => s.status === "open").length;
  const openingSoon = mockStores.filter((s) => s.status === "opening_soon").length;
  const byRegion = {
    California: mockStores.filter((s) => s.region === "California").length,
    Nevada: mockStores.filter((s) => s.region === "Nevada").length,
    Arizona: mockStores.filter((s) => s.region === "Arizona").length,
    Texas: mockStores.filter((s) => s.region === "Texas").length,
  };
  return { total: mockStores.length, open, openingSoon, byRegion };
}
