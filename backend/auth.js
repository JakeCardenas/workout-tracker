import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { Users, Sessions } from "./db.js";

const SESSION_DAYS = 30;
const COOKIE = "reps_session";
const KEYLEN = 64;

const attempts = new Map();

function hashPassword(password, salt) {
  return scryptSync(password, salt, KEYLEN).toString("hex");
}

function sameHash(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export const normalise = (email) => String(email || "").trim().toLowerCase();

export function validate(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, "Enter a valid email address");
  if (String(password).length < 8) throw new HttpError(422, "Use a password of at least 8 characters");
  if (String(password).length > 200) throw new HttpError(422, "That password is too long");
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// a crude in-memory brake, enough to make guessing tedious
export function throttle(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && now - rec.at > 15 * 60000) attempts.delete(key);
  const live = attempts.get(key);
  if (live && live.count >= 10) {
    throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  }
}

export function noteFailure(key) {
  const rec = attempts.get(key) || { count: 0, at: Date.now() };
  rec.count += 1;
  rec.at = Date.now();
  attempts.set(key, rec);
}

export const clearFailures = (key) => attempts.delete(key);

export function register(email, password) {
  if (Users.byEmail(email)) throw new HttpError(409, "That email is already registered");
  const salt = randomBytes(16).toString("hex");
  const user = {
    id: randomUUID(),
    email,
    salt,
    hash: hashPassword(password, salt),
    created_at: Date.now(),
  };
  Users.create(user);
  return { id: user.id, email: user.email };
}

export function login(email, password) {
  const found = Users.byEmail(email);
  // hash even when the account is missing, so both paths take the same time
  const salt = found ? found.salt : randomBytes(16).toString("hex");
  const attempt = hashPassword(password, salt);
  if (!found || !sameHash(attempt, found.hash)) {
    throw new HttpError(401, "Invalid email or password");
  }
  return { id: found.id, email: found.email };
}

export function startSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = Date.now() + SESSION_DAYS * 86400000;
  Sessions.create(tokenHash(token), userId, expires);
  Sessions.sweep();
  return { token, expires };
}

export function readSession(cookieHeader) {
  const token = parseCookies(cookieHeader)[COOKIE];
  if (!token) return null;
  const row = Sessions.find(tokenHash(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    Sessions.drop(row.token_hash);
    return null;
  }
  const user = Users.byId(row.user_id);
  return user ? { user, token } : null;
}

export function endSession(token) {
  if (token) Sessions.drop(tokenHash(token));
}

export function cookie(token, expires, secure) {
  const bits = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor((expires - Date.now()) / 1000)}`,
  ];
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}
