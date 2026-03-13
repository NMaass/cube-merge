import { getFirestore } from 'firebase/firestore/lite'
import { app, FIREBASE_CONFIGURED } from './firebaseApp'

export { FIREBASE_CONFIGURED }

export const db = getFirestore(app)
