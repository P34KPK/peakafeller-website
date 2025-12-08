// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// TODO: Replace the following with your app's Firebase project configuration
// You can get this from the Firebase Console (https://console.firebase.google.com/)
// 1. Create a new project
// 2. Add a Web App
// 3. Copy the 'firebaseConfig' object
const firebaseConfig = {
    apiKey: "API_KEY_HERE",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT_ID.firebasestorage.app",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage, collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc, ref, uploadBytes, getDownloadURL, deleteObject };
