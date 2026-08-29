import assert from "node:assert/strict";
import test from "node:test";

import { decodeMapContent, extractOverlaySlots } from "../src/mapJobs.js";

test("map jobs accept overlay slots directly", () => {
  assert.deepEqual(
    extractOverlaySlots({ overlaySlots: ["centro", "zona_nord"] }),
    ["centro", "zona_nord"],
  );
});

test("map jobs accept slots from a game-state overlay", () => {
  assert.deepEqual(
    extractOverlaySlots({ overlay: { activeSlots: ["viabilita_est"] } }),
    ["viabilita_est"],
  );
});

test("map jobs reject malformed overlay slots", () => {
  assert.throws(() => extractOverlaySlots({ overlaySlots: [42] }), /overlaySlots/);
});

test("map completion decodes base64 PNG content", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  assert.deepEqual(decodeMapContent({ contentBase64: png.toString("base64") }), png);
});
