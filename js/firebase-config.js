// =========================================================
// FIREBASE CONFIG
// =========================================================

// Firebase App
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";


// Firestore
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// Authentication
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// Storage
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


// =========================================================
// CONFIGURAÇÃO DO PROJETO
// =========================================================

const firebaseConfig = {

  apiKey:
    "AIzaSyBUg7l99dLX04OrqM_Jlb6-58y1A9BB3N8",

  authDomain:
    "rpg-ee17e.firebaseapp.com",

  projectId:
    "rpg-ee17e",

  storageBucket:
    "rpg-ee17e.firebasestorage.app",

  messagingSenderId:
    "136442258825",

  appId:
    "1:136442258825:web:b7dadfb6c2d6d3ed5a2d58"

};


// =========================================================
// INICIALIZAÇÃO
// =========================================================

const app =
  initializeApp(firebaseConfig);


// =========================================================
// SERVIÇOS
// =========================================================

export const db =
  getFirestore(app);

export const auth =
  getAuth(app);

export const storage =
  getStorage(app);


// =========================================================
// INSTÂNCIA PRINCIPAL
// =========================================================

export default app;