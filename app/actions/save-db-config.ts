"use server"

import { adminDb } from "@/lib/firebase-admin"
import { encrypt } from "@/lib/server/encryption"

export async function saveDbConfig(data: {
  clientId: string
  host: string
  port: number
  database: string
  username: string
  password: string
}) {
  const encryptedUsername = encrypt(data.username)
  const encryptedPassword = encrypt(data.password)

  await adminDb
    .collection("db_configs")
    .doc(data.clientId)
    .set({
      host: data.host,
      port: data.port,
      database: data.database,
      username: encryptedUsername,
      password: encryptedPassword,
      updatedAt: new Date(),
    })

  return { success: true }
}
