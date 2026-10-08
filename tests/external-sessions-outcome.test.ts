/** @file Tests des issues, codes de sortie et statuts de délivrance du relay. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";
import {
  assessTarget,
  classifyDelivery,
  launchOutcome,
  RELAY_EXIT_CODES,
  refusalOutcome
} from "../src/externalSessions/outcome.js";
import type { ExchangeInterpretation, TargetProbe } from "../src/externalSessions/types.js";

const exited = (fields: Partial<ExternalProcessResult> = {}): ExternalProcessResult => ({
  started: true,
  pid: 1234,
  exitCode: 0,
  signal: null,
  forcedReturn: false,
  stdout: "",
  stderr: "",
  outputBytes: 0,
  durationMs: 1,
  ...fields
});
const notStarted = (fields: Partial<ExternalProcessResult>): ExternalProcessResult =>
  exited({ started: false, pid: undefined, exitCode: null, ...fields });
const reply: ExchangeInterpretation = {
  isError: false,
  reply: "OK",
  identity: "same-as-target",
  reportedSessionIds: [],
  observedModels: [],
  errors: []
};
const failure: ExchangeInterpretation = { ...reply, isError: true, reply: undefined, identity: "unavailable" };
const probe = (attachment: TargetProbe["attachment"]): TargetProbe => ({ attachment, activity: "unknown", processes: [], evidence: [] });

describe("codes de sortie", () => {
  test("table conforme au contrat (AGENTS.md, section Relay externe)", () => {
    assert.deepEqual({ ...RELAY_EXIT_CODES }, {
      "replied": 0,
      "internal-error": 1,
      "cli-failure": 2,
      "no-valid-reply": 2,
      "usage-limit": 2,
      "output-too-large": 2,
      "target-busy": 3,
      "target-state-unknown": 3,
      "target-not-open": 3,
      "neutralization-failed": 3,
      "timeout": 4,
      "identity-mismatch": 5,
      "session-not-found": 6,
      "command-not-found": 7,
      "invalid-request": 8,
      "cancelled": 130
    });
  });
});

describe("assessTarget", () => {
  test("seule une cible détachée est relayable ; un état inconnu est refusé", () => {
    assert.deepEqual(assessTarget(probe("detached")), { allowed: true });
    assert.deepEqual(assessTarget(probe("attached")), { allowed: false, status: "target-busy" });
    assert.deepEqual(assessTarget(probe("unknown")), { allowed: false, status: "target-state-unknown" });
  });
});

describe("refusalOutcome", () => {
  test("refus avant lancement, avec la raison d'un invalid-request", () => {
    assert.deepEqual(refusalOutcome({ status: "invalid-request", reason: "config-untrusted" }), { status: "invalid-request", exitCode: 8, reason: "config-untrusted" });
    assert.deepEqual(refusalOutcome({ status: "command-not-found" }), { status: "command-not-found", exitCode: 7 });
    assert.deepEqual(refusalOutcome({ status: "neutralization-failed" }), { status: "neutralization-failed", exitCode: 3 });
  });
});

describe("launchOutcome : priorités", () => {
  test("lancement impossible : dossier, exécutable, autre cause", () => {
    assert.deepEqual(launchOutcome({ process: notStarted({ launchFailure: "invalid-working-directory" }) }), { status: "invalid-request", exitCode: 8, reason: "invalid-working-directory" });
    assert.deepEqual(launchOutcome({ process: notStarted({ launchFailure: "command-not-found" }) }), { status: "command-not-found", exitCode: 7 });
    assert.equal(launchOutcome({ process: notStarted({ launchFailure: "spawn-failed" }) }).status, "cli-failure");
    assert.equal(launchOutcome({ process: notStarted({ stopReason: "cancelled" }) }).status, "cancelled");
  });

  test("un arrêt provoqué par Palabre l'emporte sur la sortie, même valide", () => {
    for (const stopReason of ["timeout", "output-too-large", "cancelled"] as const) {
      assert.equal(launchOutcome({ process: exited({ stopReason }), interpretation: reply }).status, stopReason);
    }
    assert.equal(launchOutcome({ process: exited({ stopReason: "output-too-large" }) }).exitCode, 2);
  });

  test("refus certain de la CLI avant réponse et identité", () => {
    assert.equal(launchOutcome({ process: exited({ exitCode: 1 }), interpretation: failure, certainRefusal: "target-busy" }).status, "target-busy");
    assert.equal(launchOutcome({ process: exited({ exitCode: 1 }), interpretation: failure, certainRefusal: "session-not-found" }).exitCode, 6);
  });

  test("réponse valide de la cible seulement ; autre session : identity-mismatch", () => {
    assert.deepEqual(launchOutcome({ process: exited(), interpretation: reply }), { status: "replied", exitCode: 0 });
    assert.equal(launchOutcome({ process: exited(), interpretation: { ...reply, identity: "mismatch" } }).status, "identity-mismatch");
    assert.equal(launchOutcome({ process: exited(), interpretation: { ...reply, identity: "unavailable" } }).status, "identity-mismatch");
    assert.equal(launchOutcome({ process: exited({ exitCode: 1 }), interpretation: { ...failure, identity: "mismatch" } }).status, "identity-mismatch");
  });

  test("limite d'usage, puis échec générique selon le code de sortie", () => {
    assert.equal(launchOutcome({ process: exited({ exitCode: 1 }), interpretation: failure, usageLimit: true }).status, "usage-limit");
    assert.equal(launchOutcome({ process: exited(), interpretation: failure }).status, "no-valid-reply");
    assert.equal(launchOutcome({ process: exited({ exitCode: 1 }), interpretation: failure }).status, "cli-failure");
    assert.equal(launchOutcome({ process: exited({ exitCode: null }) }).status, "cli-failure");
  });
});

describe("classifyDelivery", () => {
  const persisted = { persisted: true as const, inActiveBranch: false as const, detail: "" };
  const absent = { persisted: false as const, inActiveBranch: "unknown" as const, detail: "" };

  const unreadable = { persisted: "unknown" as const, inActiveBranch: "unknown" as const, detail: "" };

  test("sans lancement : not-delivered, persisted false sans preuve contraire", () => {
    for (const outcome of [refusalOutcome({ status: "cancelled" }), launchOutcome({ process: notStarted({ launchFailure: "spawn-failed" }) })]) {
      assert.deepEqual(classifyDelivery({ outcome, launched: false }), { status: "not-delivered", persisted: false, inActiveBranch: false });
      assert.deepEqual(classifyDelivery({ outcome, launched: false, evidence: absent }), { status: "not-delivered", persisted: false, inActiveBranch: "unknown" });
    }
  });

  test("refus certain après lancement : not-delivered, preuve rapportée telle quelle", () => {
    for (const status of ["target-busy", "session-not-found"] as const) {
      const outcome = launchOutcome({ process: exited({ exitCode: 1 }), certainRefusal: status });
      assert.deepEqual(classifyDelivery({ outcome, launched: true, evidence: absent }), { status: "not-delivered", persisted: false, inActiveBranch: "unknown" });
      assert.deepEqual(classifyDelivery({ outcome, launched: true, evidence: unreadable }), { status: "not-delivered", persisted: "unknown", inActiveBranch: "unknown" });
      assert.deepEqual(classifyDelivery({ outcome, launched: true }), { status: "not-delivered", persisted: "unknown", inActiveBranch: "unknown" });
    }
  });

  test("refus contredit par l'historique (target-busy, nonce persisté) : persisted-no-reply, preuve conservée", () => {
    const outcome = launchOutcome({ process: exited({ exitCode: 1 }), certainRefusal: "target-busy" });
    assert.deepEqual(classifyDelivery({ outcome, launched: true, evidence: persisted }), { status: "persisted-no-reply", persisted: true, inActiveBranch: false });
  });

  test("un nonce persisté n'autorise jamais not-delivered, quelle que soit l'issue", () => {
    for (const status of Object.keys(RELAY_EXIT_CODES) as Array<keyof typeof RELAY_EXIT_CODES>) {
      const outcome = status === "invalid-request" ? refusalOutcome({ status, reason: "invalid-arguments" }) : { status, exitCode: RELAY_EXIT_CODES[status] };
      for (const launched of [true, false]) {
        const verdict = classifyDelivery({ outcome, launched, evidence: persisted });
        assert.notEqual(verdict.status, "not-delivered", `${status}, launched=${launched}`);
        assert.equal(verdict.persisted, true);
      }
    }
  });

  test("replied, persisted-no-reply, unknown ; la branche active reste un diagnostic", () => {
    const replied = launchOutcome({ process: exited(), interpretation: reply });
    assert.deepEqual(classifyDelivery({ outcome: replied, launched: true, evidence: persisted }), { status: "replied", persisted: true, inActiveBranch: false });
    for (const stopReason of ["timeout", "output-too-large", "cancelled"] as const) {
      const outcome = launchOutcome({ process: exited({ stopReason }) });
      assert.equal(classifyDelivery({ outcome, launched: true, evidence: persisted }).status, "persisted-no-reply", stopReason);
      assert.equal(classifyDelivery({ outcome, launched: true, evidence: absent }).status, "unknown", stopReason);
      assert.equal(classifyDelivery({ outcome, launched: true }).status, "unknown", stopReason);
    }
  });
});
