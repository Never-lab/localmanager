import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionToken,
  hashPassword,
  isSessionValid,
  sessionTokenHash,
  verifyPassword,
} from "../src/auth.js";

test("passwords shorter than eight characters are rejected", async () => {
  await assert.rejects(() => hashPassword("short"), /at least 8/);
});

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("correct horse");

  assert.equal(await verifyPassword("correct horse", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("session token hashes are secret-bound HMAC values", () => {
  const token = createSessionToken();

  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(sessionTokenHash(token, "secret"), sessionTokenHash(token, "secret"));
  assert.notEqual(sessionTokenHash(token, "secret"), sessionTokenHash(token, "other"));
});

test("sessions enforce two-hour idle and seven-day absolute limits", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  assert.equal(
    isSessionValid(
      new Date("2026-08-22T12:00:00.001Z"),
      new Date("2026-08-29T10:00:00.001Z"),
      now,
    ),
    true,
  );
  assert.equal(
    isSessionValid(
      new Date("2026-08-22T12:00:00.000Z"),
      new Date("2026-08-29T11:59:00.000Z"),
      now,
    ),
    false,
  );
  assert.equal(
    isSessionValid(
      new Date("2026-08-29T11:00:00.000Z"),
      new Date("2026-08-29T10:00:00.000Z"),
      now,
    ),
    false,
  );
});
