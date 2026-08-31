// =========================================================
// FIREBASE CONFIG
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUg7l99dLX04OrqM_Jlb6-58y1A9BB3N8",
  authDomain: "rpg-ee17e.firebaseapp.com",
  projectId: "rpg-ee17e",
  storageBucket: "rpg-ee17e.firebasestorage.app",
  messagingSenderId: "136442258825",
  appId: "1:136442258825:web:b7dadfb6c2d6d3ed5a2d58"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
