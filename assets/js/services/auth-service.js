import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp as firestoreServerTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  COLLECTIONS,
  INTERNAL_AUTH_DOMAIN,
  USER_ROLES,
  USER_STATUSES,
} from "../config/constants.js";
import { firebaseConfig } from "../firebase-config.js";
import {
  buildInternalEmail,
  buildLoginIndexDocId,
  normalizePhone,
  normalizeText,
  normalizeUsername,
} from "../utils/helpers.js";
import { validateSignupPayload } from "../utils/validators.js";
import { auth, db } from "./firebase.js";

function getInternalAuthDomain() {
  return firebaseConfig.usernameEmailDomain || INTERNAL_AUTH_DOMAIN;
}

async function resolveLoginEmail(loginInput) {
  const normalized = normalizeText(loginInput).replaceAll(" ", "");
  if (normalized.includes("@")) {
    return normalized;
  }

  const usernameDoc = await getDoc(
    doc(db, COLLECTIONS.LOGIN_INDEX, buildLoginIndexDocId("username", normalizeUsername(loginInput))),
  );

  if (usernameDoc.exists()) {
    return usernameDoc.data().email;
  }

  const phoneDoc = await getDoc(
    doc(db, COLLECTIONS.LOGIN_INDEX, buildLoginIndexDocId("phone", normalizePhone(loginInput))),
  );

  if (phoneDoc.exists()) {
    return phoneDoc.data().email;
  }

  throw new Error("اسم المستخدم أو رقم الهاتف غير مسجل داخل النظام.");
}

export async function loginWithUsername(username, password) {
  const email = await resolveLoginEmail(username);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function getCurrentUserProfile(uid) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createPendingUserAccount(payload) {
  validateSignupPayload(payload);

  const username = normalizeUsername(payload.username);
  const phone = normalizePhone(payload.phone);
  const email = buildInternalEmail(username, getInternalAuthDomain());
  const usernameIndexRef = doc(db, COLLECTIONS.LOGIN_INDEX, buildLoginIndexDocId("username", username));
  const phoneIndexRef = doc(db, COLLECTIONS.LOGIN_INDEX, buildLoginIndexDocId("phone", phone));

  const [usernameIndex, phoneIndex] = await Promise.all([getDoc(usernameIndexRef), getDoc(phoneIndexRef)]);

  if (usernameIndex.exists()) {
    throw new Error("اسم المستخدم مستخدم بالفعل.");
  }

  if (phoneIndex.exists()) {
    throw new Error("رقم الهاتف مستخدم بالفعل.");
  }

  const credential = await createUserWithEmailAndPassword(auth, email, payload.password);
  const userRef = doc(db, COLLECTIONS.USERS, credential.user.uid);

  await setDoc(userRef, {
    name: String(payload.name).trim(),
    username,
    phone,
    email,
    role: USER_ROLES.USER,
    status: USER_STATUSES.PENDING,
    isActive: false,
    apartmentId: null,
    createdAt: firestoreServerTimestamp(),
    updatedAt: firestoreServerTimestamp(),
  });

  await Promise.all([
    setDoc(usernameIndexRef, {
      uid: credential.user.uid,
      email,
      type: "username",
      value: username,
      createdAt: firestoreServerTimestamp(),
    }),
    setDoc(phoneIndexRef, {
      uid: credential.user.uid,
      email,
      type: "phone",
      value: phone,
      createdAt: firestoreServerTimestamp(),
    }),
  ]);

  return {
    uid: credential.user.uid,
    email,
    username,
    phone,
  };
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function logout() {
  await signOut(auth);
}
