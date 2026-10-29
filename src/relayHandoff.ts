/**
 * @file Passation locale d'un envoi Relay ordinaire vers Claude refusé avant échange (#250).
 *
 * Une conversation Claude déjà utilisée (`target-busy`, `not-delivered`) ne reçoit rien. Le corps
 * original est alors conservé dans un fichier `.handoff.md`, distinct des exports `.relay.md` :
 * il n'est jamais envoyé, notifié ni renvoyé, `relay recent` l'ignore, et il ne contient ni
 * enveloppe ni nonce. Rendu pur ; écriture exclusive (`wx`, 0600) sous un nom daté et aléatoire,
 * indépendant des données utilisateur, sans nouvelle tentative. Un échec rend `failed`, jamais un
 * chemin supposé.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RelayExchange } from "./externalSessions/envelope.js";

/** Champ facultatif `handoff` du JSON Relay v1 : état de la copie locale, jamais une délivrance. */
export type RelayHandoffReport =
  | { status: "saved"; path: string }
  | { status: "disabled" | "failed"; path?: never };

/** Données déjà validées d'un envoi refusé avant échange. */
export interface RelayHandoff {
  createdAt: string;
  from: { agent: string; session?: string } | null;
  to: { agent: string; session: string };
  subject?: string;
  exchange?: RelayExchange;
  /** Corps original, sans enveloppe ni nonce, conservé tel quel. */
  message: string;
}

/** Libellés fixes du fichier, sans donnée utilisateur. */
export interface RelayHandoffLabels {
  title: string;
  warning: string;
  metadata: string;
  message: string;
}

/** Délimiteur Markdown plus long que toute suite de backticks des textes donnés (au moins 3). */
export function markdownFence(...texts: string[]): string {
  const longest = texts.flatMap((text) => text.match(/`+/g) ?? []).reduce((length, run) => Math.max(length, run.length + 1), 3);
  return "`".repeat(longest);
}

/**
 * Rendu pur : titre et avertissement fixes, métadonnées dans un bloc JSON (valeurs échappées), puis
 * corps original inchangé (accents, CRLF, Markdown, séquences de contrôle) dans un bloc que son
 * contenu ne peut pas fermer.
 */
export function renderRelayHandoff(handoff: RelayHandoff, labels: RelayHandoffLabels): string {
  const metadata = JSON.stringify({
    v: 1,
    type: "relay-handoff",
    sent: false,
    reason: "target-busy",
    delivery: "not-delivered",
    createdAt: handoff.createdAt,
    from: handoff.from,
    to: { agent: handoff.to.agent, session: handoff.to.session, provider: "claude" },
    ...(handoff.subject !== undefined ? { subject: handoff.subject } : {}),
    ...(handoff.exchange ? { exchange: handoff.exchange } : {})
  }, null, 2);
  const metadataFence = markdownFence(metadata);
  const fence = markdownFence(handoff.message);
  return [
    `# ${labels.title}`, "", `> ${labels.warning}`, "",
    `## ${labels.metadata}`, "", `${metadataFence}json`, metadata, metadataFence, "",
    `## ${labels.message}`, "", `${fence}text`, handoff.message, fence, ""
  ].join("\n");
}

/**
 * Écrit la passation sous `outputDir` (créé au besoin, comme les exports), sans écraser ni
 * réessayer. Ne lève jamais : un échec de dossier ou d'écriture rend `{ status: "failed" }`.
 * Une écriture interrompue peut laisser un fichier partiel, jamais annoncé comme sauvegardé.
 */
export async function saveRelayHandoff(outputDir: string, handoff: RelayHandoff, labels: RelayHandoffLabels, now = new Date()): Promise<RelayHandoffReport> {
  try {
    const directory = path.resolve(outputDir);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `palabre-handoff-${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.handoff.md`);
    await writeFile(file, renderRelayHandoff(handoff, labels), { encoding: "utf8", flag: "wx", mode: 0o600 });
    return { status: "saved", path: file };
  } catch {
    return { status: "failed" };
  }
}
