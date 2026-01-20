import { describe, it, expect } from "bun:test";
import {
  buildAppleAuthUrl,
  generateClientSecret,
  parseIdToken,
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
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));

    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KEYID12345");
  });

  it("includes correct payload claims", async () => {
    const jwt = await generateClientSecret(TEST_CONFIG);
    const [, payloadB64] = jwt.split(".");
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

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

describe("parseIdToken", () => {
  function createTestIdToken(claims: Partial<AppleIdTokenClaims>): string {
    const header = { alg: "RS256", kid: "test" };
    const payload: AppleIdTokenClaims = {
      iss: "https://appleid.apple.com",
      aud: "in.sids.admin.auth",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      sub: "user123",
      ...claims,
    };

    const encodeB64 = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${encodeB64(header)}.${encodeB64(payload)}.fake-signature`;
  }

  it("parses valid ID token", () => {
    const token = createTestIdToken({ email: "test@example.com" });
    const claims = parseIdToken(token, "in.sids.admin.auth");

    expect(claims.iss).toBe("https://appleid.apple.com");
    expect(claims.aud).toBe("in.sids.admin.auth");
    expect(claims.email).toBe("test@example.com");
  });

  it("throws for invalid format", () => {
    expect(() => parseIdToken("not-a-jwt", "client-id")).toThrow("Invalid ID token format");
  });

  it("throws for invalid issuer", () => {
    const token = createTestIdToken({ iss: "https://evil.com" });
    expect(() => parseIdToken(token, "in.sids.admin.auth")).toThrow("Invalid issuer");
  });

  it("throws for invalid audience", () => {
    const token = createTestIdToken({ aud: "wrong-client-id" });
    expect(() => parseIdToken(token, "in.sids.admin.auth")).toThrow("Invalid audience");
  });

  it("throws for expired token", () => {
    const token = createTestIdToken({ exp: Math.floor(Date.now() / 1000) - 100 });
    expect(() => parseIdToken(token, "in.sids.admin.auth")).toThrow("ID token has expired");
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
