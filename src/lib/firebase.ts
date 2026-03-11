/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  console.error(
    '[Firebase] Missing VITE_FIREBASE_PROJECT_ID — copy .env.example to .env and fill in your Firebase credentials.'
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_PROJECT_ID

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
