// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc, getDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// TODO: Replace the following with your app's Firebase project configuration
// You can get this from the Firebase Console (https://console.firebase.google.com/)
// 1. Create a new project
// 2. Add a Web App
// 3. Copy the 'firebaseConfig' object
const firebaseConfig = {
    apiKey: "AIzaSyADapmzaJaw5AWqG0e2Oy9RdBuYUCntv-U",
    authDomain: "peakafeller-beta.firebaseapp.com",
    projectId: "peakafeller-beta",
    storageBucket: "peakafeller-beta.firebasestorage.app",
    messagingSenderId: "177943684632",
    appId: "1:177943684632:web:6822f7c55ab874a268056d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage, collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject, getDoc, increment };
