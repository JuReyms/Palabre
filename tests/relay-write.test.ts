/** @file Accords ponctuels et écriture Relay : transports Git/Codex factices, aucun modèle. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, access, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prepareWrite, readWriteRequest, approveWrite, consumeWrite, createWriteWorktree, WriteCodexAdapter, writeCommands, writeReport, writeProfileArgs, type WriteRunner, type WriteRequest } from '../src/externalSessions/write.js';
import type { ExternalProcessResult } from '../src/externalSessions/process.js';
import { createTranslator } from '../src/i18n.js';
import { executeRelay, renderRelayText } from '../src/commands/relay.js';
import { renderRelayMarkdown } from '../src/output.js';
import { exchange } from '../src/externalSessions/adapter.js';
const SHA = 'a'.repeat(40);
/** Résultat de transport complet, sans processus ni réseau réel. */
function result(stdout = '', exitCode = 0): ExternalProcessResult { return { started: true, exitCode, signal: null, forcedReturn: false, stdout, stderr: '', durationMs: 1, outputBytes: Buffer.byteLength(stdout) }; }
/** Monde fictif propre à un test, avec Git injectable et sans configuration réelle. */
async function world() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'palabre-write-test-'));
  const repo = path.join(root, 'repo');
  await mkdir(repo);
  const calls: string[][] = [];
  const git: WriteRunner = async (_exe, args) => { calls.push([...args]); return result(args.includes('--show-toplevel') ? repo + '\n' : args.includes('rev-parse') ? SHA + '\n' : ''); };
  const r = await prepareWrite({ cwd: repo, args: ['relay', '--new', '--write', '--to', 'codex', 'task'], agent: 'codex', message: 'task', language: 'fr', config: path.join(root, 'config.json'), configHash: 'b'.repeat(64) }, path.join(root, 'store'), git);
  return { root, repo, store: path.join(root, 'store'), r, git, calls };
}
const human = { interactive: true, display: (_r: WriteRequest) => { }, confirm: async () => true };
test('préparation sans worktree ni appel modèle, commit exact et accord manquant refusé', async () => {
  const w = await world();
  assert.equal(w.r.commit, SHA);
  assert.ok(w.r.worktree.startsWith(w.store));
  await assert.rejects(access(w.r.worktree));
  assert.equal(w.calls.length, 2);
  await assert.rejects(consumeWrite(w.r, w.store), /approval/);
});
test('ni terminal absent ni refus humain ne créent d’accord', async () => {
  const w = await world();
  let asked = false;
  await assert.rejects(approveWrite(w.r.id, { ...human, interactive: false, confirm: async () => { asked = true; return true; } }, w.store), /human-terminal/);
  assert.equal(asked, false);
  await assert.rejects(approveWrite(w.r.id, { ...human, confirm: async () => false }, w.store), /declined/);
  await assert.rejects(access(path.join(w.store, w.r.id, 'approval.json')));
});
test('accord consommé une seule fois, y compris sous concurrence', async () => {
  const w = await world();
  await approveWrite(w.r.id, human, w.store);
  const outcomes = await Promise.allSettled([consumeWrite(w.r, w.store), consumeWrite(w.r, w.store)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  await assert.rejects(consumeWrite(w.r, w.store), /consumed/);
});
test('dérive pendant la confirmation refuse l’accord', async () => {
  const w = await world();
  await assert.rejects(approveWrite(w.r.id, {
    ...human, confirm: async () => {
      await writeFile(path.join(w.store, w.r.id, 'request.json'), JSON.stringify({ ...w.r, message: 'other' }));
      return true;
    }
  }, w.store), /changed/);
});
test('dérive après accord refuse sa consommation', async () => {
  const w = await world();
  await approveWrite(w.r.id, human, w.store);
  await writeFile(path.join(w.store, w.r.id, 'request.json'), JSON.stringify({ ...w.r, message: 'other' }));
  await assert.rejects(consumeWrite((await readWriteRequest(w.r.id, w.store)).request, w.store), /changed/);
});
test('contrat et taille du fichier refusés sans exécution', async () => {
  const w = await world();
  await assert.rejects(readWriteRequest('../bad', w.store));
  for (const value of [{ ...w.r, worktree: w.repo }, { ...w.r, configHash: 'bad' }, { ...w.r, args: ['relay'] }, { ...w.r, v: 2 }]) {
    await writeFile(path.join(w.store, w.r.id, 'request.json'), JSON.stringify(value));
    await assert.rejects(readWriteRequest(w.r.id, w.store));
  }
  await writeFile(path.join(w.store, w.r.id, 'request.json'), 'x'.repeat(256 * 1024 + 1));
  await assert.rejects(readWriteRequest(w.r.id, w.store));
});
test('worktree depuis le commit confirmé, sans nettoyage automatique', async () => {
  const w = await world();
  await createWriteWorktree(w.r, w.git);
  assert.ok(w.calls.some(a => a.includes('worktree') && a.includes(w.r.commit) && a.includes(w.r.worktree) && a.includes(w.r.branch)));
  assert.ok(w.calls.every(a => a.includes('core.fsmonitor=false')));
  assert.ok(!w.calls.some(a => a.includes('remove') || a.includes('reset')));
  await assert.rejects(createWriteWorktree(w.r, async () => result('c'.repeat(40))), /commit-changed/);
});
test('profil conserve les réglages utilisateur et refuse réseau, escalade et écritures Git', async () => {
  const w = await world();
  const a = writeProfileArgs(w.r).join(' ');
  assert.match(a, /extends=":read-only"/);
  assert.match(a, /network.enabled=false/);
  assert.match(a, /approval_policy="never"/);
  assert.match(a, /".git"="read"/);
  assert.match(a, /".claude"="read"/);
  assert.match(a, /web_search="disabled"/);
  const adapter = new WriteCodexAdapter(w.r);
  const args = adapter.createArgs({ agent: 'codex', provider: 'codex', sessionId: '', cwd: w.r.worktree }, ['--disable', 'plugins', '--disable', 'apps']);
  assert.ok(!args.includes('sandbox_mode="read-only"'));
  assert.ok(!args.includes('--ignore-rules'));
  assert.ok(!args.some(a => a.startsWith('developer_instructions=')));
  assert.ok(args.includes('notify=[]'));
  assert.ok(args.includes('memories'));
  assert.ok(args.includes('hooks'));
});
for (const mode of ['safe', 'outside-written', 'bad-output', 'failed', 'interrupted', 'mcp-failure'] as const) {
  test('préflight de confinement : ' + mode, async () => {
    const w = await world();
    await mkdir(w.r.worktree);
    let probes = 0;
    const adapter = new WriteCodexAdapter(w.r);
    let inside = '';
    const prepared = await adapter.prepare({ agent: 'codex', provider: 'codex', sessionId: '', cwd: w.r.worktree }, async (args) => {
      if (args[0] === 'mcp')
        return result(mode === 'mcp-failure' ? 'bad' : '[]');
      probes++;
      assert.equal(args[0], 'sandbox');
      assert.ok(args.includes(process.execPath));
      inside = args.at(-2)!;
      if (mode === 'safe' || mode === 'outside-written')
        await writeFile(inside, 'inside');
      if (mode === 'outside-written')
        await writeFile(path.join(path.dirname(w.r.worktree), 'outside-probe'), 'outside');
      return { ...result(mode === 'bad-output' ? 'bad' : JSON.stringify({ inside: true, outsideDenied: true }), mode === 'failed' ? 1 : 0), ...(mode === 'interrupted' ? { stopReason: 'timeout' as const } : {}) };
    });
    assert.equal(prepared.status, mode === 'safe' ? 'ready' : 'refused');
    assert.equal(probes, mode === 'mcp-failure' ? 0 : 1);
    if (inside)
      await assert.rejects(access(inside));
  });
}
test('preuves : pas de succès de tests déduit du modèle, codes et sorties conservés', () => {
  const model = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'tests passed' } });
  assert.deepEqual(writeCommands(model), []);
  const command = JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'node --test', exit_code: 1, status: 'failed', aggregated_output: 'spawn EPERM' } });
  assert.deepEqual(writeCommands(command), [{ command: 'node --test', exitCode: 1, status: 'failed', output: 'spawn EPERM' }]);
  assert.equal(writeCommands(command + '\n' + JSON.stringify({ type: 'item.started', item: { type: 'command_execution' } })).length, 1);
});
test('rapport Git indépendant, diff des fichiers suivis et nouveaux, erreurs conservées', async () => {
  const w = await world();
  await mkdir(w.r.worktree);
  await writeFile(path.join(w.r.worktree, 'new.txt'), 'new');
  const git: WriteRunner = async (_exe, args) => result(args.includes('rev-parse') ? SHA : args.includes('status') ? ' M prix.js\0?? new.txt\0' : 'tracked diff');
  const report = await writeReport(w.r, '', git);
  assert.deepEqual(report.files, ['prix.js', 'new.txt']);
  assert.match(report.diff, /new/);
  assert.match(report.diff, /tracked diff/);
  assert.equal(report.verification, 'observed-commands-only');
  assert.equal(report.diagnostic, undefined);
  const broken = await writeReport(w.r, '', async () => result('broken', 1));
  assert.equal(broken.diagnostic, 'git-unavailable');
});
test('export d’écriture ne porte pas la notice lecture seule', async () => {
  const w = await world();
  const report = await writeReport(w.r, '', async (_exe, args) => result(args.includes('rev-parse') ? SHA : ''));
  const text = renderRelayMarkdown({ from: null, to: { agent: 'codex', session: null, provider: 'codex' }, write: report, status: 'replied', delivery: { status: 'replied', persisted: true, inActiveBranch: true }, identity: null, observedModels: [], nonce: 'test', startedAt: new Date().toISOString(), message: 'task' }, createTranslator('fr'), { palabreVersion: 'test' });
  assert.match(text, /Écriture autorisée/);
  assert.match(text, /observed-commands-only/);
  assert.doesNotMatch(text, /lecture seule renforcée/);
  const rendered = renderRelayText({ status: 'replied', reply: 'tests passed', write: { ...report, commands: [{ command: 'node --test', exitCode: 1, status: 'failed', output: 'spawn EPERM' }] } } as Parameters<typeof renderRelayText>[0], createTranslator('fr'));
  assert.match(rendered.stderr, /code 1/);
  assert.match(rendered.stderr, /spawn EPERM/);
  assert.match(rendered.stderr, /aucun succès de test déduit/);
});
test('rapport signale les sorties tronquées et refuse un nouveau fichier derrière une jonction extérieure', async () => {
  const w = await world();
  await mkdir(w.r.worktree);
  const outside = path.join(w.root, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'file.txt'), 'FICTIONAL_NOT_TO_EXPORT');
  await symlink(outside, path.join(w.r.worktree, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const line = JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'test', exit_code: 1, status: 'failed', aggregated_output: 'x'.repeat(65537) } });
  const report = await writeReport(w.r, line, async (_exe, args) => result(args.includes('rev-parse') ? SHA : args.includes('status') ? '?? link/file.txt\0' : ''));
  assert.match(report.diagnostic!, /commands-truncated/);
  assert.match(report.diagnostic!, /file-outside-worktree/);
  assert.doesNotMatch(report.diff, /FICTIONAL_NOT_TO_EXPORT/);
});
for (const badProbe of [false, true])
  test('échange complet en faux transport : ' + (badProbe ? 'aucun modèle après préflight refusé' : 'fichier modifié et commande enregistrés'), async () => {
    const w = await world();
    await approveWrite(w.r.id, human, w.store);
    await consumeWrite(w.r, w.store);
    await createWriteWorktree(w.r, w.git);
    await mkdir(w.r.worktree);
    await writeFile(path.join(w.repo, 'prix.js'), 'original');
    await writeFile(path.join(w.r.worktree, 'prix.js'), 'original');
    const script = path.join(w.root, 'fake-codex.cjs');
    const counter = path.join(w.root, 'model-called');
    await writeFile(script, `const fs=require('node:fs');const a=process.argv.slice(2);if(a[0]==='mcp'){console.log('[]');process.exit(0)}if(a[0]==='sandbox'){${badProbe ? 'process.exit(1)' : "fs.writeFileSync(a.at(-2),'inside');console.log(JSON.stringify({inside:true,outsideDenied:true}));process.exit(0)"}}fs.writeFileSync(${JSON.stringify(counter)},'called');fs.writeFileSync('prix.js','corrected');console.log(JSON.stringify({type:'thread.started',thread_id:'0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee'}));console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution',command:'node --test',exit_code:1,status:'failed',aggregated_output:'spawn EPERM'}}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'tests passed'}}));console.log(JSON.stringify({type:'turn.completed'}));`);
    const target = { agent: 'codex', provider: 'codex' as const, sessionId: '', cwd: w.r.worktree };
    const exchanged = await exchange(new WriteCodexAdapter(w.r), { command: process.execPath, prefixArgs: [script] }, target, 'task', { timeoutMs: 10000, onCreatedSession: () => { } });
    if (badProbe) {
      assert.equal(exchanged.refusal?.status, 'invalid-request');
      await assert.rejects(access(counter));
      assert.equal(target.sessionId, '');
    }
    else {
      assert.equal(exchanged.process?.exitCode, 0);
      assert.equal(target.sessionId, '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee');
      assert.equal(await readFile(path.join(w.repo, 'prix.js'), 'utf8'), 'original');
      assert.equal(await readFile(path.join(w.r.worktree, 'prix.js'), 'utf8'), 'corrected');
      const report = await writeReport(w.r, exchanged.process!.stdout, async (_exe, args) => result(args.includes('rev-parse') ? SHA : args.includes('status') ? ' M prix.js\0' : 'diff verified'));
      assert.equal(report.commands[0]?.exitCode, 1);
      assert.equal(report.commands[0]?.output, 'spawn EPERM');
      assert.deepEqual(report.files, ['prix.js']);
      assert.equal(report.diff, 'diff verified');
    }
    await assert.rejects(consumeWrite(w.r, w.store), /consumed/);
  });
for (const args of [['--write', '--to', 'codex', 'task'], ['--new', '--write', '--open', '--to', 'codex', 'task'], ['--new', '--write', '--trust-config', '--to', 'codex', 'task'], ['--new', '--write', '--task', 'review', '--to', 'codex', 'task'], ['--new', '--write', '--yes', '--to', 'codex', 'task']]) {
  test('arguments refusés avant config / CLI : ' + args.join(' '), async () => { const r = await executeRelay(['relay', ...args]); assert.equal(r.exitCode, 8); assert.equal(r.delivery.status, 'not-delivered'); });
}
