# Références de développement

[AGENTS.md](../../AGENTS.md) est le point d’entrée commun, lu à chaque travail. Il conserve les règles critiques et les commandes usuelles. Les documents ci-dessous conservent les contrats détaillés : lire **uniquement les domaines concernés**, mais les lire avant d’y agir. Ils ne créent aucun droit supplémentaire.

La [vision produit](../product-vision.md) distingue Palabre globalement de ses modes. Les guides [FR](../guide/fr/usage/relay.md) et [EN](../guide/en/usage/relay.md) décrivent les parcours utilisateur ; ces références s’adressent au développement.

## Où lire quoi

| Domaine | Référence |
| --- | --- |
| Frontières CLI/intégrations, structure, agents, presets, rôles | [Architecture](architecture.md) |
| Init, discovery, new, update et skill sync | [Configuration](configuration.md) |
| CLI/PTY/Ollama, exécution, shims et modèles | [Adapters](adapters.md) |
| Débat/Ask/Chat, contexte, checkpoints et prompts | [Orchestration](orchestration.md) |
| Relay fermé/copie, délivrance, trace du message, échanges récents, permissions et fonctions gelées | [Relay](relay.md) |
| Codex ouvert, suivi, quota et ouverture Desktop | [Relay ouvert/Desktop](relay-open.md), après le socle Relay |
| Identité terminal, langues, aide, TUI et JSON/NDJSON | [Interfaces](interfaces.md) |
| Tests, trust, doctor, isolation et smoke réels | [Vérification](verification.md) |
| Documentation, skill livré, releases, GitHub et sync web | [Maintenance](maintenance.md) |

Les chemins de code entre backticks sont relatifs à la racine du dépôt ; les liens Markdown sont relatifs au document. Pour toute modification de comportement, actualiser sa référence de développement et les surfaces utilisateur concernées, sans regonfler `AGENTS.md`.

## Migration du 26 octobre 2026

Point de départ : `AGENTS.md` au commit `040821f` (1 629 lignes). Les détails ont été déplacés, pas remplacés par des résumés. Les sections générales du point d’entrée sont condensées ; la distinction produit/modes reste visible. Les principales corrections de statut sont listées ci-dessous.

| Ancienne section | Destination |
| --- | --- |
| Vision | [AGENTS.md](../../AGENTS.md), [product-vision.md](../product-vision.md) |
| Écrire pour tous | [AGENTS.md](../../AGENTS.md) |
| Identité visible de PALABRE | [interfaces.md](interfaces.md) |
| Frontiere CLI / integrations | [architecture.md](architecture.md) |
| Stack | [AGENTS.md](../../AGENTS.md), [verification.md](verification.md) |
| Structure | [architecture.md](architecture.md) |
| Concepts | [architecture.md](architecture.md) |
| Decisions actuelles | [AGENTS.md](../../AGENTS.md) |
| Init et discovery | [configuration.md](configuration.md) |
| New | [configuration.md](configuration.md) |
| Update | [configuration.md](configuration.md) |
| Adapter CLI actuel | [adapters.md](adapters.md) |
| Adapter CLI PTY | [adapters.md](adapters.md) |
| Adapter Ollama | [adapters.md](adapters.md) |
| Orchestration | [orchestration.md](orchestration.md) |
| Relay externe | [relay.md](relay.md), [relay-open.md](relay-open.md) |
| Contexte projet | [orchestration.md](orchestration.md) |
| Modeles | [adapters.md](adapters.md) |
| Prompt Preview | [orchestration.md](orchestration.md) |
| Internationalisation | [interfaces.md](interfaces.md) |
| Syntaxe CLI courte | [interfaces.md](interfaces.md) |
| Aide CLI | [interfaces.md](interfaces.md), [relay-open.md](relay-open.md) |
| Rendu Console | [interfaces.md](interfaces.md) |
| Renderer NDJSON | [interfaces.md](interfaces.md) |
| Tests et verification | [verification.md](verification.md), [development-qualifications.md](../archive/development-qualifications.md) |
| Documentation | [maintenance.md](maintenance.md) |
| JSDoc | [maintenance.md](maintenance.md), [relay-open.md](relay-open.md) |
| Releases | [maintenance.md](maintenance.md) |
| Relay en écriture ponctuelle (lot 2, Windows Codex) | [relay.md](relay.md) |
| Sync documentation (palabre-web) | [maintenance.md](maintenance.md) |
| Issues GitHub | [maintenance.md](maintenance.md) |
| Style de contribution | [maintenance.md](maintenance.md), [relay-open.md](relay-open.md), [AGENTS.md](../../AGENTS.md) |

Les consignes ajoutées lors des fusions de #231 (échanges récents, #206) et #232
(message exact, #210) sont conservées dans [le socle Relay](relay.md). Le test
de compatibilité vérifie que le bloc de message exact ne devient pas une source
de métadonnées pour `relay recent`.

### Corrections explicites, sans changement de runtime

- L’ancienne note « A5 reste à faire » est [archivée](../archive/development-qualifications.md) ; les observations A5 sont dans [le contrat Relay](relay.md#engagements-et-limites). Ces essais datés ne garantissent pas les versions actuelles.
- Codex Desktop comme expéditeur n’est plus présenté comme intrinsèquement bloqué : des essais dédiés existent, avec autorisations techniques ponctuelles de l’hôte. Claude Desktop ouverte reste une limite.
- Le lien de consultation Codex passe par `palabre relay open` ; les anciens lanceurs OS ne doivent plus être conseillés par défaut.
- « Trois modes de session » désigne uniquement Débat, Ask et Chat ; Relay est un quatrième mode produit, avec ses transports distincts. Son champ JSON technique `mode` (`background/open/follow/copy`) décrit un parcours Relay, pas un cinquième mode produit.
- Les extensions d’écriture Mission ne sont plus annoncées ; le gel de Mission/review/write est rappelé.
- La synchronisation du skill installé reste un plan confirmé par l’humain, jamais une copie depuis une branche Git.
- Les anciennes combinaisons testées restent consultables dans les archives, pas dans une liste de compatibilités actuelles.

Les PR non fusionnées et les travaux non publiés restent distincts de la disponibilité d’une release. Une ancienne qualification, un résultat de modèle ou une CI verte ne prouvent ni l’affichage Desktop, ni une permission, ni une tâche réussie.
