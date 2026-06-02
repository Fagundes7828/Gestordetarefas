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

import { initializeApp } from "firebase/app";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDuiLRMdKbWPePxLNguQSTHiQHEjS54Lwg",
  authDomain:        "gestordetarefasfagundes.firebaseapp.com",
  projectId:         "gestordetarefasfagundes",
  storageBucket:     "gestordetarefasfagundes.firebasestorage.app",
  messagingSenderId: "895076014281",
  appId:             "1:895076014281:web:59cf894813ecb8ea1d1518"
  measurementId:     "G-BRL22K8J1B"
};

// Inicializa o Firebase e exporta o que o resto do app vai usar
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
