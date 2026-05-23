import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Standard 32-byte key for AES-256. Fallback is for dev convenience only.
const getEncryptionKey = (): Buffer => {
  const envKey = typeof process !== "undefined" ? process.env.DB_ENCRYPTION_KEY : undefined;

  if (!envKey) {
    throw new Error(
      "[Security] DB_ENCRYPTION_KEY is not set in environment variables. " +
      "Generate a 64-char hex key and add it to your .env file:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (envKey.length !== 64) {
    // Not a 64-char hex — hash it to guarantee a valid 32-byte key
    return crypto.createHash("sha256").update(envKey).digest();
  }

  return Buffer.from(envKey, "hex");
};


/**
 * Encrypts a plain-text string using AES-256-GCM.
 * Returns an encrypted payload format: "ivHex:authTagHex:encryptedText"
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // standard 12-byte IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt configuration parameters.");
  }
}

/**
 * Decrypts an encrypted payload format "ivHex:authTagHex:encryptedText" back to plain text.
 */
export function decrypt(encryptedData: string): string {
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");
    if (!ivHex || !authTagHex || !encryptedText) {
      throw new Error("Invalid encrypted format. Expected iv:authTag:content");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt configuration parameters (check your DB_ENCRYPTION_KEY).");
  }
}
