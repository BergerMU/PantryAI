// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API,
  authDomain: "inventory-management-9d207.firebaseapp.com",
  projectId: "inventory-management-9d207",
  storageBucket: "inventory-management-9d207.appspot.com",
  messagingSenderId: "807601819415",
  appId: "1:807601819415:web:3964ba01f74af408a03152",
  measurementId: "G-QEJ863ZG5E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export {firestore}