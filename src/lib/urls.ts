export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  return url.toString();
}

export async function isPublicHttpUrl(value: unknown, signal?: AbortSignal): Promise<boolean> {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return false;
  }

  const url = new URL(normalized);
  return isPublicHostname(url.hostname, signal);
}

export async function fetchPublicHttpUrl(input: string, init?: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = input;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    if (!(await isPublicHttpUrl(current, init?.signal ?? undefined))) {
      throw new UnsafeUrlError("URL must resolve to a public HTTP(S) address");
    }

    const response = await fetch(current, {
      ...init,
      redirect: "manual",
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get("Location");
    if (!location) {
      return response;
    }

    current = new URL(location, current).toString();
  }

  throw new UnsafeUrlError("Too many redirects");
}

async function isPublicHostname(hostname: string, signal?: AbortSignal): Promise<boolean> {
  const host = normalizeHostname(hostname);
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    return false;
  }

  const literalIp = parseIpAddress(host);
  if (literalIp) {
    return !isPrivateOrReservedIp(literalIp);
  }

  const addresses = await resolveHostAddresses(host, signal);
  if (addresses.length === 0) {
    return false;
  }

  return addresses.every((address) => {
    const parsed = parseIpAddress(address);
    return parsed !== null && !isPrivateOrReservedIp(parsed);
  });
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

async function resolveHostAddresses(hostname: string, signal?: AbortSignal): Promise<string[]> {
  const [aRecords, aaaaRecords] = await Promise.all([
    resolveDnsRecords(hostname, "A", signal),
    resolveDnsRecords(hostname, "AAAA", signal),
  ]);

  return [...aRecords, ...aaaaRecords].filter((address) => parseIpAddress(address) !== null);
}

async function resolveDnsRecords(hostname: string, type: "A" | "AAAA", signal?: AbortSignal): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/dns-json",
    },
    signal,
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json<{ Answer?: Array<{ data?: string }> }>();
  return (payload.Answer ?? [])
    .map((answer) => answer.data)
    .filter((data): data is string => typeof data === "string");
}

function parseIpAddress(value: string): { family: 4; parts: [number, number, number, number] } | { family: 6; parts: number[] } | null {
  const host = normalizeHostname(value);
  const ipv4 = parseIpv4Address(host);
  if (ipv4) {
    return { family: 4, parts: ipv4 };
  }

  const ipv6 = parseIpv6Address(host);
  if (ipv6) {
    return { family: 6, parts: ipv6 };
  }

  return null;
}

function parseIpv4Address(value: string): [number, number, number, number] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return null;
    }

    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  });

  if (numbers.some((part) => part === null)) {
    return null;
  }

  return numbers as [number, number, number, number];
}

function parseIpv6Address(value: string): number[] | null {
  const withoutZone = value.split("%")[0]!;
  const ipv4Match = withoutZone.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  let address = withoutZone;

  if (ipv4Match?.[1]) {
    const ipv4 = parseIpv4Address(ipv4Match[1]);
    if (!ipv4) {
      return null;
    }

    const [a, b, c, d] = ipv4;
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    address = withoutZone.slice(0, -ipv4Match[1].length) + `${high}:${low}`;
  }

  if (!address.includes(":")) {
    return null;
  }

  const compressedParts = address.split("::");
  if (compressedParts.length > 2) {
    return null;
  }

  const left = splitIpv6Side(compressedParts[0] ?? "");
  const right = splitIpv6Side(compressedParts[1] ?? "");
  if (!left || !right) {
    return null;
  }

  const missingCount = compressedParts.length === 2 ? 8 - left.length - right.length : 0;
  if (missingCount < 0 || (compressedParts.length === 1 && left.length !== 8)) {
    return null;
  }

  const parts = [...left, ...Array(missingCount).fill(0), ...right];
  return parts.length === 8 ? parts : null;
}

function splitIpv6Side(value: string): number[] | null {
  if (!value) {
    return [];
  }

  return value.split(":").map((part) => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return null;
    }

    return parseInt(part, 16);
  }).every((part) => part !== null)
    ? value.split(":").map((part) => parseInt(part, 16))
    : null;
}

function isPrivateOrReservedIp(address: { family: 4; parts: [number, number, number, number] } | { family: 6; parts: number[] }): boolean {
  if (address.family === 4) {
    return isPrivateOrReservedIpv4(address.parts);
  }

  return isPrivateOrReservedIpv6(address.parts);
}

function isPrivateOrReservedIpv4([a, b, c]: [number, number, number, number]): boolean {
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function isPrivateOrReservedIpv6(parts: number[]): boolean {
  const [first] = parts;
  const isUnspecified = parts.every((part) => part === 0);
  const isLoopback = parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
  const isUniqueLocal = (first! & 0xfe00) === 0xfc00;
  const isLinkLocal = (first! & 0xffc0) === 0xfe80;
  const isMulticast = (first! & 0xff00) === 0xff00;
  const isDocumentation = first === 0x2001 && parts[1] === 0x0db8;
  const isIpv4Mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  const isIpv4Compatible = parts.slice(0, 6).every((part) => part === 0) && (parts[6] !== 0 || parts[7] !== 0);

  if (isUnspecified || isLoopback || isUniqueLocal || isLinkLocal || isMulticast || isDocumentation) {
    return true;
  }

  if (isIpv4Mapped || isIpv4Compatible) {
    const ipv4: [number, number, number, number] = [
      parts[6]! >> 8,
      parts[6]! & 0xff,
      parts[7]! >> 8,
      parts[7]! & 0xff,
    ];
    return isPrivateOrReservedIpv4(ipv4);
  }

  return false;
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
