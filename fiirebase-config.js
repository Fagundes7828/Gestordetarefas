// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDuiLRMdKbWPePxLNguQSTHiQHEjS54Lwg",
  authDomain: "gestordetarefasfagundes.firebaseapp.com",
  projectId: "gestordetarefasfagundes",
  storageBucket: "gestordetarefasfagundes.firebasestorage.app",
  messagingSenderId: "895076014281",
  appId: "1:895076014281:web:59cf894813ecb8ea1d1518",
  measurementId: "G-BRL22K8J1B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
