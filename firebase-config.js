import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey:            "AIzaSyAP2GJ1DqnBHAHyb7FaSPujAGJU6pmd7JE",
  authDomain:        "mf-agenda.firebaseapp.com",
  projectId:         "mf-agenda",
  storageBucket:     "mf-agenda.firebasestorage.app",
  messagingSenderId: "963529011516",
  appId:             "1:963529011516:web:4bba670194382b1ec9ee39",
  measurementId:     "G-DMYEFR6QDN"
};
 
// Inicializa o Firebase e exporta o que o resto do app vai usar
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
 
