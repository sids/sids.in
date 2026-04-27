import { describe, it, expect } from "bun:test";
import {
  buildAppleAuthUrl,
  generateClientSecret,
  verifyIdToken,
  extractEmailFromClaims,
  type AppleAuthConfig,
  type AppleIdTokenClaims,
} from "./apple-auth.ts";

// Test ECDSA P-256 private key (for testing only)
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2
OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r
1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G
-----END PRIVATE KEY-----`;

const TEST_CONFIG: AppleAuthConfig = {
  clientId: "in.sids.admin.auth",
  teamId: "TEAMID1234",
  keyId: "KEYID12345",
  privateKey: TEST_PRIVATE_KEY,
  redirectUri: "https://sids.in/admin/callback",
};

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createSignedIdToken(claims: Partial<AppleIdTokenClaims> = {}) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;

  const keyId = "test-key";
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey) as JsonWebKey & Record<string, unknown>;
  publicJwk.kid = keyId;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const header = { alg: "RS256", kid: keyId };
  const payload: AppleIdTokenClaims = {
    iss: "https://appleid.apple.com",
    aud: "in.sids.admin.auth",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    sub: "user123",
    ...claims,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  return {
    token: `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`,
    publicJwk,
  };
}

function appleKeysFetch(publicJwk: Record<string, unknown>): (input: string) => Promise<Response> {
  return async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildAppleAuthUrl", () => {
  it("builds URL with correct base", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain("https://appleid.apple.com/auth/authorize");
  });

  it("includes client_id parameter", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain("client_id=in.sids.admin.auth");
  });

  it("includes redirect_uri parameter", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain(`redirect_uri=${encodeURIComponent("https://sids.in/admin/callback")}`);
  });

  it("includes response_type=code", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain("response_type=code");
  });

  it("includes response_mode=form_post", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain("response_mode=form_post");
  });

  it("includes scope=email", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state");
    expect(url).toContain("scope=email");
  });

  it("includes state parameter", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "my-csrf-state");
    expect(url).toContain("state=my-csrf-state");
  });

  it("includes nonce when provided", () => {
    const url = buildAppleAuthUrl(TEST_CONFIG, "test-state", "test-nonce");
    expect(url).toContain("nonce=test-nonce");
  });
});

describe("generateClientSecret", () => {
  it("generates a JWT with three parts", async () => {
    const jwt = await generateClientSecret(TEST_CONFIG);
    const parts = jwt.split(".");
    expect(parts.length).toBe(3);
  });

  it("includes correct header with alg and kid", async () => {
    const jwt = await generateClientSecret(TEST_CONFIG);
    const [headerB64] = jwt.split(".");
    const header = JSON.parse(atob(headerB64!.replace(/-/g, "+").replace(/_/g, "/")));

    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KEYID12345");
  });

  it("includes correct payload claims", async () => {
    const jwt = await generateClientSecret(TEST_CONFIG);
    const [, payloadB64] = jwt.split(".");
    const payload = JSON.parse(atob(payloadB64!.replace(/-/g, "+").replace(/_/g, "/")));

    expect(payload.iss).toBe("TEAMID1234");
    expect(payload.aud).toBe("https://appleid.apple.com");
    expect(payload.sub).toBe("in.sids.admin.auth");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("generates different JWTs for different configs", async () => {
    const jwt1 = await generateClientSecret(TEST_CONFIG);
    const jwt2 = await generateClientSecret({ ...TEST_CONFIG, teamId: "DIFFERENT" });
    expect(jwt1).not.toBe(jwt2);
  });
});

describe("verifyIdToken", () => {
  it("verifies and parses a valid ID token", async () => {
    const { token, publicJwk } = await createSignedIdToken({ email: "test@example.com" });
    const claims = await verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch(publicJwk));

    expect(claims.iss).toBe("https://appleid.apple.com");
    expect(claims.aud).toBe("in.sids.admin.auth");
    expect(claims.email).toBe("test@example.com");
  });

  it("verifies the nonce when provided", async () => {
    const { token, publicJwk } = await createSignedIdToken({ nonce: "expected-nonce" });
    const claims = await verifyIdToken(token, "in.sids.admin.auth", "expected-nonce", appleKeysFetch(publicJwk));

    expect(claims.nonce).toBe("expected-nonce");
  });

  it("throws for invalid format", async () => {
    await expect(verifyIdToken("not-a-jwt", "client-id", undefined, appleKeysFetch({}))).rejects.toThrow("Invalid ID token format");
  });

  it("throws for invalid issuer", async () => {
    const { token, publicJwk } = await createSignedIdToken({ iss: "https://evil.com" });
    await expect(verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch(publicJwk))).rejects.toThrow("Invalid issuer");
  });

  it("throws for invalid audience", async () => {
    const { token, publicJwk } = await createSignedIdToken({ aud: "wrong-client-id" });
    await expect(verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch(publicJwk))).rejects.toThrow("Invalid audience");
  });

  it("throws for expired token", async () => {
    const { token, publicJwk } = await createSignedIdToken({ exp: Math.floor(Date.now() / 1000) - 100 });
    await expect(verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch(publicJwk))).rejects.toThrow("ID token has expired");
  });

  it("throws for invalid signature", async () => {
    const { token } = await createSignedIdToken();
    const { publicJwk } = await createSignedIdToken();

    await expect(verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch(publicJwk))).rejects.toThrow("Invalid ID token signature");
  });

  it("throws for nonce mismatch", async () => {
    const { token, publicJwk } = await createSignedIdToken({ nonce: "actual-nonce" });

    await expect(verifyIdToken(token, "in.sids.admin.auth", "expected-nonce", appleKeysFetch(publicJwk))).rejects.toThrow("Invalid nonce");
  });

  it("throws when Apple does not provide a matching public key", async () => {
    const { token } = await createSignedIdToken();

    await expect(verifyIdToken(token, "in.sids.admin.auth", undefined, appleKeysFetch({ kid: "other-key" }))).rejects.toThrow("No matching Apple public key");
  });
});

describe("extractEmailFromClaims", () => {
  it("returns email when verified (boolean true)", () => {
    const claims: AppleIdTokenClaims = {
      iss: "https://appleid.apple.com",
      aud: "client",
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      sub: "user123",
      email: "test@example.com",
      email_verified: true,
    };

    expect(extractEmailFromClaims(claims)).toBe("test@example.com");
  });

  it("returns email when verified (string 'true')", () => {
    const claims: AppleIdTokenClaims = {
      iss: "https://appleid.apple.com",
      aud: "client",
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      sub: "user123",
      email: "test@example.com",
      email_verified: "true",
    };

    expect(extractEmailFromClaims(claims)).toBe("test@example.com");
  });

  it("returns null when email not verified", () => {
    const claims: AppleIdTokenClaims = {
      iss: "https://appleid.apple.com",
      aud: "client",
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      sub: "user123",
      email: "test@example.com",
      email_verified: false,
    };

    expect(extractEmailFromClaims(claims)).toBeNull();
  });

  it("returns null when no email claim", () => {
    const claims: AppleIdTokenClaims = {
      iss: "https://appleid.apple.com",
      aud: "client",
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      sub: "user123",
    };

    expect(extractEmailFromClaims(claims)).toBeNull();
  });
});
