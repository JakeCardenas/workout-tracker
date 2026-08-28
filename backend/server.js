import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { States } from "./db.js";
import * as Auth from "./auth.js";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(here, "..", "frontend");
const PORT = Number(process.env.PORT || 4174);
const MAX_STATE = 2 * 1024 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
};

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ "Content-Type": "application/json" }, headers));
  res.end(payload);
};

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_STATE) {
        fail(new Auth.HttpError(413, "That is too much data"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        fail(new Auth.HttpError(400, "Malformed request"));
      }
    });
    req.on("error", fail);
  });
}

function requireUser(req) {
  const session = Auth.readSession(req.headers.cookie);
  if (!session) throw new Auth.HttpError(401, "Sign in first");
  return session;
}

async function api(req, res, path) {
  const secure = req.headers["x-forwarded-proto"] === "https";
  const ip = req.socket.remoteAddress || "unknown";

  if (path === "/api/register" && req.method === "POST") {
    const body = await readBody(req);
    const email = Auth.normalise(body.email);
    Auth.validate(email, body.password);
    const user = Auth.register(email, body.password);
    const { token, expires } = Auth.startSession(user.id);
    return send(res, 201, { user }, { "Set-Cookie": Auth.cookie(token, expires, secure) });
  }

  if (path === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const email = Auth.normalise(body.email);
    const key = `${ip}:${email}`;
    Auth.throttle(key);
    try {
      const user = Auth.login(email, String(body.password || ""));
      Auth.clearFailures(key);
      const { token, expires } = Auth.startSession(user.id);
      return send(res, 200, { user }, { "Set-Cookie": Auth.cookie(token, expires, secure) });
    } catch (err) {
      Auth.noteFailure(key);
      throw err;
    }
  }

  if (path === "/api/logout" && req.method === "POST") {
    const session = Auth.readSession(req.headers.cookie);
    if (session) Auth.endSession(session.token);
    return send(res, 200, { ok: true }, { "Set-Cookie": Auth.clearCookie() });
  }

  if (path === "/api/me" && req.method === "GET") {
    const session = Auth.readSession(req.headers.cookie);
    return send(res, 200, { user: session ? { id: session.user.id, email: session.user.email } : null });
  }

  if (path === "/api/state" && req.method === "GET") {
    const { user } = requireUser(req);
    const row = States.get(user.id);
    return send(res, 200, {
      state: row ? JSON.parse(row.state) : null,
      updatedAt: row ? row.updated_at : null,
    });
  }

  if (path === "/api/state" && req.method === "PUT") {
    const { user } = requireUser(req);
    const body = await readBody(req);
    if (!body.state || typeof body.state !== "object") {
      throw new Auth.HttpError(422, "Expected a state object");
    }
    States.put(user.id, JSON.stringify(body.state));
    return send(res, 200, { ok: true });
  }

  throw new Auth.HttpError(404, "No such endpoint");
}

async function serveFile(res, path) {
  const target = resolve(SITE, "." + decodeURIComponent(path));
  if (!target.startsWith(SITE)) return send(res, 403, "Forbidden", { "Content-Type": "text/plain" });

  let file = target;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(SITE, "index.html");
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    send(res, 404, "Not found", { "Content-Type": "text/plain" });
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    if (path.startsWith("/api/")) return await api(req, res, path);
    return await serveFile(res, path);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    send(res, status, { error: err.message || "Something went wrong" });
  }
}).listen(PORT, () => {
  console.log(`reps running on http://localhost:${PORT}`);
});
