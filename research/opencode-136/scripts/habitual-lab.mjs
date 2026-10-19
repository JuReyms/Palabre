/** Prépare et relève un projet fictif ; ne lance aucune CLI et ne lit aucune connexion. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fixture = fileURLToPath(new URL('../fixtures/habitual-project/', import.meta.url));
const files = ['README.md', 'AGENTS.md', 'src/total.mjs', 'test/total.test.mjs'];
const hash = value => createHash('sha256').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";

/** Nouveau dossier temporaire hors dépôt, avec relevé initial séparé du projet. */
export function prepareHabitualLab(parent = os.tmpdir()) {
  const root = fs.mkdtempSync(path.join(parent, 'palabre-opencode-136-'));
  const project = path.join(root, 'project');
  const control = path.join(root, 'control');
  fs.mkdirSync(control);
  for (const relative of files) {
    const target = path.join(project, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(fixture, relative), target, fs.constants.COPYFILE_EXCL);
  }
  const contextCode = 'CONTEXTE-136-' + randomUUID();
  const seedPrompt = `Laboratoire PALABRE #136. Mémorise ce code pour cette conversation : ${contextCode}. Réponds seulement ACK. Ne lis et ne modifie aucun fichier pour ce premier message.`;
  const initial = Object.fromEntries(files.map(relative => [relative, hash(fs.readFileSync(path.join(project, relative)))]));
  fs.writeFileSync(path.join(control, 'baseline.json'), JSON.stringify({ v: 1, project, initial }, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(control, 'seed-prompt.txt'), seedPrompt + '\n', { flag: 'wx' });
  const instructions = path.join(control, 'PREMIER-ESSAI.md');
  fs.writeFileSync(instructions, `# Premier échange source, à lancer par le propriétaire\n\nProjet fictif : ${project}\n\nDans PowerShell :\n\n\`\`\`powershell\nSet-Location -LiteralPath ${quote(project)}\nopencode --standalone\n\`\`\`\n\nChoisis ton modèle dans OpenCode avant d'envoyer le premier message. Le lancement utilise ta configuration et tes permissions habituelles, y compris les intégrations éventuelles. Aucun modèle n'est choisi par le préparateur.\n\nMessage à copier dans la conversation neuve :\n\n${seedPrompt}\n\nAttends la fin, note le modèle et l'identifiant exact ses_..., puis ferme l'interface. Si nécessaire, depuis ce dossier, utilise opencode session list --standalone --format json et vérifie le dossier exact. Ne choisis pas une conversation uniquement parce qu'elle est la plus récente.\n\nCe premier échange ne demande aucun avis et aucune modification. La suite contrôlera la source, créera une copie, puis demandera l'avis uniquement dans cette copie. Le relevé de fichiers est une observation, pas un confinement.\n`, { flag: 'wx' });
  return { root, project, instructions, seedPrompt, launchCommand: `opencode --standalone ${quote(project)}` };
}

/** Compare les fichiers témoins ; des permissions ordinaires ne protègent pas ce relevé contre un agent hostile. */
export function checkHabitualLab(root) {
  if (!path.isAbsolute(root)) throw Error('Fournir le chemin absolu du laboratoire.');
  const project = path.join(root, 'project');
  const baselinePath = path.join(root, 'control/baseline.json');
  for (const directory of [root, project, path.join(root, 'control'), path.join(project, 'src'), path.join(project, 'test')]) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Dossier témoin remplacé ou lié : vérification refusée.');
  }
  const baselineStat = fs.lstatSync(baselinePath);
  if (!baselineStat.isFile() || baselineStat.isSymbolicLink() || baselineStat.size > 65536) throw Error('Relevé initial non admis.');
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); }
  catch { throw Error('Relevé initial illisible.'); }
  if (baseline.v !== 1 || baseline.project !== project || files.some(file => !/^[a-f0-9]{64}$/.test(baseline.initial?.[file] ?? ''))) throw Error('Relevé initial invalide.');
  const changed = [];
  const missing = [];
  for (const file of files) {
    try {
      const target = path.join(project, file);
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || hash(fs.readFileSync(target)) !== baseline.initial[file]) changed.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(file);
    }
  }
  return { project, trackedFixtureFilesUnchanged: changed.length === 0 && missing.length === 0, changed, missing, scope: 'fichiers-temoins-seulement-ni-session-ni-nouveaux-fichiers' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [action, target, ...extra] = process.argv.slice(2);
    if (extra.length || !['prepare', 'check'].includes(action) || (action === 'prepare' && target) || (action === 'check' && !target)) throw Error('Utiliser : node habitual-lab.mjs prepare | check <dossier-absolu>.');
    const result = action === 'prepare' ? prepareHabitualLab() : checkHabitualLab(target);
    console.log(JSON.stringify(result, null, 2));
    if (result.trackedFixtureFilesUnchanged === false) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
