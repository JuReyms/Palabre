/** @file Création Relay : identité structurée avant la fin, erreurs et mêmes restrictions que les reprises. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { exchange, exchangeOutcome } from '../src/externalSessions/adapter.js';
import { ClaudeSessionAdapter, claudeResumeArgs } from '../src/externalSessions/claude.js';
import { CodexSessionAdapter, codexResumeArgs, mcpNeutralizationArgs } from '../src/externalSessions/codex.js';
import { runExternalProcess } from '../src/externalSessions/process.js';
import type { ExternalTarget } from '../src/externalSessions/types.js';

const root = mkdtempSync(path.join(os.tmpdir(), 'palabre-create-'));
after(() => rmSync(root, { recursive: true, force: true }));
const ids = { claude: '55555555-5555-4555-8555-555555555555', codex: '0199aaaa-5555-7ccc-8ddd-eeeeeeeeeeee' };

for (const provider of ['claude', 'codex'] as const) {
  test(`${provider} : démarrage structuré seul, ni prose ni identifiant mal formé`, () => {
    const adapter = provider === 'claude' ? new ClaudeSessionAdapter({ operatorFrame: 'Cadre fixe de test' }) : new CodexSessionAdapter();
    const event = provider === 'claude' ? { type: 'system', subtype: 'init', session_id: ids[provider] }
      : { type: 'thread.started', thread_id: ids[provider] };
    assert.equal(adapter.creationSessionId(JSON.stringify(event)), ids[provider]);
    assert.equal(adapter.creationSessionId('bruit ' + ids[provider]), undefined);
    assert.equal(adapter.creationSessionId(JSON.stringify({ ...event, thread_id: '../x', session_id: '../x' })), undefined);
    assert.equal(adapter.creationSessionId(JSON.stringify({ type: 'assistant', session_id: ids[provider], thread_id: ids[provider] })), undefined);
    const args = adapter.createArgs({ agent: provider, provider, sessionId: '', cwd: root }, mcpNeutralizationArgs(['temoin']));
    const resumed = provider === 'claude' ? claudeResumeArgs(ids.claude, 'Cadre fixe de test') : codexResumeArgs(ids.codex, mcpNeutralizationArgs(['temoin']));
    assert.ok(!args.includes('--resume') && !args.includes('resume'));
    if (provider === 'codex') assert.deepEqual(args, ['exec', ...resumed.slice(2, -2), '-']);
    else {
      const resumeIndex = resumed.indexOf('--resume');
      assert.notEqual(resumeIndex, -1);
      // Retrait sémantique : ne pas reproduire le slice positionnel de l'implémentation.
      assert.deepEqual(args, resumed.filter((_, index) => index !== resumeIndex && index !== resumeIndex + 1));
    }
  });

  test(`${provider} : l'identifiant arrive avant la fin et survit à l'annulation`, async () => {
    const home = path.join(root, provider); mkdirSync(home);
    const adapter = provider === 'claude' ? new ClaudeSessionAdapter({ home }) : new CodexSessionAdapter({ home });
    const target: ExternalTarget = { agent: provider, provider, sessionId: '', cwd: root };
    const history = path.join(home, 'history.jsonl'); writeFileSync(history, '');
    const controller = new AbortController(); let captured: string | undefined;
    const exchanged = await exchange(adapter, { command: process.execPath, prefixArgs: [path.resolve('tests/fixtures/external-sessions', `fake-${provider}.cjs`)] }, target, 'PR-test', {
      timeoutMs: 10000, signal: controller.signal,
      env: { ...process.env, [`FAKE_${provider.toUpperCase()}_MODE`]: provider === 'claude' ? 'hang' : 'created-hang',
        FAKE_CLAUDE_TRANSCRIPT: history, FAKE_CODEX_ROLLOUT: history },
      onCreatedSession(id) { captured = id; controller.abort(); }
    });
    assert.equal(captured, ids[provider]); assert.equal(target.sessionId, captured);
    assert.equal(exchangeOutcome(exchanged).outcome.status, 'cancelled');
    assert.equal(exchanged.verdict?.interpretation.reply, undefined);
  });
}

test('observation stdout : UTF-8 et lignes fragmentées, dernière ligne sans saut final', async () => {
  const lines: string[] = [];
  const script = `const b=Buffer.from('été\\nfin');process.stdout.write(b.subarray(0,1));setTimeout(()=>process.stdout.write(b.subarray(1)),20)`;
  const run = await runExternalProcess({ command: process.execPath, args: ['-e', script], cwd: root, stdin: '', timeoutMs: 2000, onStdoutLine: line => lines.push(line) });
  assert.equal(run.exitCode, 0); assert.deepEqual(lines, ['été', 'fin']);
  assert.equal(run.stdout, 'été\nfin');
});
