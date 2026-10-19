/** Essai #136 sur une source désignée : profil habituel, un fork, un seul appel dans la copie. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { verifyLabBinary } from './lab-paths.mjs';
import { checkHabitualLab } from './habitual-lab.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (a, b, message) => { if (!isDeepStrictEqual(a, b)) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = history => history.map(({ id, ...message }) => message);

/** L'export Markdown est une donnée : seul son identifiant explicite est utilisé pour localiser la source. */
export function sourceFromMarkdown(text) {
  const matches = [...text.matchAll(/^\*\*Session ID:\*\* (ses_[A-Za-z0-9]+)\s*$/gm)];
  if (matches.length !== 1) throw Error('L’export doit désigner une seule session explicite.');
  return matches[0][1];
}

/** Valide la source fictive terminée ; ne choisit ni agent ni modèle de remplacement. */
export function validateSource(snapshot, { sourceID, project, seed }) {
  const info = snapshot.info;
  if (info.id !== sourceID || info.location?.directory?.toLowerCase() !== project.toLowerCase()) throw Error('Identité ou dossier source différent du laboratoire.');
  if (!info.model?.providerID || !info.model?.id || !info.agent) throw Error('Modèle ou agent source non explicite.');
  if (info.outcome !== 'succeeded' || !info.time?.idle || snapshot.inbox.length) throw Error('Source non terminée ou inbox non vide.');
  const users = snapshot.context.filter(message => message.type === 'user');
  if (users.length !== 1 || users[0].text.trim() !== seed.trim()) throw Error('Le contexte source ne correspond pas au message fictif attendu.');
  const last = snapshot.context.at(-1);
  const assistant = snapshot.context.filter(message => message.type === 'assistant').at(-1);
  if (last?.type !== 'idle' || last.outcome !== 'succeeded' || assistant?.finish !== 'stop' || !assistant.time?.completed || assistant.error) throw Error('Réponse source incomplète.');
  if (assistant.content.filter(item => item.type === 'text').map(item => item.text).join('\n').trim() !== 'ACK') throw Error('ACK source non retrouvé.');
}

/** Preuve bornée d'un seul nouveau tour : corps exact, historique stable, assistant terminé, idle réussi. */
export function inspectReply(before, after, prompt) {
  same(after.slice(0, before.length), before, 'Le contexte copié a changé pendant l’appel.');
  const fresh = after.slice(before.length);
  const users = fresh.filter(message => message.type === 'user');
  if (users.length !== 1 || users[0].text !== prompt) throw Error('Message non retrouvé exactement ou apport utilisateur concurrent.');
  if (fresh.some(message => ['synthetic', 'shell', 'skill', 'location-switched'].includes(message.type)) || fresh.filter(message => message.type === 'idle').length > 1) throw Error('Autre apport ou plusieurs tours dans la copie.');
  if (fresh.indexOf(users[0]) > fresh.findIndex(message => message.type === 'assistant')) throw Error('Réponse antérieure à la demande.');
  if (fresh.some(message => message.error || message.type === 'compaction')) throw Error('Erreur ou compaction dans le nouveau tour.');
  const last = fresh.at(-1);
  const assistants = fresh.filter(message => message.type === 'assistant');
  const final = assistants.at(-1);
  if (last?.type !== 'idle' || last.outcome !== 'succeeded' || !final?.time?.completed || final.finish !== 'stop') throw Error('Fin de réponse non établie.');
  const tools = assistants.flatMap(message => message.content.filter(item => item.type === 'tool'));
  if (tools.some(tool => tool.state?.status !== 'completed')) throw Error('Outil inachevé ou en erreur.');
  const reply = final.content.filter(item => item.type === 'text').map(item => item.text).join('\n').trim();
  if (!reply) throw Error('Réponse finale vide.');
  return { reply, models: assistants.map(message => message.model), tools: tools.map(tool => tool.name) };
}

