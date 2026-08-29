import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { authenticate, login, register } from "./auth.js";
import { createPool, initializeDatabase, type Database } from "./db.js";
import {
  claimNextMapJob,
  completeMapJob,
  decodeMapContent,
  enqueueMapJob,
  getMapState,
  MapJobNotFoundError,
  MapJobOwnershipError,
  MapJobStateConflictError,
} from "./mapJobs.js";
import { getSave, putSave } from "./saves.js";

interface ApiConfig {
  secret: string;
  workerKey?: string;
  webDist?: string;
}

const defaultWebDist = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function sendFile(response: ServerResponse, filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath).toLowerCase()] ??
        "application/octet-stream",
      "content-length": content.length,
    });
    response.end(content);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "EISDIR")
    ) {
      return false;
    }
    throw error;
  }
}

async function serveWeb(
  response: ServerResponse,
  path: string,
  webDist: string,
): Promise<boolean> {
  const assetPath = resolve(webDist, `.${decodeURIComponent(path)}`);
  const isInsideWebDist =
    assetPath === webDist || assetPath.startsWith(`${webDist}${sep}`);
  if (isInsideWebDist && await sendFile(response, assetPath)) return true;
  return sendFile(response, resolve(webDist, "index.html"));
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 12 * 1024 * 1024) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const body = await readBody(request);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function hasWorkerKey(request: IncomingMessage, expected?: string): boolean {
  if (!expected) return false;
  const header = request.headers["x-maps-worker-key"];
  const bearer = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  return header === expected || bearer === expected;
}

async function requireUser(
  request: IncomingMessage,
  response: ServerResponse,
  pool: Database,
  secret: string,
): Promise<string | null> {
  const userId = await authenticate(
    pool,
    secret,
    request.headers.authorization,
  );
  if (!userId) sendJson(response, 401, { error: "Unauthorized" });
  return userId;
}

export function createApiServer(pool: Database, config: ApiConfig) {
  return createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (method === "GET" && path === "/api/health") {
        await pool.query("SELECT 1");
        return sendJson(response, 200, {
          ok: true,
          storage: "postgres",
          maps: config.workerKey ? "ok" : "unconfigured",
        });
      }

      if (method === "POST" && path === "/api/auth/register") {
        const body = (await readJson(request)) as {
          email?: unknown;
          password?: unknown;
        };
        const token = await register(
          pool,
          config.secret,
          body.email,
          body.password,
        );
        return sendJson(response, 201, { token });
      }

      if (method === "POST" && path === "/api/auth/login") {
        const body = (await readJson(request)) as {
          email?: unknown;
          password?: unknown;
        };
        const token = await login(pool, config.secret, body.email, body.password);
        return token
          ? sendJson(response, 200, { token })
          : sendJson(response, 401, { error: "Invalid email or password" });
      }

      const saveMatch = path.match(/^\/api\/saves\/([^/]+)$/);
      if (saveMatch && (method === "GET" || method === "PUT")) {
        const userId = await requireUser(
          request,
          response,
          pool,
          config.secret,
        );
        if (!userId) return;
        const runId = decodeURIComponent(saveMatch[1]);
        if (method === "PUT") {
          const saved = await putSave(pool, runId, userId, await readJson(request));
          return saved
            ? sendJson(response, 200, { ok: true })
            : sendJson(response, 403, { error: "Run belongs to another user" });
        }
        const save = await getSave(pool, runId, userId);
        return save
          ? sendJson(response, 200, save)
          : sendJson(response, 404, { error: "Save not found" });
      }

      const enqueueMatch = path.match(/^\/api\/runs\/([^/]+)\/map-jobs$/);
      if (enqueueMatch && method === "POST") {
        const userId = await requireUser(
          request,
          response,
          pool,
          config.secret,
        );
        if (!userId) return;
        const job = await enqueueMapJob(
          pool,
          decodeURIComponent(enqueueMatch[1]),
          userId,
          await readJson(request),
        );
        return job
          ? sendJson(response, 201, job)
          : sendJson(response, 409, { error: "Identical map job is pending" });
      }

      const mapMatch = path.match(/^\/api\/runs\/([^/]+)\/map$/);
      if (mapMatch && method === "GET") {
        const userId = await requireUser(
          request,
          response,
          pool,
          config.secret,
        );
        if (!userId) return;
        const state = await getMapState(
          pool,
          decodeURIComponent(mapMatch[1]),
          userId,
        );
        if (!state) return sendJson(response, 404, { error: "Map job not found" });
        if (state.content) {
          response.writeHead(200, {
            "content-type": "image/png",
            "content-length": state.content.length,
            "cache-control": "private, no-store",
            "x-map-version": String(state.mapVersion),
          });
          return response.end(state.content);
        }
        return sendJson(response, 202, {
          status: state.status,
          mapVersion: state.mapVersion,
          url: null,
          error: state.error,
        });
      }

      if (path === "/api/internal/map-jobs/next" && method === "GET") {
        if (!hasWorkerKey(request, config.workerKey)) {
          return sendJson(response, 401, { error: "Unauthorized" });
        }
        const job = await claimNextMapJob(pool);
        return job
          ? sendJson(response, 200, job)
          : sendJson(response, 204, null);
      }

      const completeMatch = path.match(
        /^\/api\/internal\/map-jobs\/([^/]+)\/complete$/,
      );
      if (completeMatch && method === "POST") {
        if (!hasWorkerKey(request, config.workerKey)) {
          return sendJson(response, 401, { error: "Unauthorized" });
        }
        const contentType = request.headers["content-type"] ?? "";
        let content: Buffer | null = null;
        let error: string | null = null;
        if (contentType.startsWith("image/png")) {
          content = await readBody(request);
        } else {
          const body = (await readJson(request)) as { error?: unknown };
          error = typeof body.error === "string" ? body.error : null;
          if (!error) content = decodeMapContent(body);
        }
        const mapVersion = await completeMapJob(
          pool,
          decodeURIComponent(completeMatch[1]),
          content,
          error,
        );
        if (error) return sendJson(response, 200, { status: "failed" });
        return mapVersion === null
          ? sendJson(response, 404, { error: "Map job not found" })
          : sendJson(response, 200, { status: "ready", mapVersion });
      }

      if (method === "GET" && path !== "/api" && !path.startsWith("/api/")) {
        if (await serveWeb(response, path, config.webDist ?? defaultWebDist)) return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      const pgCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : null;
      const message = error instanceof Error ? error.message : "Internal error";
      if (error instanceof MapJobNotFoundError) {
        return sendJson(response, 404, { error: message });
      }
      if (error instanceof MapJobOwnershipError) {
        return sendJson(response, 403, { error: message });
      }
      if (error instanceof MapJobStateConflictError) {
        return sendJson(response, 409, { error: message });
      }
      if (pgCode === "23505") {
        return sendJson(response, 409, { error: "Resource already exists" });
      }
      if (
        message.includes("required") ||
        message.includes("must be") ||
        message.includes("at least") ||
        message.includes("too large")
      ) {
        return sendJson(response, 400, { error: message });
      }
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

async function main(): Promise<void> {
  const secret = process.env.LOCALMANAGER_SECRET;
  if (!secret) throw new Error("LOCALMANAGER_SECRET is required");
  const pool = createPool();
  await initializeDatabase(pool);
  const server = createApiServer(pool, {
    secret,
    workerKey: process.env.MAPS_WORKER_KEY,
    webDist: process.env.WEB_DIST,
  });
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => {
    console.log(`LocalManager API listening on port ${port}`);
  });
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
