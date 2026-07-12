import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const fixtureNames = ["debate-with-summary", "ask-multiline", "interruption"];

for (const name of fixtureNames) {
  test(`NDJSON fixture ${name} is valid v1 line-delimited JSON`, async () => {
    const file = path.join("tests", "fixtures", "ndjson", `${name}.ndjson`);
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    assert.ok(lines.length > 1);
    for (const line of lines) {
      const event = JSON.parse(line);
      assert.equal(event.v, 1);
      assert.equal(typeof event.type, "string");
    }
  });
}