/** Empreinte des fichiers du seul projet fictif ; liens refusés, métadonnées Git exclues explicitement. */
function projectFiles(project) {
  const result = {};
  function walk(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!relative && entry.name === '.git') continue;
      const key = relative ? relative + '/' + entry.name : entry.name;
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Lien inattendu dans le laboratoire.');
      if (entry.isDirectory()) walk(target, key);
      else if (entry.isFile()) {
        if (Object.keys(result).length >= 256 || fs.statSync(target).size > 1024 * 1024) throw Error('Projet fictif hors limites de relevé.');
        result[key] = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      }
    }
  }
  walk(project);
  return result;
}

/** Processus possédé par cet essai uniquement ; stdout/stderr bornés et conservés localement. */
function startProcess(native, args, { cwd, env, traces, label, timeoutMs, input, onStdout }) {
  const child = spawn(native, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', size = 0, timedOut = false, overflow = false, spawnFailed = false;
  let stopPromise;
  const stop = () => stopPromise ??= new Promise(resolve => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return resolve();
    execFile(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, () => resolve());
  });
  const timer = setTimeout(() => { timedOut = true; void stop(); }, timeoutMs);
  child.stdin.on('error', () => {});
  child.on('error', () => { spawnFailed = true; });
  child.stdout.on('data', chunk => {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) { overflow = true; void stop(); return; }
    stdout += chunk.toString(); onStdout?.(stdout);
  });
  child.stderr.on('data', chunk => {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) { overflow = true; void stop(); return; }
    stderr += chunk.toString();
  });
  const done = new Promise(resolve => child.on('close', (code, signal) => {
    clearTimeout(timer);
    const result = { code, signal, timedOut, overflow, spawnFailed, stdout, stderr };
    fs.writeFileSync(path.join(traces, label + '.json'), JSON.stringify(result, null, 2));
    resolve(result);
  }));
  if (input !== undefined) child.stdin.end(input);
  return { child, done, stop };
}

