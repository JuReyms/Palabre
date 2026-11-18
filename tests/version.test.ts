/** @file Vérification de version npm sans réseau, avec des réponses HTTP simulées. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { getLatestPackageVersion } from "../src/version.js";

test("une réponse npm normale donne la version publiée", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response('{"version":"0.23.0"}'));
  assert.equal(await getLatestPackageVersion(), "0.23.0");
});

test("une réponse npm dépassant 1 Mio est abandonnée avant la fin du flux", async t => {
  let pulls = 0;
  let cancelled = false;
  const encoder = new TextEncoder();
  // JSON valide si le lecteur consomme tout le flux, sans Content-Length.
  const chunks = [
    encoder.encode('{"version":"0.23.0","ignored":"'),
    new Uint8Array(1024 * 1024).fill(97),
    encoder.encode('"}')
  ];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunks[pulls++]!);
      if (pulls === chunks.length) controller.close();
    },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  t.mock.method(globalThis, "fetch", async () => new Response(body));
  assert.equal(await getLatestPackageVersion(), undefined);
  assert.equal(pulls, 2);
  assert.equal(cancelled, true);
});
