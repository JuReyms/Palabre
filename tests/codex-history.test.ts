/**
 * @file Résolution stricte de la chaîne de segments d'un historique Codex (`codexHistory.ts`) :
 * forme antérieure d'un seul fichier, chaîne avec chevauchements, refus d'une chaîne cassée ou
 * ambiguë, en-tête encore partiel. Historiques factices uniquement, aucun Codex réel.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { historyParts, resolveCodexHistory } from "../src/externalSessions/codexHistory.js";
import { appendSegmentRows, writeRoot, writeSegment, type Row } from "./fixtures/external-sessions/codex-segments.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-codex-history-"));
after(() => rmSync(root, { recursive: true, force: true }));
const THREAD = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const SEG1 = "0199bbbb-0000-7000-8000-000000000001";
const SEG2 = "0199bbbb-0000-7000-8000-000000000002";
const SEG3 = "0199bbbb-0000-7000-8000-000000000003";
let counter = 0;
const home = () => path.join(root, `home-${++counter}`);

const event = (type: string, turn: string): Row => ({ type: "event_msg", payload: { type, turn_id: turn } });
const finished = (turn: string): Row[] => [event("task_started", turn), { type: "turn_context", payload: { turn_id: turn } }, event("task_complete", turn)];
const aborted = (turn: string): Row[] => [event("task_started", turn), { type: "turn_context", payload: { turn_id: turn } }, event("turn_aborted", turn)];

/** Racine avec un tour terminé puis un tour interrompu (ordinaux 4 à 6), comme avant une reprise. */
function threeSegments(dir: string) {
  const first = writeRoot(dir, THREAD, root, [...finished("a"), ...aborted("b")], { paginated: true });
  const second = writeSegment(dir, THREAD, root, first, SEG1, 4, [...finished("c"), ...aborted("d")], { day: "23" });
  const third = writeSegment(dir, THREAD, root, second, SEG2, second.nextOrdinal - 3, finished("e"), { day: "26", archived: true });
  return { first, second, third };
}

describe("historique Codex : forme antérieure", () => {
  test("un seul fichier sans history_mode : chaîne d'un élément, entièrement active", () => {
    const dir = home();
    const file = writeRoot(dir, THREAD, root, finished("a"));
    const result = resolveCodexHistory(dir, THREAD.toUpperCase());
    assert.equal(result.status, "found");
    if (result.status !== "found") return;
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0]!.path, file.path);
    assert.equal(result.segments[0]!.activeEnd, file.size);
    assert.equal(result.pending, 0);
  });

  test("aucun fichier : not-found ; identifiant invalide : not-found", () => {
    assert.deepEqual(resolveCodexHistory(home(), THREAD), { status: "not-found" });
    assert.deepEqual(resolveCodexHistory(root, "pas-un-uuid"), { status: "not-found" });
  });
});

describe("historique Codex : chaîne de segments", () => {
  test("racine, segment puis segment archivé : ordre des liens, coupures et chevauchements", () => {
    const dir = home();
    const { first, second, third } = threeSegments(dir);
    const result = resolveCodexHistory(dir, THREAD);
    assert.equal(result.status, "found");
    if (result.status !== "found") return;
    assert.deepEqual(result.segments.map((segment) => segment.path), [first.path, second.path, third.path]);
    assert.deepEqual(result.segments.map((segment) => segment.id), [THREAD, SEG1, SEG2]);
    // La fin des deux premiers fichiers (tour interrompu) est abandonnée par le segment suivant.
    assert.equal(result.segments[0]!.activeEnd, first.offsets.get(4));
    assert.ok(result.segments[0]!.activeEnd < first.size);
    assert.equal(result.segments[1]!.activeEnd, second.offsets.get(second.nextOrdinal - 3));
    assert.equal(result.segments[2]!.activeEnd, third.size);
  });

  test("flux logique depuis un ancrage : ancrage depuis l'octet 0, puis segments sans leur première ligne", () => {
    const dir = home();
    const { first, second, third } = threeSegments(dir);
    const result = resolveCodexHistory(dir, THREAD);
    assert.equal(result.status, "found");
    if (result.status !== "found") return;
    const [a, b, c] = result.segments;
    assert.deepEqual(historyParts(result.segments, 1), [
      { path: second.path, start: 0, end: b!.activeEnd, logicalStart: 0 },
      { path: third.path, start: c!.headerBytes, end: third.size, logicalStart: b!.activeEnd }
    ]);
    assert.equal(historyParts(result.segments, 0)[1]!.logicalStart, a!.activeEnd);
    assert.equal(first.path, a!.path);
  });

  test("coupure en fin de fichier : acceptée, rien n'est abandonné", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, finished("b"));
    const result = resolveCodexHistory(dir, THREAD);
    assert.equal(result.status, "found");
    assert.equal(result.status === "found" && result.segments[0]!.activeEnd, first.size);
  });

  test("segment dont la première ligne est encore partielle : écarté et compté", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, [], { header: '{"timestamp":"2026-10-27T11:00:00Z","ordinal":4,"type":"session_' });
    const result = resolveCodexHistory(dir, THREAD);
    assert.equal(result.status, "found");
    if (result.status !== "found") return;
    assert.equal(result.segments.length, 1);
    assert.equal(result.pending, 1);
  });
});

