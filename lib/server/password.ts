const encoder = new TextEncoder();
const iterations = 120000;

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    key,
    256
  );

  return new Uint8Array(bits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export function createToken(prefix: string) {
  return `${prefix}_${bytesToBase64Url(randomBytes(24))}`;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `pbkdf2_sha256$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(
    hash
  )}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, storedIterations, encodedSalt, encodedHash] =
    storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || storedIterations !== String(iterations)) {
    return false;
  }

  const salt = base64UrlToBytes(encodedSalt);
  const expected = base64UrlToBytes(encodedHash);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
