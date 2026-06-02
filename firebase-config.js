// =========================================================
//  CONFIGURAÇÃO DO FIREBASE
// ---------------------------------------------------------
//  ATENÇÃO: troque os valores abaixo pelos dados do SEU projeto.
//  Você pega esses dados no Console do Firebase:
//  Configurações do projeto > Seus aplicativos > Configuração do SDK
//
//  (Pode deixar esses valores aqui mesmo. Para apps web do Firebase
//   eles não são segredo — a segurança real vem das Regras do Firestore
//   e da aba Authentication, que você configura no console.)
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "COLE_SUA_API_KEY_AQUI",
  authDomain:        "SEU-PROJETO.firebaseapp.com",
  projectId:         "SEU-PROJETO",
  storageBucket:     "SEU-PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:xxxxxxxxxxxx"
};

// Inicializa o Firebase e exporta o que o resto do app vai usar
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
