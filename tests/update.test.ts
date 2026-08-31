/** @file Contrats purs du diagnostic de canal et des plans de mise à jour. */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  canApplyUpdate,
  createUpdatePlan,
  detectInstallationChannel,
  formatUpdateStep,
  hasAvailableUpdate,
  type UpdateInfo
} from "../src/update.js";

test("detectInstallationChannel matches only the exact global package root", () => {
  const root = path.join("C:", "Users", "test", "AppData", "Local", "pnpm", "global", "5", "node_modules");
  assert.equal(
    detectInstallationChannel(path.join(root, "palabre"), { "pnpm-global": [root] }),
    "pnpm-global"
  );
  assert.equal(
    detectInstallationChannel(path.join(root, "other-package"), { "pnpm-global": [root] }),
    "unknown"
  );
});

test("createUpdatePlan preserves each package manager syntax and pins the resolved release", () => {
  assert.deepEqual(createUpdatePlan("npm-global", "0.17.0"), [
    { command: "npm", args: ["install", "--global", "palabre@0.17.0"] }
  ]);
  assert.deepEqual(createUpdatePlan("pnpm-global", "0.17.0"), [
    { command: "pnpm", args: ["add", "--global", "palabre@0.17.0"] }
  ]);
  assert.deepEqual(createUpdatePlan("yarn-global", "0.17.0"), [
    { command: "yarn", args: ["global", "add", "palabre@0.17.0"] }
  ]);
  assert.deepEqual(createUpdatePlan("bun-global", "0.17.0"), [
    { command: "bun", args: ["add", "--global", "palabre@0.17.0"] }
  ]);
  assert.deepEqual(createUpdatePlan("unknown", "0.17.0"), []);
});

test("source updates keep the existing explicit checkout workflow", () => {
  assert.deepEqual(createUpdatePlan("source"), [
    { command: "git", args: ["pull", "--ff-only"] },
    { command: "pnpm", args: ["install"] },
    { command: "pnpm", args: ["build"] },
    { command: "pnpm", args: ["link", "--global"] }
  ]);
});

test("update availability never authorizes an ambiguous install", () => {
  const packageInfo: UpdateInfo = {
    version: "0.16.0",
    latestVersion: "0.17.0",
    projectRoot: "C:\\packages\\palabre",
    sourceCheckout: false,
    channel: "pnpm-global",
    steps: createUpdatePlan("pnpm-global", "0.17.0")
  };
  assert.equal(hasAvailableUpdate(packageInfo), true);
  assert.equal(canApplyUpdate(packageInfo), true);
  assert.equal(canApplyUpdate({ ...packageInfo, channel: "unknown", steps: [] }), false);
  assert.equal(canApplyUpdate({ ...packageInfo, latestVersion: "0.16.0" }), false);
});

test("formatUpdateStep keeps commands readable without shell interpolation", () => {
  assert.equal(
    formatUpdateStep({ command: "pnpm", args: ["add", "--global", "palabre@0.17.0"] }),
    "pnpm add --global palabre@0.17.0"
  );
  assert.equal(formatUpdateStep({ command: "git", args: ["-C", "C:\\a folder", "pull"] }), 'git -C "C:\\a folder" pull');
});
