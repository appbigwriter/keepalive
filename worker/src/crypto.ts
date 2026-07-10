import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// In a real scenario, this would be loaded from an environment variable outside of the source code.
const MASTER_KEY_HEX = process.env.KEEPALIVE_MASTER_KEY || crypto.randomBytes(32).toString('hex');

// Ensure the key is exactly 32 bytes for AES-256
const getMasterKey = () => {
    if (MASTER_KEY_HEX.length !== 64) {
        throw new Error('KEEPALIVE_MASTER_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(MASTER_KEY_HEX, 'hex');
};

/**
 * Encrypts a string using AES-256-GCM.
 * @param text The text to encrypt.
 * @returns The encrypted string, containing iv, auth tag, and ciphertext.
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string previously encrypted by this module.
 * @param encryptedData The string containing iv, auth tag, and ciphertext.
 * @returns The decrypted original text.
 */
export function decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    const [ivHex, authTagHex, encryptedText] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
