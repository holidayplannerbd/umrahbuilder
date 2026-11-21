/* ============================================================
   UMRAH BUILDER — CORE / CONFIG
   ============================================================ */

const DB_NAME = 'UmrahBuilderPremium';
const DB_VERSION = 19;

const STORES = {
  makkahHotels: 'makkahHotels',
  madinahHotels: 'madinahHotels',
  flights: 'flights',
  transports: 'transports',
  visas: 'visas',
  ziyarah: 'ziyarah',
  services: 'services',
  packages: 'packages',
  customers: 'customers',
  vendors: 'vendors',
  payments: 'payments',
  followups: 'followups',
  images: 'images',
  settings: 'settings',
  userProfiles: 'userProfiles'
};

// ⭐ Vehicle Capacities (একটাই ডিক্লেয়ারেশন)
const VEHICLE_CAPACITY = {
  'Sedan': 4,
  '7-Seater': 7,
  'Hiace': 12,
  'GMC': 7,
  'Coaster': 22,
  'Bullet Train': 0 // ⭐ Per Person — সিটের হিসাব নেই
};

// ⭐ Per Person Vehicle List (যেমন: Bullet Train)
const PER_PERSON_VEHICLES = ['Bullet Train'];

const CAR_SEATERS = {
  sedan: { label: 'Sedan', seats: 4 },
  '7seater': { label: '7-Seater SUV', seats: 7 },
  hiace: { label: 'Hiace', seats: 12 },
  coaster: { label: 'Coaster', seats: 22 }
};

const ROOM_CAPACITY = {
  quad: 4,
  triple: 3,
  double: 2,
  single: 1
};

/* ============================================================
   ⭐ USER PROFILES CACHE
   ============================================================ */

window.__userProfiles = window.__userProfiles || {};

/* ⭐ সব ইউজারের নাম ও ছবি লোড করা */
async function refreshUserProfiles() {
  try {
    await dbGetAllUserProfiles();
  } catch (e) {
    console.warn('refreshUserProfiles failed:', e);
  }
}

/* ⭐ যেকোনো UID-এর নাম বের করা */
function getNameByUid(uid) {
  if (!uid) return 'Unknown';

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    return cu.displayName || cu.email?.split('@')[0] || 'You';
  }

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.name) return profiles[uid].name;

  return 'Team Member';
}

/* ⭐ যেকোনো UID-এর ছবি বের করা */
function getPhotoByUid(uid) {
  if (!uid) return '';

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    const profiles = window.__userProfiles || {};
    return profiles[uid]?.photo || cu.photoURL || '';
  }

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.photo) return profiles[uid].photo;

  return '';
}

/* Invoice logo URL-কে site root নয়, app-এর base path-এর relative করে রাখি;
   এতে GitHub Pages subpath deployment (/Mainpackage/) এবং custom domain—দুটিতেই কাজ করে। */
window.addEventListener('load', () => {
  if (typeof window.buildInvoiceHtml !== 'function') return;

  const logoCandidates = [
    new URL('images/holiday-planner-logo.png', document.baseURI).href,
    new URL('/images/holiday-planner-logo.png', location.origin).href
  ];
  let logoDataUrlPromise;

  window.getInvoiceLogoUrl = () => logoCandidates[0];
  window.getInvoiceLogoBase64 = async () => {
    if (!logoDataUrlPromise) {
      logoDataUrlPromise = (async () => {
        for (const url of logoCandidates) {
          try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) continue;
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) continue;
            return await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            // Try the next path if this deployment does not serve this candidate.
          }
        }
        return '';
      })();
    }
    return logoDataUrlPromise;
  };
});
