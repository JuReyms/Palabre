/**
 * @file Point d'entrée du garde d'envoi B2.2, lancé par `claude -p` comme serveur MCP stdio
 * (`node claudeGuardServer.js <dossier de la tentative>`). Voir `claudeGuard.ts`.
 * Sans dossier valide, l'état est absent et toute demande est refusée. Le processus se termine
 * de lui-même à la fin de l'entrée ; les décisions encore en attente sont alors annulées.
 */
import { serveGuard } from "./claudeGuard.js";

serveGuard(process.stdin, process.stdout, process.argv[2] ?? "").catch(() => {
  process.exitCode = 1;
});
