/**
 * @file Relay B1 (`palabre relay --open`) : dépôt par `codex queue` (voir AGENTS.md, section
 * "Relay externe").
 *
 * `codex queue --thread <uuid> --message <texte>` (Codex CLI 0.151.0) n'accepte le texte qu'en
 * argument : ni stdin, ni fichier. Sous Windows, `CreateProcessW` limite toute la ligne de commande
 * à 32 767 unités UTF-16, NUL final compris. Le budget est donc vérifié sur la ligne réellement
 * sérialisée (exécutable, arguments préfixés D21, arguments et échappement), avant toute tentative.
 *
 * L'accusé `Queued message <id> for thread <uuid>.` identifie la tentative et la file ; il ne
 * prouve ni la réception du texte exact, ni une réponse. Son absence après un lancement ne prouve
 * pas un refus.
 */

/** Plafond de l'enveloppe complète en mode `--open`, en unités UTF-16 (pas en octets ni en caractères). */
export const MAX_OPEN_ENVELOPE_UTF16 = 8192;

/** Limite de `CreateProcessW` pour la ligne de commande, NUL final compris, en unités UTF-16. */
export const WINDOWS_COMMAND_LINE_LIMIT = 32_767;

/** Bornes du dépôt : une commande de file d'attente, jamais un tour de conversation. */
export const QUEUE_LIMITS = { timeoutMs: 60_000, maxOutputBytes: 1024 * 1024 } as const;

/** Arguments du dépôt, hors exécutable et arguments préfixés. */
export function codexQueueArgs(sessionId: string, envelope: string): string[] {
  return ["queue", "--thread", sessionId, "--message", envelope];
}

/**
 * Échappe un argument comme libuv le fait pour `CreateProcessW` (règles de `CommandLineToArgvW`) :
 * argument vide entre guillemets ; sans espace, tabulation ni guillemet, inchangé ; sinon entre
 * guillemets, chaque guillemet précédé d'un antislash, et les antislashs qui précèdent un guillemet
 * ou la fin doublés.
 */
export function quoteWindowsArgument(arg: string): string {
  if (arg === "") return "\"\"";
  if (!/[ \t"]/.test(arg)) return arg;
  if (!/["\\]/.test(arg)) return `"${arg}"`;
  let quoted = "\"";
  let backslashes = 0;
  for (const char of arg) {
    if (char === "\\") {
      backslashes += 1;
      continue;
    }
    quoted += char === "\""
      ? `${"\\".repeat(backslashes * 2 + 1)}"`
      : `${"\\".repeat(backslashes)}${char}`;
    backslashes = 0;
  }
  return `${quoted}${"\\".repeat(backslashes * 2)}"`;
}

/** Longueur de la ligne transmise à `CreateProcessW`, NUL final compris, en unités UTF-16. */
export function windowsCommandLineLength(command: string, args: readonly string[]): number {
  return [command, ...args].map(quoteWindowsArgument).join(" ").length + 1;
}

/**
 * Contrôle du dépôt avant toute tentative. Refuse une enveloppe trop longue, un argument
 * inexécutable (NUL incorporé) ou une ligne Windows trop longue. Le contrôle de ligne est appliqué
 * sur toutes les plateformes : il est déterministe et prudent, et B1 ne vise que Windows.
 */
export function checkQueueCommand(command: string, args: readonly string[], envelope: string):
  { ok: true } | { ok: false; detail: "envelope-too-long" | "nul-in-argument" | "command-line-too-long" } {
  if (envelope.length > MAX_OPEN_ENVELOPE_UTF16) return { ok: false, detail: "envelope-too-long" };
  if ([command, ...args].some((arg) => arg.includes("\u0000"))) return { ok: false, detail: "nul-in-argument" };
  if (windowsCommandLineLength(command, args) > WINDOWS_COMMAND_LINE_LIMIT) return { ok: false, detail: "command-line-too-long" };
  return { ok: true };
}

/**
 * Lecture de l'accusé de `codex queue` :
 * - `accepted` : exactement une ligne `Queued message <id> for thread <uuid>.` désignant la cible ;
 * - `foreign` : un accusé désigne explicitement une autre conversation (jamais accepté) ;
 * - `absent` : aucun accusé conforme, ou plusieurs.
 */
export type QueueAck =
  | { status: "accepted"; itemId: string }
  | { status: "foreign" | "absent" };

const QUEUE_ACK = /^Queued message ([A-Za-z0-9-]{1,64}) for thread ([0-9a-fA-F-]{36})\.$/;

export function parseQueueAck(stdout: string, sessionId: string): QueueAck {
  const acks = stdout.split(/\r?\n/).map((line) => QUEUE_ACK.exec(line.trim())).filter((match) => match !== null);
  if (acks.length !== 1) return { status: "absent" };
  const [, itemId, thread] = acks[0]!;
  return thread!.toLowerCase() === sessionId.toLowerCase() ? { status: "accepted", itemId: itemId! } : { status: "foreign" };
}

/**
 * Refus documenté par l'analyseur d'arguments de la CLI, avant toute action : une CLI qui ne
 * connaît pas `queue` ne dépose rien. Seul cet échec, certain, permet `not-delivered` après lancement.
 */
export function isQueueUnsupported(stderr: string): boolean {
  return /unrecognized subcommand ['"]?queue['"]?/i.test(stderr);
}
