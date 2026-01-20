const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

export interface AppleAuthConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  redirectUri: string;
}

export interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
}

export interface AppleIdTokenClaims {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

export function buildAppleAuthUrl(config: AppleAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    response_mode: "form_post",
    scope: "email",
    state,
  });

  return `${APPLE_AUTH_URL}?${params.toString()}`;
}

export async function generateClientSecret(config: AppleAuthConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15777000; // ~6 months

  const header = {
    alg: "ES256",
    kid: config.keyId,
  };

  const payload = {
    iss: config.teamId,
    iat: now,
    exp,
    aud: "https://appleid.apple.com",
    sub: config.clientId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(config.privateKey);
  const signature = await signWithECDSA(privateKey, signingInput);

  return `${signingInput}.${signature}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"],
  );
}

async function signWithECDSA(key: CryptoKey, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    key,
    encoder.encode(data),
  );

  return base64UrlEncode(new Uint8Array(signatureBuffer));
}

export async function exchangeCodeForTokens(
  code: string,
  config: AppleAuthConfig,
): Promise<AppleTokenResponse> {
  const clientSecret = await generateClientSecret(config);

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apple token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<AppleTokenResponse>;
}

export function parseIdToken(idToken: string, clientId: string): AppleIdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token format");
  }

  const payloadBase64 = parts[1]!;
  const payloadJson = base64UrlDecode(payloadBase64);
  const claims = JSON.parse(payloadJson) as AppleIdTokenClaims;

  if (claims.iss !== "https://appleid.apple.com") {
    throw new Error(`Invalid issuer: ${claims.iss}`);
  }

  if (claims.aud !== clientId) {
    throw new Error(`Invalid audience: ${claims.aud}`);
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    throw new Error("ID token has expired");
  }

  return claims;
}

export function extractEmailFromClaims(claims: AppleIdTokenClaims): string | null {
  if (!claims.email) {
    return null;
  }

  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (!emailVerified) {
    return null;
  }

  return claims.email;
}

function base64UrlEncode(input: string | Uint8Array): string {
  let data: Uint8Array;
  if (typeof input === "string") {
    data = new TextEncoder().encode(input);
  } else {
    data = input;
  }

  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padding);
  return atob(base64);
}
