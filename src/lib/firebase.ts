import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDaCjRwOnDycxKLiY0tM4-ALThbWKDSHas",
    authDomain: "origin-triva.firebaseapp.com",
    projectId: "origin-triva",
    storageBucket: "origin-triva.firebasestorage.app",
    messagingSenderId: "957519337794",
    appId: "1:957519337794:web:c06567b31e8a69c70890db",
    measurementId: "G-FHKCYWMBYF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
