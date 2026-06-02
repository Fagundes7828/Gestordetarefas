// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAP2GJ1DqnBHAHyb7FaSPujAGJU6pmd7JE",
  authDomain: "mf-agenda.firebaseapp.com",
  projectId: "mf-agenda",
  storageBucket: "mf-agenda.firebasestorage.app",
  messagingSenderId: "963529011516",
  appId: "1:963529011516:web:4bba670194382b1ec9ee39",
  measurementId: "G-DMYEFR6QDN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
