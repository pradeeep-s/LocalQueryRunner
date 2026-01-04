import crypto from "crypto"

const MASTER_KEY = process.env.ENCRYPTION_SECRET!
console.log("ENCRYPTION_SECRET:", process.env.ENCRYPTION_SECRET)


if (!MASTER_KEY) {
  throw new Error("❌ ENCRYPTION_SECRET is missing in environment variables")
}

const ALGORITHM = "aes-256-cbc"
const ITERATIONS = 100000
const KEY_LENGTH = 32
const DIGEST = "sha256"

console.log("ENCRYPTION_SECRET:", process.env.ENCRYPTION_SECRET)


function deriveKey(salt: Buffer) {
  return crypto.pbkdf2Sync(
    MASTER_KEY,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    DIGEST
  )
}

// 🔒 Encrypt
export function encrypt(text: string): string {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const key = deriveKey(salt)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  return `${salt.toString("hex")}:${iv.toString("hex")}:${encrypted}`
}

// 🔓 Decrypt
export function decrypt(data: string): string {
  const [saltHex, ivHex, encrypted] = data.split(":")

  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const key = deriveKey(salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}
