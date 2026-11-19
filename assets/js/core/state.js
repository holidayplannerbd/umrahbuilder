/* ============================================================
   UMRAH BUILDER — CORE / STATE (v4 — Follow-up Advanced)
   Global STORE + Builder states + Module caches + Follow-up
   ============================================================ */

/* ==================== MAIN STORE ==================== */
const STORE = {
  makkahHotels: [],
  madinahHotels: [],
  flights: [],
  transports: [],
  visas: [],
  ziyarah: [],
  services: [],
  packages: [],
  customers: [],
  vendors: [],
  payments: [],
  followups: []
};

/* ==================== BUILDER STATE ==================== */
let makkahItems = [];
let madinahItems = [];
let flightItems = [];
let transportItems = [];
let visaItems = [];
let serviceItems = [];
let itineraryItems = [];
let inclusionsItems = [];
let exclusionsItems = [];
let importantNotesItems = [];
let paymentTermsItems = [];
let cancellationPolicyItems = [];
let ziyarahTransportItems = [];
let hotelStayOrder = ['makkah', 'madinah'];
let itineraryRouteOrder = 'makkah-first';

/* ==================== COUNTERS ==================== */
let mC = 0, mdC = 0, fC = 0, tC = 0, vC = 0, sC = 0, itC = 0;
let incC = 0, excC = 0, noteC = 0, ptC = 0, cpC = 0, ztC = 0;
let hotelRoomCounter = 0;

/* ==================== BUILDER MODES ==================== */
let editingPackageId = null;
let currentViewPackageId = null;
let pkgSearchQuery = '';
let builderDefaultRoomSharing = 'double';

/* ==================== CHART INSTANCES ==================== */
let progressChartInstance = null;
let typeChartInstance = null;
let reportChart = null;
let reportTypeChart = null;
let perfChart = null;

/* ==================== ANALYTICS ==================== */
let analyticsFilterFrom = null;
let analyticsFilterTo = null;

/* ==================== FOLLOW-UP ==================== */
let currentFollowTab = 'package';

/* ⭐ FOLLOW-UP ADVANCED STATE */
let followFilterAssigned = 'all';
let followFilterStatus = 'all';
let followFilterPriority = 'all';
let followFilterDateRange = 'all';
let followSearchQuery = '';
let followBulkSelected = new Set();
let currentFollowupActivityId = null;

/* ⭐ Team Members (dynamic — userProfiles theke load hobe) */
let TEAM_MEMBERS = [
  { id: 'junayet', name: 'Junayet Khan', role: 'admin', photo: '' },
  { id: 'rajon', name: 'Rajon', role: 'staff', photo: '' }
];

/* ⭐ Lead Status Pipeline */
const LEAD_STATUSES = {
  new: { label: 'New Lead', icon: '🆕', color: '#3b82f6', bg: '#eff6ff' },
  contacted: { label: 'Contacted', icon: '📞', color: '#8b5cf6', bg: '#f5f3ff' },
  interested: { label: 'Interested', icon: '⭐', color: '#f59e0b', bg: '#fffbeb' },
  negotiating: { label: 'Negotiating', icon: '🤝', color: '#ec4899', bg: '#fdf2f8' },
  won: { label: 'Won', icon: '✅', color: '#22c55e', bg: '#f0fdf4' },
  lost: { label: 'Lost', icon: '❌', color: '#ef4444', bg: '#fef2f2' }
};

/* ⭐ Lead Sources */
const LEAD_SOURCES = [
  { id: 'facebook', label: '📱 Facebook' },
  { id: 'instagram', label: '📷 Instagram' },
  { id: 'referral', label: '👥 Referral' },
  { id: 'walkin', label: '🚶 Walk-in' },
  { id: 'website', label: '🌐 Website' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'phone', label: '📞 Phone' },
  { id: 'other', label: '📦 Other' }
];

/* ⭐ Lost Reasons */
const LOST_REASONS = [
  'Price too high',
  'Found better deal',
  'Date changed',
  'No response',
  'Cancelled trip',
  'Budget issue',
  'Visa problem',
  'Other'
];

/* ==================== SEARCH ==================== */
let customerSearchQuery = '';
let vendorSearchQuery = '';

/* ==================== VENDOR ==================== */
let vendorItemCounter = 0;
let vendorItemsDraft = [];
let currentVendorType = 'hotel';
let currentViewVendorId = null;

/* ==================== ZIYARAH DRAFT ==================== */
let ziyarahPlacesDraft = [];
let ziyarahPlaceCounter = 0;

/* ==================== HOTEL IMAGES ==================== */
let hotelImgs = [null, null, null];

/* ==================== ITINERARY SORTABLE ==================== */
let itinerarySortable = null;
let hotelStaySortable = null;

/* ==================== TASKS ==================== */
let tasksCache = [];
let currentTaskTab = 'all';

/* ==================== DOCUMENTS ==================== */
let docsCache = [];

/* ==================== EXPENSES ==================== */
let expensesCache = [];

/* ==================== REFUNDS ==================== */
let refundsCache = [];

/* ==================== EMPLOYEES ==================== */
let employeeDraft = [];

/* ==================== TEMPLATES ==================== */
const TEMPLATES = {
  economy: { name: 'Economy Umrah Package', type: 'Economy', nights: 6, days: 7, roomSharing: 'quad' },
  standard: { name: 'Standard Umrah Package', type: 'Standard', nights: 9, days: 10, roomSharing: 'triple' },
  premium: { name: 'Premium Umrah Package', type: 'Premium', nights: 11, days: 12, roomSharing: 'double' },
  ramadan: { name: 'Ramadan Special Umrah', type: 'Ramadan', nights: 14, days: 15, roomSharing: 'double' }
};

/* ==================== CHATBOT STATE ==================== */
let chatState = {
  step: null, mode: null, cities: [], star: null, nights: null,
  roomType: null, pax: null, meal: null, rooms: [], results: [],
  transportId: null, ziyarahId: null, pendingListCity: null, ziyarahPax: null,
  messages: []   /* ⭐ Chat memory */
};

let chatbotHotelListState = {
  city: null, star: null, allHotels: [], visibleCount: 5, perPage: 5
};