# Lot A0 : contrat de `palabre relay` pour les conversations fermées

Statut : **contrat validé par Codex, reporté dans `AGENTS.md`** (section « Relay externe »), qui en est désormais la seule source. Ce document conserve deux éléments :

1. les décisions explicites, avec leur état et leur origine ;
2. les points à vérifier pendant les lots suivants.

Les constats cités viennent du prototype `scripts/prototypes/relay/` (légende [T], [D], [H] de `RAPPORT.md`).

## Partie 1 : texte du contrat

Il est dans `AGENTS.md`, section « Relay externe » : syntaxe, résolution de la commande, déroulé, engagements et limites, statuts de délivrance, issues et codes de sortie, sortie `--json` v1, hors périmètre.

## Partie 2 : décisions explicites

| # | Décision | État |
| --- | --- | --- |
| D1 | Cible sans processus attaché ; refus si l'attachement est inconnu, y compris si le registre Claude est absent | Validée (Codex, revues 1 et 3) |
| D2 | Réponse renvoyée par le même appel, sans relay inverse automatique | Validée (Codex, revue 4) |
| D3 | Perte des plugins, connecteurs et MCP pendant la reprise Codex, acceptée et documentée. Même chose côté Claude pour les MCP et les outils autres que la lecture | Validée (Codex, revue 4) |
| D4 | Garanties conditionnelles, étendues à l'absence d'outils d'écriture et aux versions vérifiées | Validée (Codex, revue 4) |
| D5 | Modification de l'historique du fournisseur documentée, même en lecture seule | Validée (Codex, revue 4) |
| D6 | Aucun retry automatique, en particulier si la délivrance est incertaine. Consignes à l'appelant selon le statut | Validée (Codex, revue 4) |
| D7 | Commande résolue depuis la config approuvée, `KNOWN_CLI_AGENTS` (champ `externalSession`) et `src/exec.ts`. Arguments de débat ignorés ; liste d'arguments construite par l'adapter | Validée (Codex, revue 5) |
| D8 | Config approuvée exigée quelle que soit sa provenance, comme `palabre resume` | Validée (Codex, revue 5) |
| D9 | `command-not-found` : code 7, `not-delivered`, distinct de l'erreur interne (1) et de l'échec CLI (2) | Validée (Codex, revue 5) |
| D10 | `invalid-request` : code 8 avec `error.reason` | Validée (Codex, revue 5) |
| D11 | Sortie `--json` en objet unique v1 | Validée (Codex, revue 5) |
| D12 | Pas de confirmation interactive | Validée (Codex, revue 5) |
| D13 | Timeout de 600 s par défaut, entre 10 et 3600 s ; message de 64 Kio au plus | Validée (Codex, revue 5) |
| D14 | Adapter « session externe » distinct, dans `src/externalSessions/` ; `src/exec.ts` réutilisé | Validée (Codex, revue 3) |
| D15 | Branche active Claude : diagnostic seulement | Validée (Codex, revue 3) |
| D16 | Échec de neutralisation MCP : refus avant envoi (code 3) | Validée (Codex, revue 3) |
| D17 | Suivi : #96 garde le Relay entre agents ouverts (B) ; la version A est suivie dans une issue liée ; l'étude de B n'attend pas A | Suivi séparé créé par Codex à la demande du mainteneur : #97 pour A, #96 conservée ouverte pour B (7 octobre 2026) |
| D18 | `ENOENT` ne prouve pas l'absence de l'exécutable. Un dossier de travail absent donne `invalid-request`, raison `invalid-working-directory` (code 8), sans repli vers le dossier courant. Diagnostic identique à `codex mcp list` et au lancement | Demandée par Codex (revue 5) ; prototype et A1 |
| D19 | `output-too-large` : code 2, délivrance `persisted-no-reply` ou `unknown`. Plafond cumulé stdout + stderr (50 Mio par défaut), kill de l'arbre, timers annulés | Demandée par Codex (revue 5) ; A1 |
| D20 | `--trust-config` dans la syntaxe. Une config non approuvée est refusée aussi en TTY, sans question interactive (`config-untrusted`) | Demandée par Codex (revue 5) ; à implémenter en A4 |
| D21 | Aucun shim PowerShell pour le relay. Une CLI installée par npm (Codex) est lancée directement : interpréteur Node et script du paquet (`node …/@openai/codex/bin/codex.js`), lus dans le shim sans l'exécuter | Validée (Codex, revue A3) avec reconnaissance stricte de la forme npm ; implémentée en A4 (`resolve.ts`) |
| D22 | Claude : ajouter à la reprise un cadre opérateur par `--append-system-prompt`. Il indique, sans masquer l'enveloppe, que l'utilisateur de cette machine pose une question par `palabre relay`. Il présente le contenu comme une demande ordinaire soumise aux restrictions existantes. Motif : dans les essais A5, la cible 2.1.85 refuse le message relayé comme injection de prompt sans cadre ; avec, elle répond (**[T]**) | Implémentation et texte fixe FR/EN validés par Codex (revue A5, 7 octobre 2026) : aucun contenu du message dans `operatorFrame`, expéditeur déclaré non authentifié, aucune consigne levée. Portée **[T]** : appliqué à la reprise avec 2.1.85 ; ignoré à la reprise avec 2.1.292, où le prompt enregistré prévaut. Aucun succès futur garanti. Variante écartée : retirer l'en-tête, ce qui masquerait la provenance |