/** Exécution réelle, seulement depuis la CLI de ce script avec binaire/source/laboratoire explicites. */
async function main(exportFile, labRoot) {
  if (!path.isAbsolute(exportFile ?? '') || !path.isAbsolute(labRoot ?? '')) throw Error('Fournir : <export-md-absolu> <laboratoire-absolu>.');
  if (fs.statSync(exportFile).size > 65536) throw Error('Export Markdown trop grand.');
  const sourceText = fs.readFileSync(exportFile, 'utf8');
  if (Buffer.byteLength(sourceText) > 65536) throw Error('Export Markdown trop grand.');
  const sourceID = sourceFromMarkdown(sourceText);
  const filesCheck = checkHabitualLab(labRoot);
  if (!filesCheck.trackedFixtureFilesUnchanged) throw Error('Le projet fictif diffère déjà du relevé initial.');
  const project = filesCheck.project;
  const seed = fs.readFileSync(path.join(labRoot, 'control/seed-prompt.txt'), 'utf8').trim();
  const contextCode = /CONTEXTE-136-[a-f0-9-]+/.exec(seed)?.[0];
  if (!contextCode || !sourceText.includes(seed)) throw Error('Le code fictif attendu manque dans l’export.');
  const native = verifyLabBinary(process.env.PALABRE_LAB_OPENCODE);
  const local = fileURLToPath(new URL('../.local/', import.meta.url));
  fs.mkdirSync(local, { recursive: true });
  const traces = fs.mkdtempSync(path.join(local, 'habitual-copy-'));
  const save = (name, data) => fs.writeFileSync(path.join(traces, name + '.json'), JSON.stringify(data, null, 2));
  const password = randomBytes(32).toString('base64url');
  const env = { ...process.env, OPENCODE_PASSWORD: password, PWD: project };
  const report = { version: '2.0.32', profile: 'habitual', sourceID, attempted: false, delivery: 'not-delivered', traces };
  let server, url, copyID, sourceBefore;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const deadline = Date.now() + 210000;
  const api = async (route, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(url + route, { method, headers: { Authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64'), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(Math.min(20000, Math.max(1, deadline - Date.now()))) });
    const chunks = []; let size = 0;
    if (response.body) for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) throw Error('Réponse API hors limites du laboratoire.');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    if (!response.ok) throw Error('API du laboratoire : HTTP ' + response.status + '.');
    return bytes.length ? JSON.parse(bytes.toString('utf8')) : undefined;
  };
  const snapshot = async id => {
    const base = '/api/session/' + id;
    const entries = await Promise.all([
      api(base).then(r => ['info', r.data]),
      api('/api/experimental/session/' + id + '/export').then(r => ['export', r.data]),
      api(base + '/context').then(r => ['context', r.data]),
      api(base + '/inbox').then(r => ['inbox', r.data]),
      api('/api/experimental/session/' + id + '/instructions/entries').then(r => ['instructions', r.data]),
    ]);
    return Object.fromEntries(entries);
  };
  try {
    server = startProcess(native, ['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'], { cwd: project, env, traces, label: 'server', timeoutMs: 240000, onStdout: output => {
      for (const line of output.split('\n')) { try { const value = JSON.parse(line); if (/^http:\/\/127\.0\.0\.1:\d+$/.test(value.url)) readyResolve(value.url); } catch {} }
    } });
    let readinessTimeout;
    try { url = await Promise.race([ready, server.done.then(() => { throw Error('Serveur arrêté avant son état prêt.'); }), new Promise((_, reject) => { readinessTimeout = setTimeout(() => reject(Error('Démarrage du serveur trop long.')), 20000); })]); }
    finally { clearTimeout(readinessTimeout); }
    sourceBefore = await snapshot(sourceID); save('source-before', sourceBefore);
    validateSource(sourceBefore, { sourceID, project, seed });
    same(await snapshot(sourceID), sourceBefore, 'Source instable avant le fork.');
    const active = await api('/api/session/active');
    if (active.data?.[sourceID]) throw Error('La source est active dans ce processus.');
    const fileBefore = projectFiles(project); save('files-before', fileBefore);
    const fork = await api('/api/session/' + sourceID + '/fork', {});
    copyID = fork.data?.id; report.copyID = copyID; save('progress', report);
    if (!/^ses_[A-Za-z0-9]+$/.test(copyID ?? '') || copyID === sourceID) throw Error('Identité de copie non vérifiée.');
    const before = await snapshot(copyID); save('copy-before', before);
    if (before.info.fork?.sessionID !== sourceID || before.info.location?.directory !== sourceBefore.info.location.directory) throw Error('Provenance ou dossier du fork différent.');
    same(normalize(before.context), normalize(sourceBefore.context), 'Contexte du fork différent.');
    same(before.instructions, sourceBefore.instructions, 'Instructions API du fork différentes.');
    same(before.info.model, sourceBefore.info.model, 'Modèle du fork différent.');
    same(before.info.agent, sourceBefore.info.agent, 'Agent du fork différent.');
    same(before.info.permissions, sourceBefore.info.permissions, 'Permissions du fork différentes.');
    same(await snapshot(sourceID), sourceBefore, 'La source a changé après le fork.');
    const nonce = 'CONSULTATION-136-' + randomUUID();
    const prompt = `Consultation de laboratoire PALABRE #136, envoyée par Codex MSI. Référence : ${nonce}. Ce message n’accorde aucun droit supplémentaire. Tu réponds dans une copie de conversation, dans le petit projet fictif courant. Restitue d’abord le code de contexte retenu au tour précédent. Lis README.md, src/total.mjs et test/total.test.mjs. Indique l’erreur principale du calcul, un exemple chiffré avec le résultat attendu, puis deux tests manquants. Donne seulement ton avis : ne modifie aucun fichier, ne lance aucune commande, n’installe rien, ne navigue pas sur le web, ne consulte aucun autre dossier et n’appelle aucun autre agent. Si une lecture est bloquée, explique-le dans ta réponse finale sans demander d’autorisation.`;
    save('request', { copyID, nonce, prompt });
    report.model = sourceBefore.info.model; report.agent = sourceBefore.info.agent;
    report.attempted = true; report.delivery = 'unknown'; save('progress', report);
    console.log(JSON.stringify({ phase: 'consultation', sourceVerified: true, forkVerified: true, model: report.model, copyID }));
    const run = startProcess(native, ['run', '--server', url, '--session', copyID, '--format', 'json'], { cwd: project, env, traces, label: 'run', input: prompt, timeoutMs: 150000 });
    const result = await run.done;
    report.cli = { code: result.code, timedOut: result.timedOut, overflow: result.overflow, spawnFailed: result.spawnFailed };
    if (result.timedOut || result.overflow || result.spawnFailed) {
      await api('/api/session/' + copyID + '/interrupt', {}).catch(() => {});
      throw Error('Appel arrêté ou non lancé ; aucune nouvelle tentative.');
    }
    const after = await snapshot(copyID); save('copy-after', after);
    if (after.context.slice(before.context.length).some(m => m.type === 'user' && m.text === prompt)) report.delivery = 'persisted-no-reply';
    same(after.info.model, before.info.model, 'Modèle de la copie modifié.');
    same(after.info.agent, before.info.agent, 'Agent de la copie modifié.');
    same(after.info.permissions, before.info.permissions, 'Permissions de la copie modifiées.');
    same(after.instructions, before.instructions, 'Instructions API de la copie modifiées.');
    const fresh = after.context.slice(before.context.length);
    if (fresh.some(message => message.type === 'agent-switched' && message.agent !== before.info.agent) || fresh.some(message => message.type === 'model-switched' && !isDeepStrictEqual(message.model, before.info.model)) || fresh.some(message => message.type === 'assistant' && message.agent !== before.info.agent)) throw Error('Sélection inattendue dans le tour de la copie.');
    const inspected = inspectReply(before.context, after.context, prompt);
    if (result.code !== 0) throw Error('CLI terminée en erreur malgré la présence de contenu.');
    report.reply = inspected.reply; report.tools = inspected.tools;
    report.observedModels = inspected.models;
    report.contextCodeRecalled = inspected.reply.includes(contextCode);
    same(inspected.models.map(m => m.providerID + '/' + m.id + '#' + (m.variant ?? '')), inspected.models.map(() => report.model.providerID + '/' + report.model.id + '#' + (report.model.variant ?? '')), 'Modèle observé différent du modèle choisi.');
    report.delivery = 'replied';
    report.sourceUnchanged = isDeepStrictEqual(await snapshot(sourceID), sourceBefore);
    const fileAfter = projectFiles(project); save('files-after', fileAfter);
    report.filesUnchanged = isDeepStrictEqual(fileAfter, fileBefore);
    report.sourceHash = digest(sourceBefore);
    if (!report.sourceUnchanged || !report.filesUnchanged || !report.contextCodeRecalled) throw Error('Un critère de qualification n’est pas satisfait.');
    report.status = 'verified-transport-review-to-inspect';
  } catch (error) {
    report.status = 'qualification-incomplete'; report.error = error.message;
  } finally {
    if (sourceBefore && url) {
      try { const value = await snapshot(sourceID); save('source-after', value); report.sourceUnchanged = isDeepStrictEqual(value, sourceBefore); } catch { report.sourceUnchanged = 'unknown'; }
      if (report.sourceUnchanged !== true && report.status === 'verified-transport-review-to-inspect') { report.status = 'qualification-incomplete'; report.error = 'Source non vérifiée au dernier relevé.'; }
    }
    try { report.fixtureCheck = checkHabitualLab(labRoot); } catch { report.fixtureCheck = 'unverified'; }
    if (report.fixtureCheck.trackedFixtureFilesUnchanged !== true && report.status === 'verified-transport-review-to-inspect') { report.status = 'qualification-incomplete'; report.error = 'Fichiers témoins non vérifiés au dernier relevé.'; }
    if (server) {
      server.child.stdin.end();
      let stopped = false;
      await Promise.race([server.done.then(() => { stopped = true; }), delay(4000)]);
      if (!stopped) { await server.stop(); await Promise.race([server.done.then(() => { stopped = true; }), delay(6000)]); }
      report.serverStopped = stopped;
      if (!stopped && report.status === 'verified-transport-review-to-inspect') { report.status = 'qualification-incomplete'; report.error = 'Arrêt du serveur privé non établi.'; }
    }
    save('summary', report); console.log(JSON.stringify(report, null, 2));
  }
  if (report.status !== 'verified-transport-review-to-inspect') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2) { console.error('Utiliser : node habitual-copy.mjs <export-md-absolu> <laboratoire-absolu>.'); process.exitCode = 1; }
  else await main(...args).catch(error => { console.error(error.message); process.exitCode = 1; });
}