describe("historique Codex : refus d'une chaîne cassée ou ambiguë", () => {
  const refused = (dir: string) => {
    const result = resolveCodexHistory(dir, THREAD);
    return result.status === "refused" ? result.reason : result.status;
  };

  test("deux racines, même archivée : duplicate-root", () => {
    const dir = home();
    writeRoot(dir, THREAD, root, finished("a"));
    writeRoot(dir, THREAD, root, finished("a"), { archived: true });
    assert.equal(refused(dir), "duplicate-root");
  });

  test("segments sans racine : missing-root", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { name: "ignore.jsonl" });
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, finished("b"), { override: { baseId: THREAD } });
    assert.equal(refused(dir), "missing-root");
  });

  test("lien vers un fichier absent : broken-link", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, finished("b"), { override: { baseId: SEG3 } });
    assert.equal(refused(dir), "broken-link");
  });

  test("deux segments sur le même fichier : fork, jamais le plus récent", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, [...finished("a"), ...aborted("b")], { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, 4, finished("c"), { day: "23" });
    writeSegment(dir, THREAD, root, first, SEG2, 4, finished("d"), { day: "26" });
    assert.equal(refused(dir), "fork");
  });

  test("segments qui se désignent l'un l'autre : unreachable-segment", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    const loopA = writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, [], { override: { baseId: SEG2 } });
    writeSegment(dir, THREAD, root, loopA, SEG2, loopA.nextOrdinal, [], { override: { baseId: SEG1 } });
    assert.equal(refused(dir), "unreachable-segment");
  });

  test("deux fichiers pour un même segment : duplicate-segment", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, finished("b"));
    writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, finished("b"), { archived: true });
    assert.equal(refused(dir), "duplicate-segment");
  });

  test("coupures incohérentes : invalid-cut", () => {
    const cases: { name: string; override: { endOffset?: number; headerOrdinal?: number } }[] = [
      { name: "au-delà du fichier", override: { endOffset: 1_000_000 } },
      { name: "hors frontière de ligne", override: { endOffset: 0 } },
      { name: "ordinal du segment différent", override: { headerOrdinal: 9 } }
    ];
    for (const { name, override } of cases) {
      const dir = home();
      const first = writeRoot(dir, THREAD, root, [...finished("a"), ...aborted("b")], { paginated: true });
      const offset = override.endOffset === 0 ? first.offsets.get(4)! + 3 : override.endOffset;
      writeSegment(dir, THREAD, root, first, SEG1, 4, finished("c"), { override: { ...override, endOffset: offset } });
      assert.equal(refused(dir), "invalid-cut", name);
    }
  });

  test("ligne à la coupure d'un autre ordinal : invalid-cut", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, [...finished("a"), ...aborted("b")], { paginated: true });
    writeSegment(dir, THREAD, root, first, SEG1, 4, finished("c"), { override: { endOffset: first.offsets.get(5) } });
    assert.equal(refused(dir), "invalid-cut");
  });

  test("en-têtes invalides : autre conversation, racine liée, segment sans base ou non paginé", () => {
    const single = (row: Row) => {
      const dir = home();
      const file = writeRoot(dir, THREAD, root, []);
      writeFileSync(file.path, `${JSON.stringify(row)}\n`);
      return dir;
    };
    assert.equal(refused(single({ type: "session_meta", payload: { id: SEG3, cwd: root } })), "invalid-header", "autre conversation");
    assert.equal(refused(single({ ordinal: 0, type: "session_meta", payload: { id: THREAD, cwd: root, history_base: { thread_id: THREAD } } })), "invalid-header", "racine liée");

    const twoRoots = home();
    writeRoot(twoRoots, THREAD, root, []);
    writeFileSync(path.join(twoRoots, "sessions", "2026", "10", "19", `rollout-x-${THREAD}.jsonl`), "{}\n");
    assert.equal(refused(twoRoots), "duplicate-root", "doublon refusé avant toute lecture, même illisible");

    for (const override of [{ withoutBase: true }, { mode: "full" }]) {
      const dir = home();
      const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
      writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, [], { override });
      assert.equal(refused(dir), "invalid-header", JSON.stringify(override));
    }
  });

  test("la tête grandit après résolution : sa partie active suit la taille lue", () => {
    const dir = home();
    const first = writeRoot(dir, THREAD, root, finished("a"), { paginated: true });
    const second = writeSegment(dir, THREAD, root, first, SEG1, first.nextOrdinal, []);
    const before = resolveCodexHistory(dir, THREAD);
    appendSegmentRows(second, finished("b"));
    const after = resolveCodexHistory(dir, THREAD);
    assert.ok(before.status === "found" && after.status === "found");
    if (before.status !== "found" || after.status !== "found") return;
    assert.ok(after.segments[1]!.activeEnd > before.segments[1]!.activeEnd);
  });
});
