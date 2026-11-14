/* ============================================================
   UMRAH BUILDER — CORE / DATABASE (Firebase Firestore)
   ============================================================ */

let db = null;

/* ==================== INIT ==================== */
async function openDB() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      if (window.firebaseDB) {
        db = window.firebaseDB;
        clearInterval(check);
        console.log('✅ Firestore connected');
        resolve(db);
      }
      if (tries > 50) {
        clearInterval(check);
        reject(new Error('Firebase not loaded. Check your config.'));
      }
    }, 100);
  });
}

/* ==================== SAVE ==================== */
async function dbSave(storeName, data) {
  if (!db) throw new Error('DB not ready');
  const { doc, setDoc } = window.firebaseFns;
  const id = String(data.id);
  await setDoc(doc(db, storeName, id), data);
  return id;
}

/* ==================== GET ALL ==================== */
async function dbGetAll(storeName) {
  if (!db) throw new Error('DB not ready');
  const { collection, getDocs } = window.firebaseFns;
  const snapshot = await getDocs(collection(db, storeName));
  const arr = [];
  snapshot.forEach(doc => arr.push({ ...doc.data(), id: doc.data().id || doc.id }));
  return arr;
}

/* ==================== DELETE ==================== */
async function dbDelete(storeName, id) {
  if (!db) throw new Error('DB not ready');
  const { doc, deleteDoc } = window.firebaseFns;
  await deleteDoc(doc(db, storeName, String(id)));
}

/* ==================== SETTINGS (Global) ==================== */
async function dbSaveSetting(key, value) {
  if (!db) throw new Error('DB not ready');
  const { doc, setDoc } = window.firebaseFns;
  await setDoc(doc(db, 'settings', key), { key, value, savedAt: Date.now() });
}

async function dbGetSetting(key) {
  if (!db) throw new Error('DB not ready');
  const { doc, getDoc } = window.firebaseFns;
  const snap = await getDoc(doc(db, 'settings', key));
  if (snap.exists()) return snap.data().value;
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

  console.log('✅ User profile saved:', data.name || existing.name || '(no name)');
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
  console.log('✅ Loaded', Object.keys(profiles).length, 'user profiles');
  return profiles;
}