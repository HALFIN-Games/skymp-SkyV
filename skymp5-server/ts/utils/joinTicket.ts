import * as crypto from "crypto";
import * as fs from "fs";

export type JoinTicketClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  whitelisted: boolean;
  queue_points: number;
  reserved_ok: boolean;
  slots: number;
  player_type?: string;
};

function base64UrlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function parseJson<T>(buf: Buffer): T {
  return JSON.parse(buf.toString("utf8")) as T;
}

export class JoinTicketVerifier {
  constructor(
    private publicKeyPem: string,
    private expectedIssuer: string,
    private expectedAudience: string,
  ) { }

  static fromEnvOrDefaultFile(): JoinTicketVerifier {
    const issuer = process.env.JOIN_TICKET_ISSUER ?? "https://vokunrp.com";
    const audience = process.env.JOIN_TICKET_AUDIENCE ?? "skyv-game-server";

    const publicKeyPem =
      process.env.JOIN_TICKET_ED25519_PUBLIC_KEY_PEM ??
      (() => {
        const p = process.env.JOIN_TICKET_ED25519_PUBLIC_KEY_PATH ?? "join_ticket_ed25519_public.pem";
        return fs.readFileSync(p, "utf8");
      })();

    return new JoinTicketVerifier(publicKeyPem, issuer, audience);
  }

  verify(jwt: string, nowSeconds: number): JoinTicketClaims {
    const parts = jwt.split(".");
    if (parts.length !== 3) throw new Error("Bad JWT format");

    const [headerB64, payloadB64, sigB64] = parts;
    const header = parseJson<any>(base64UrlToBuffer(headerB64));
    const payload = parseJson<any>(base64UrlToBuffer(payloadB64));
    const sig = base64UrlToBuffer(sigB64);

    if (!header || header.alg !== "EdDSA") throw new Error("Unsupported alg");

    const data = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
    const ok = crypto.verify(
      null,
      data,
      crypto.createPublicKey(this.publicKeyPem),
      sig,
    );
    if (!ok) throw new Error("Invalid signature");

    const claims = payload as Partial<JoinTicketClaims>;
    if (!claims.iss || claims.iss !== this.expectedIssuer) throw new Error("Bad iss");

    const aud = claims.aud;
    const audOk =
      typeof aud === "string"
        ? aud === this.expectedAudience
        : Array.isArray(aud)
          ? aud.includes(this.expectedAudience)
          : false;
    if (!audOk) throw new Error("Bad aud");

    if (typeof claims.exp !== "number") throw new Error("Missing exp");
    if (claims.exp <= nowSeconds) throw new Error("Expired");

    if (typeof claims.iat !== "number") throw new Error("Missing iat");
    if (claims.iat > nowSeconds + 60) throw new Error("iat in future");

    if (typeof claims.sub !== "string" || claims.sub.length < 3) throw new Error("Bad sub");
    if (typeof claims.jti !== "string" || claims.jti.length < 8) throw new Error("Bad jti");

    if (typeof claims.whitelisted !== "boolean") throw new Error("Bad whitelisted");
    if (typeof claims.queue_points !== "number") throw new Error("Bad queue_points");
    if (typeof claims.reserved_ok !== "boolean") throw new Error("Bad reserved_ok");
    if (typeof claims.slots !== "number") throw new Error("Bad slots");

    return claims as JoinTicketClaims;
  }
}