## Partie 3 : points vérifiés et points restants

- **[T] Shim npm `codex.ps1` lancé par Windows PowerShell 5.1.** Vérifié en A3, avec une copie du shim installé et un script simulé à la place de `codex.js`. Trois défauts :
  - l'argument `-` (message sur stdin) est refusé, avant même le lancement de la CLI ;
  - les guillemets internes sont retirés : `sandbox_mode="read-only"` devient `sandbox_mode=read-only`, et `{"disableAllHooks":true}` devient `{disableAllHooks:true}` ;
  - stdin arrive altéré : `é` devient `??`, et les fins de ligne deviennent CRLF.

  Retirer les guillemets des valeurs `-c` ne suffirait donc pas, d'où la proposition D21. Le même défaut d'encodage touche l'adapter CLI de débat ; il est signalé comme une tâche distincte, hors relay.
- **[T] Verrou Codex hors Windows.** Le verrou est consultatif : un fichier présent ne peut pas être éprouvé et donne `unknown`, donc un refus. Sur Linux et macOS, une conversation Codex dont le verrou est resté après un kill ne peut donc pas être relayée. Limite à documenter.
- **[T] Registre Claude absent.** La cible est toujours refusée (`target-state-unknown`). C'est une limite documentée, sans contournement.
- **[T] Alias d'exécution `WindowsApps`.** `claude.exe` (E1) a été lancé directement, sans shell. La résolution ne l'exclut donc pas, contrairement au cas `shell: true` de `src/adapters/cli.ts`. A2 reçoit un exécutable déjà résolu (`ExternalExecutable`) : ce test est **reporté en A4**, avec la résolution de la commande.
- **`usage-limit`.** Fait : en A2 pour Claude (stderr, erreurs, résultat d'un échec), en A3 pour Codex (stderr et erreurs).
- **[T] `--settings {"disableAllHooks":true}` à travers un shim PowerShell** : la valeur est altérée (voir plus haut). La question disparaît si D21 est retenue.
- **[T] Plusieurs `cwd` dans un transcript Claude** (reprise hors dossier avec 2.1.292). A2 retient le premier, c'est-à-dire le dossier d'origine, et signale les autres.
- **A4 : confiance de la config.** `ensureImplicitProjectConfigTrusted` (`src/index.ts`) pose une question en TTY. La commande `relay` doit en être exclue, puis appliquer sa propre règle : `isConfigTrusted`, `--trust-config`, sinon `config-untrusted`.
- **[T] A5, refus de Claude.** La cible traite le message relayé comme une injection de prompt et ne restitue pas son contexte. Voir D22 et `RAPPORT.md`, section « Lot A5 ».
- **[T] A5, modèle Codex enregistré refusé par le compte** (`gpt-6.1-sol` avec un compte ChatGPT). Le relay rend `cli-failure` et `persisted-no-reply`, conformément au contrat. Cette limite est à documenter : le relay reprend le modèle enregistré sans le choisir.
- **Versions vérifiées à ce jour :**
  - Codex `0.151.0` (passes 1 à 4 et smoke A5) ;
  - Claude Code `2.1.85` (passes 1 à 4 et smoke A5) et `2.1.292` (passes 2 à 4 ; non exercé en A5, car le PATH résout `2.1.85`).
