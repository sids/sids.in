const COOKIE_NAME = "__session";
const STATE_COOKIE_NAME = "__oauth_state";
const MAX_AGE_SECONDS = 604800; // 7 days
const STATE_MAX_AGE_SECONDS = 600; // 10 minutes

interface SessionPayload {
  email: string;
  exp: number;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return base64UrlEncode(new Uint8Array(signature));
}

async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
  const expectedSignature = await hmacSign(secret, data);
  return timingSafeEqual(expectedSignature, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padding);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createSessionCookie(email: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload: SessionPayload = { email, exp };
  const payloadStr = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(payloadStr));
  const signature = await hmacSign(secret, encodedPayload);
  const value = `${encodedPayload}.${signature}`;

  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=${MAX_AGE_SECONDS}`;
}

export async function verifySession(
  request: Request,
  secret: string,
): Promise<{ email: string } | null> {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionValue = cookies[COOKIE_NAME];

  if (!sessionValue) {
    return null;
  }

  const parts = sessionValue.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const encodedPayload = parts[0]!;
  const signature = parts[1]!;

  const isValid = await hmacVerify(secret, encodedPayload, signature);
  if (!isValid) {
    return null;
  }

  let payload: SessionPayload;
  try {
    const decoded = base64UrlDecode(encodedPayload);
    payload = JSON.parse(new TextDecoder().decode(decoded)) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  if (!payload.email || typeof payload.email !== "string") {
    return null;
  }

  return { email: payload.email };
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0`;
}

export function generateStateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createStateCookie(state: string, secret: string): Promise<string> {
  const signature = await hmacSign(secret, state);
  const value = `${state}.${signature}`;
  // SameSite=None required for cross-site POST from Apple's OAuth callback
  return `${STATE_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=None; Path=/admin; Max-Age=${STATE_MAX_AGE_SECONDS}`;
}

export async function verifyStateToken(
  request: Request,
  state: string,
  secret: string,
): Promise<boolean> {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const storedValue = cookies[STATE_COOKIE_NAME];

  if (!storedValue) {
    return false;
  }

  const parts = storedValue.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const storedState = parts[0]!;
  const signature = parts[1]!;

  const isValidSignature = await hmacVerify(secret, storedState, signature);
  if (!isValidSignature) {
    return false;
  }

  return timingSafeEqual(storedState, state);
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/admin; Max-Age=0`;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.trim().split("=");
    if (name) {
      cookies[name] = valueParts.join("=");
    }
  }
  return cookies;
}
