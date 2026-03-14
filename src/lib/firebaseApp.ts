/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app'

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

export const app = initializeApp(firebaseConfig)

// App Check — blocks scripted/bot writes via reCAPTCHA v3 (invisible to real users).
// Requires VITE_RECAPTCHA_SITE_KEY to be set; skipped in dev unless key is present.
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    if (import.meta.env.DEV) {
      // Enables the debug token flow in the Firebase console for local development.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  })
}
