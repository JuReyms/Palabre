/** @file Messages d'arrivée sur une machine : constats, limites et actions laissées au propriétaire. */
import type { Language } from "../types.js";

/** Les commandes d'action sont citées par l'appelant, jamais exécutées par ces messages. */
export interface DoctorArrivalMessages {
  configTrusted: string;
  configUntrusted(command: string): string;
  authConnected(name: string): string;
  authDisconnected(name: string, command: string): string;
  authUnknown(name: string, command: string): string;
  authSkipped: string;
  retiredAgent(name: string): string;
  skillMissing: string;
  skillPresent(paths: string): string;
  duplicateInstallations(command: string, paths: string, inspect: string): string;
}

/** Aucune donnée de compte ni sortie brute des sous-processus ne figure dans les diagnostics. */
export const doctorArrivalMessages: Record<Language, DoctorArrivalMessages> = {
  fr: {
    configTrusted: "Configuration approuvée pour son contenu actuel.",
    configUntrusted: command => `Configuration non approuvée ou modifiée : Relay refusera avec config-untrusted. Le propriétaire relit le fichier puis lance lui-même dans son terminal : ${command}. L'assistant s'ouvre ensuite : choisir 4 pour quitter sans changement. Aucune commande d'agent ni URL configurée sondée ici.`,
    authConnected: name => `${name} : connexion déclarée par la CLI, sans appel modèle. Ne garantit pas la validité future du jeton ni le quota.`,
    authDisconnected: (name, command) => `${name} : CLI non connectée. Le propriétaire choisit son compte et lance lui-même : ${command}.`,
    authUnknown: (name, command) => `${name} : connexion non vérifiée (sonde indisponible, délai ou format non reconnu). Le propriétaire vérifie lui-même : ${command}. Aucun modèle appelé ; aide : https://palab.re/fr/get-started/change-machine.`,
    authSkipped: "Connexions non sondées : approuver d'abord la configuration ci-dessus. La présence d'une CLI ne prouve pas sa connexion.",
    retiredAgent: name => `${name} : agent archivé encore déclaré, ignoré par PALABRE. Action : palabre agents pour voir les agents actifs ; le propriétaire peut ensuite retirer cette entrée selon https://palab.re/fr/configuration/advanced-json.`,
    skillMissing: "Skill PALABRE non trouvé dans les emplacements connus du projet et du dossier personnel. S'il n'est pas installé dans l'application, le propriétaire choisit les agents avec : npx skills add JuReyms/Palabre --skill palabre --global. Ne pas ajouter -y par défaut.",
    skillPresent: paths => `Skill PALABRE repéré (${paths}). Chargement et fraîcheur non vérifiés. Pour le mettre à jour, le propriétaire lance : npx skills add JuReyms/Palabre --skill palabre --global.`,
    duplicateInstallations: (command, paths, inspect) => `${command} : plusieurs emplacements dans PATH (${paths}), premier affiché en tête ; un chemin absolu configuré garde priorité. Action : ${inspect}. Ne rien désinstaller automatiquement ; versions et diagnostic complet : https://github.com/JuReyms/Palabre/issues/153.`
  },
  en: {
    configTrusted: "Configuration approved for its current contents.",
    configUntrusted: command => `Unapproved or changed configuration: Relay will refuse with config-untrusted. The owner reviews the file, then runs in their own terminal: ${command}. The wizard opens afterwards: choose 4 to exit without changes. No agent command or configured URL probed here.`,
    authConnected: name => `${name}: CLI reports signed in, without a model call. Does not guarantee future token validity or quota.`,
    authDisconnected: (name, command) => `${name}: CLI is not signed in. The owner chooses their account and runs: ${command}.`,
    authUnknown: (name, command) => `${name}: sign-in not verified (probe unavailable, timeout or unrecognized format). The owner checks: ${command}. No model called; help: https://palab.re/en/get-started/change-machine.`,
    authSkipped: "Sign-in not probed: approve the configuration above first. A detected CLI does not prove sign-in.",
    retiredAgent: name => `${name}: archived agent still declared, ignored by PALABRE. Action: palabre agents to see active agents; the owner can then remove this entry following https://palab.re/en/configuration/advanced-json.`,
    skillMissing: "PALABRE skill not found in known project and personal directories. If it is not installed through the application, the owner selects agents using: npx skills add JuReyms/Palabre --skill palabre --global. Do not add -y by default.",
    skillPresent: paths => `PALABRE skill found (${paths}). Loading and freshness not verified. To update it, the owner runs: npx skills add JuReyms/Palabre --skill palabre --global.`,
    duplicateInstallations: (command, paths, inspect) => `${command}: several PATH locations (${paths}), first listed first; an absolute configured path still takes priority. Action: ${inspect}. Do not uninstall anything automatically; versions and full diagnostics: https://github.com/JuReyms/Palabre/issues/153.`
  }
};
