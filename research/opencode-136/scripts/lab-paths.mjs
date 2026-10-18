/** Chemins portables des anciens essais Windows, sans sélection implicite d'un profil ou d'un binaire. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const EXPECTED_SHA256 = '045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903';

/** Arrêt avant tout démarrage et toute création de profil si la version n'est pas celle qualifiée. */
export function verifyLabBinary(binary, platform = process.platform) {
  if (!binary || !path.isAbsolute(binary)) throw Error('PALABRE_LAB_OPENCODE : fournir le chemin absolu du binaire natif 2.0.32, sans le lancer.');
  if (platform !== 'win32') throw Error('Ces essais moteur historiques sont qualifiés sous Windows seulement. Les tests hors ligne sont portables.');
  const digest = createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  if (digest !== EXPECTED_SHA256) throw Error('Binaire différent de celui qualifié : arrêt. Requalifier la version actuelle, ne pas modifier l’empreinte pour forcer l’essai.');
  if (!process.env.SystemRoot || !path.isAbsolute(process.env.SystemRoot)) throw Error('SystemRoot Windows non vérifiable : arrêt.');
  return binary;
}

/** Chaque lancement possède ses propres données fictives, sous .local ignoré par Git. */
export function prepareLab(kind) {
  const native = verifyLabBinary(process.env.PALABRE_LAB_OPENCODE);
  const parent = fileURLToPath(new URL('../.local/', import.meta.url));
  fs.mkdirSync(parent, { recursive: true });
  if (fs.lstatSync(parent).isSymbolicLink()) throw Error('Le dossier local du laboratoire ne doit pas être un lien.');
  const root = fs.mkdtempSync(path.join(parent, kind + '-'));
  return { root, work: path.join(root, 'work'), native, node: process.execPath };
}
