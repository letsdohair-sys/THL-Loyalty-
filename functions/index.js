const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
const auth = getAuth();

const ADMIN_UID = "admin";
const ADMIN_DOC = db.collection("secure").doc("admin");

function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "").slice(-9);
}

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString("hex");
}

function newSalt() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Verifies a client's phone + PIN against Firestore (via the Admin SDK,
 * which bypasses security rules) and mints a custom auth token whose uid
 * equals the client's Firestore document ID. Firestore rules then check
 * request.auth.uid == clientId, so the client can only ever read/write
 * their own data once signed in with this token.
 */
exports.clientLogin = onCall(async (request) => {
  const phone = request.data && request.data.phone;
  const pin = request.data && request.data.pin;
  if (!phone || !pin) {
    throw new HttpsError("invalid-argument", "Phone and PIN are required.");
  }
  const normalized = normalizePhone(phone);
  const snap = await db.collection("clients").get();
  const match = snap.docs.find((d) => {
    const data = d.data();
    return normalizePhone(data.phone) === normalized && data.pin === pin;
  });
  if (!match) {
    throw new HttpsError("not-found", "No match found.");
  }
  const token = await auth.createCustomToken(match.id);
  return { token, client: { id: match.id, ...match.data() } };
});

/**
 * Verifies (or, on first run, sets up) the admin PIN. The PIN itself is
 * stored hashed+salted in secure/admin, a document Firestore rules lock
 * out entirely for client SDKs (allow read, write: if false) - only this
 * function, running with Admin SDK privileges, ever touches it. On
 * success mints a custom token carrying the {admin: true} claim, which
 * Firestore rules check via request.auth.token.admin.
 */
exports.adminLogin = onCall(async (request) => {
  const pin = request.data && request.data.pin;
  const setup = !!(request.data && request.data.setup);
  if (!pin || String(pin).length < 4) {
    throw new HttpsError("invalid-argument", "PIN must be at least 4 digits.");
  }
  const doc = await ADMIN_DOC.get();
  if (!doc.exists) {
    if (!setup) {
      throw new HttpsError("failed-precondition", "not-configured");
    }
    const salt = newSalt();
    await ADMIN_DOC.set({
      hash: hashPin(pin, salt),
      salt,
      createdAt: new Date().toISOString(),
    });
    const token = await auth.createCustomToken(ADMIN_UID, { admin: true });
    return { token };
  }
  const data = doc.data();
  const candidate = hashPin(pin, data.salt);
  if (candidate !== data.hash) {
    throw new HttpsError("permission-denied", "Incorrect PIN.");
  }
  const token = await auth.createCustomToken(ADMIN_UID, { admin: true });
  return { token };
});

/**
 * Public, non-secret status check so the client app can show "set up
 * your admin PIN" vs "admin sign in" without ever reading the secret.
 */
exports.adminStatus = onCall(async () => {
  const doc = await ADMIN_DOC.get();
  return { configured: doc.exists };
});

/**
 * One-time migration: moves the admin PIN out of settings/config (a
 * document that becomes readable by any signed-in client under the new
 * rules) into the locked-down secure/admin doc, hashed+salted, then
 * deletes the plaintext field from settings/config. Safe to call
 * unauthenticated because it is fully idempotent and self-disabling: it
 * only ever acts once (guarded by secure/admin not already existing),
 * and it only relocates a value that was already world-readable under
 * the *old* rules this deploy replaces - it creates no new exposure.
 */
exports.migrateAdminPin = onCall(async () => {
  const secureDoc = await ADMIN_DOC.get();
  if (secureDoc.exists) {
    return { migrated: false, reason: "already-migrated" };
  }
  const settingsRef = db.collection("settings").doc("config");
  const settingsDoc = await settingsRef.get();
  const existingPin = settingsDoc.exists ? settingsDoc.data().adminPin : null;
  if (!existingPin) {
    return { migrated: false, reason: "no-existing-pin" };
  }
  const salt = newSalt();
  await ADMIN_DOC.set({
    hash: hashPin(existingPin, salt),
    salt,
    createdAt: new Date().toISOString(),
    migratedFromSettings: true,
  });
  await settingsRef.update({ adminPin: FieldValue.delete() });
  return { migrated: true };
});
