"use client"

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"
import { getAuth, Auth } from "firebase/auth"
import { getFirestore, Firestore } from "firebase/firestore"
import { firebaseConfig } from "./firebase-config"

let app!: FirebaseApp
let auth!: Auth
let db!: Firestore

try {
  // Initialize Firebase (singleton pattern)
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
  auth = getAuth(app)
  db = getFirestore(app)
} catch (error) {
  console.error("[v0] Firebase initialization error:", error)
  throw error
}

export { auth, db }
