/** @file Ordre exit/close et drainage du serveur possédé : processus et kill entièrement simulés. */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { test } from "node:test";
import { CopyFailure } from "../src/externalSessions/opencodeCopy.js";
import { startOwnedServer } from "../src/externalSessions/opencodeTransport.js";

/** Pas de PID système utilisé : toutes les demandes de kill sont seulement enregistrées. */
function fixture() {
  const child = Object.assign(new EventEmitter(), {
    pid: 123, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), unref() {}
  });
  const kills: number[] = [];
  const server = startOwnedServer({ command: "fake", prefixArgs: [] }, process.cwd(), {}, new AbortController().signal, {
    spawnProcess: (() => child as unknown as ChildProcess) as typeof spawn,
    killTree: pid => { kills.push(pid); }
  });
  const announce = () => child.stdout.write('{"url":"http://127.0.0.1:12345"}\n');
  const close = () => child.emit("close", 0, null);
  return { child, kills, server, announce, close };
}

test("serveur : EOF demandé avant exit est normal, même si close suit plus tard", async () => {
  const w = fixture(); w.announce(); await w.server.ready;
  const stopped = w.server.stop(new AbortController().signal);
  w.child.emit("exit", 0, null); w.close();
  assert.equal(await stopped, true); assert.equal(w.server.failure(), undefined); assert.deepEqual(w.kills, []);
});

test("serveur : exit non demandé avant stop reste un échec après close", async () => {
  const w = fixture(); w.announce(); await w.server.ready;
  w.child.emit("exit", 1, null);
  assert.throws(() => w.server.failed(), (e: unknown) => e instanceof CopyFailure && e.diagnostic === "server-closed");
  const stopped = w.server.stop(new AbortController().signal); w.close();
  assert.equal(await stopped, true); assert.equal(w.server.failure()?.diagnostic, "server-closed"); assert.deepEqual(w.kills, []);
});

test("serveur : dernier chunk après exit garde le plafond plus précis que server-closed", async () => {
  const w = fixture(); w.announce(); await w.server.ready;
  w.child.emit("exit", 1, null);
  const stopped = w.server.stop(new AbortController().signal);
  w.child.stderr.write(Buffer.alloc(4 * 1024 * 1024 + 1)); w.close();
  assert.equal(await stopped, true); assert.equal(w.server.failure()?.status, "output-too-large");
  assert.equal(w.server.failure()?.diagnostic, "server-output-limit"); assert.deepEqual(w.kills, []);
});

test("serveur : exit avant URL libère ready sans attendre close des flux", async () => {
  const w = fixture(); w.child.emit("exit", 1, null);
  await assert.rejects(w.server.ready, (e: unknown) => e instanceof CopyFailure && e.diagnostic === "server-closed");
  const stopped = w.server.stop(new AbortController().signal); w.close();
  assert.equal(await stopped, true); assert.equal(w.server.failure()?.status, "cli-failure");
});

test("serveur : rafale au-delà du plafond ne demande qu'un seul kill", async () => {
  const w = fixture(); w.announce(); await w.server.ready;
  w.child.stdout.write(Buffer.alloc(4 * 1024 * 1024 + 1));
  w.child.stderr.write(Buffer.alloc(100)); w.child.stdout.write(Buffer.alloc(100));
  const stopped = w.server.stop(new AbortController().signal);
  w.child.emit("exit", null, "SIGKILL"); w.close();
  assert.equal(await stopped, true); assert.deepEqual(w.kills, [123]); assert.equal(w.server.failure()?.status, "output-too-large");
});
