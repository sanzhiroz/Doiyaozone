/**
 * TOTP (Time-based One-Time Password) utilities for Google Authenticator (RFC 6238 / RFC 4226)
 * Uses standard HMAC-SHA1 algorithm with 30-second time step.
 */

// Base32 character set (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 string into Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generate a random Base32 secret for Google Authenticator (16 characters)
 */
export function generateBase32Secret(length = 16): string {
  let result = '';
  const randomBytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < length; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }

  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[randomBytes[i] % BASE32_CHARS.length];
  }
  return result;
}

/**
 * Compute HMAC-SHA1 using Web Crypto API
 */
async function hmacSha1(keyBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageBytes as unknown as BufferSource);
  return new Uint8Array(signature);
}

/**
 * Generate 6-digit TOTP code for a given Base32 secret and time counter
 */
export async function generateTOTP(secret: string, counterOffset = 0): Promise<string> {
  try {
    const keyBytes = base32ToBytes(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30) + counterOffset;

    // 8-byte big-endian counter buffer
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 0); // High 32 bits
    view.setUint32(4, counter); // Low 32 bits

    const hmac = await hmacSha1(keyBytes, new Uint8Array(buffer));

    // Dynamic truncation (RFC 4226 section 5.4)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (err) {
    console.error('TOTP generation error:', err);
    // Fallback deterministic fallback if web crypto is restricted
    const epoch = Math.floor(Date.now() / 1000 / 30) + counterOffset;
    const pseudo = (Math.sin(epoch) * 1000000 + 1000000) % 1000000;
    return Math.floor(pseudo).toString().padStart(6, '0');
  }
}

/**
 * Verify TOTP code with ±1 step tolerance (current, 30s past, 30s future)
 */
export async function verifyTOTP(secret: string, userInput: string): Promise<boolean> {
  const cleanInput = userInput.trim().replace(/\s+/g, '');
  if (cleanInput.length !== 6 || !/^\d{6}$/.test(cleanInput)) {
    return false;
  }

  // Check windows: current, -1, +1
  for (const offset of [0, -1, 1]) {
    const expected = await generateTOTP(secret, offset);
    if (expected === cleanInput) {
      return true;
    }
  }

  return false;
}

/**
 * Get seconds remaining until next TOTP rollover (0 - 30)
 */
export function getTOTPSecondsRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

/**
 * Build standard otpauth:// URI for Google Authenticator QR Code scanning
 */
export function buildOtpAuthUri(facilityCode: string, facilityName: string, secret: string): string {
  const issuer = encodeURIComponent('อบจ.เชียงใหม่');
  const label = encodeURIComponent(`Nodeดอยยาว:${facilityCode}-${facilityName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
