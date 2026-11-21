/* ============================================================
   UMRAH BUILDER — CORE / DATABASE (Firebase Firestore)
   ============================================================ */

let db = null;
const settingsCache = new Map();
const collectionCache = new Map();

/* ==================== INIT ==================== */
async function openDB() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      tries++;
      if (window.firebaseDB) {
        db = window.firebaseDB;
        resolve(db);
        return;
      }
      if (tries > 50) {
        reject(new Error('Firebase not loaded. Check your config.'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/* ==================== SAVE ==================== */
async function dbSave(storeName, data) {
  if (!db) throw new Error('DB not ready');
  const { doc, setDoc } = window.firebaseFns;
  const id = String(data.id);
  await setDoc(doc(db, storeName, id), data);
  collectionCache.delete(storeName);
  if (storeName === 'settings') settingsCache.delete(data.id || data.key);
  return id;
}

/* ==================== GET ALL ==================== */
async function dbGetAll(storeName) {
  if (!db) throw new Error('DB not ready');
  if (collectionCache.has(storeName)) return collectionCache.get(storeName);
  const { collection, getDocs } = window.firebaseFns;
  const snapshot = await getDocs(collection(db, storeName));
  const arr = [];
  snapshot.forEach(doc => arr.push({ ...doc.data(), id: doc.data().id || doc.id }));
  collectionCache.set(storeName, arr);
  return arr;
}

/* ==================== DELETE ==================== */
async function dbDelete(storeName, id) {
  if (!db) throw new Error('DB not ready');
  const { doc, deleteDoc } = window.firebaseFns;
  await deleteDoc(doc(db, storeName, String(id)));
  collectionCache.delete(storeName);
}

/* ==================== SETTINGS (Global) ==================== */
async function dbSaveSetting(key, value) {
  if (!db) throw new Error('DB not ready');
  const { doc, setDoc } = window.firebaseFns;
  await setDoc(doc(db, 'settings', key), { key, value, savedAt: Date.now() });
  settingsCache.set(key, value);
}

async function dbGetSetting(key) {
  if (!db) throw new Error('DB not ready');
  if (settingsCache.has(key)) return settingsCache.get(key);
  const { doc, getDoc } = window.firebaseFns;
  const snap = await getDoc(doc(db, 'settings', key));
  if (snap.exists()) {
    const value = snap.data().value;
    settingsCache.set(key, value);
    return value;
  }
  settingsCache.set(key, undefined);
  return undefined;
}

/* ==================== IMAGES ==================== */
async function dbSaveImage(id, blob) {
  if (!db) throw new Error('DB not ready');
  const { doc, setDoc } = window.firebaseFns;

  const base64 = await new Promise((res) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });

  await setDoc(doc(db, 'images', id), {
    id,
    base64,
    type: blob.type,
    size: blob.size,
    savedAt: Date.now()
  });
}

async function dbGetImage(id) {
  if (!db) throw new Error('DB not ready');
  const { doc, getDoc } = window.firebaseFns;
  const snap = await getDoc(doc(db, 'images', id));
  if (!snap.exists()) return null;

  const data = snap.data();
  const binary = atob(data.base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return { ...data, blob: new Blob([array], { type: data.type }) };
}

/* ============================================================
   ⭐ USER PROFILES (সব ইউজারের নাম ও ছবি — সবার পড়ার জন্য)
   Collection: userProfiles
   Doc ID: {uid}
   Fields: { uid, name, photo, phone, role, email, updatedAt }
   ============================================================ */

/* ⭐ বর্তমান ইউজারের profile সেভ করা (merge) */
async function dbSaveUserProfile(data) {
  if (!db) throw new Error('DB not ready');
  const user = window.firebaseAuth?.currentUser;
  if (!user) throw new Error('No user logged in');

  const { doc, setDoc, getDoc } = window.firebaseFns;
  const ref = doc(db, 'userProfiles', user.uid);

  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};

  await setDoc(ref, {
    ...existing,
    ...data,
    uid: user.uid,
    email: user.email,
    updatedAt: Date.now()
  });

}

/* ⭐ বর্তমান ইউজারের profile পড়া */
async function dbGetUserProfile() {
  if (!db) throw new Error('DB not ready');
  const user = window.firebaseAuth?.currentUser;
  if (!user) return {};

  const { doc, getDoc } = window.firebaseFns;
  const snap = await getDoc(doc(db, 'userProfiles', user.uid));
  if (snap.exists()) return snap.data();
  return {};
}

/* ⭐ সব ইউজারের profile পড়া */
async function dbGetAllUserProfiles() {
  if (!db) throw new Error('DB not ready');
  const { collection, getDocs } = window.firebaseFns;
  const snap = await getDocs(collection(db, 'userProfiles'));

  const profiles = {};
  snap.forEach(d => {
    const data = d.data();
    if (data.uid) profiles[data.uid] = data;
  });

  window.__userProfiles = profiles;
  return profiles;
}