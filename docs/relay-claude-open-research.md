# Claude ouvert : reprise de recherche #193 — 26 octobre 2026

## Conclusion provisoire

La messagerie native Claude est la piste prioritaire, pas une fonctionnalité Relay livrée. Il reste à qualifier l'accès depuis un programme externe, l'identité de la conversation Desktop et la corrélation d'une réponse finale. Aucun transport n'est développé dans ce lot ; #193 reste ouverte.

## Éléments établis

- L'essai Windows du 23 octobre montre qu'une reprise CLI de l'historique partagé ne réveille pas la fenêtre Desktop. Le changement de conversation puis la commande d'ouverture ne rafraîchissaient pas l'échange ; le propriétaire a dû quitter lui-même l'app. Le registre CLI vide annonçait pourtant la conversation fermée. Voir [l'essai Desktop](relay-desktop-qualification.md).
- Le contrat B1 note une réception TUI Claude 2.1.292 depuis un messager `-p`, qui consomme lui-même un appel modèle. Ce constat, antérieur à la version installée 2.1.302, ne prouve ni Desktop ni un transport déterministe externe. Voir [le contrat B1, alternatives Claude](../scripts/prototypes/relay/CONTRAT-B1.md#alternatives-et-suite-claude).
- Installation inspectée aujourd'hui : `claude.exe` 2.1.302. Pour cette inspection, seules `--version` et `--help` ont été lancées ; aucune session utilisateur ouverte n'a reçu de message. L'aide expose reprise, ouverture Desktop et entrées stream-json, mais pas une commande analogue à `codex queue`. L'absence dans l'aide n'est pas une preuve d'absence de capacité : la référence officielle précise que l'aide n'énumère pas tous les flags. [Référence CLI](https://code.claude.com/docs/en/cli-reference).

## Ce que documente Anthropic

Pages lues le 26 octobre 2026 par Codex, chef de mission ; non revérifiées sur le Web par Claude, équipier de revue. À relire avant tout essai.

La [messagerie entre sessions](https://code.claude.com/docs/en/cross-session-messaging) utilise `ListAgents` et `SendMessage`, appelés par Claude. Le message est lu entre outils ou déclenche un tour au repos. Sous Windows natif, la version minimale annoncée est 2.1.234. Un message ne vaut pas consentement.

Chaque session peut exposer un socket, un named pipe sous Windows, et des variables destinées à ses enfants. La documentation décrit l'authentification d'un script vers sa propre session ; elle ne constitue pas, à elle seule, un contrat complet de dépôt externe vers une autre conversation. Les politiques `accept`, `hold`, `refuse` s'appliquent. Desktop ne peut pas montrer le dialogue d'accord de réception ; un message retenu par défaut peut expirer. Une connexion, un envoi annoncé ou une réponse du messager ne prouvent donc pas le traitement par la bonne conversation. Ne pas extraire de token privé pour passer ces contrôles.

## Pistes et décision de recherche

| Piste | Intérêt | Limite pour Relay |
| --- | --- | --- |
| Messagerie native | Réception dans le processus déjà ouvert | Prouver identité, livraison et réponse finale sans laisser le modèle choisir la cible ou reformuler l'enveloppe |
| Channels | Interface officielle d'événements entrants | Serveur MCP et activation propres ; ce n'est pas un accès transparent à toute conversation existante |
| Remote Control | Synchronisation entre interfaces utilisateur | Ne suffit pas à établir une API locale de dépôt pour Palabre |
| SDK / stream-json | Dialogue structuré avec un processus lancé par le client | Ne prouve pas l'attachement au processus d'une conversation Desktop déjà ouverte |
| Reprise CLI parallèle | Fonctionne pour l'arrière-plan | Écartée pour simuler un envoi ouvert : visibilité et branche de l'app non garanties |

Références : [Channels](https://code.claude.com/docs/en/channels-reference), [Remote Control](https://code.claude.com/docs/en/remote-control), [CLI](https://code.claude.com/docs/en/cli-reference). Les limites ci-dessus sont des déductions pour les exigences de Palabre, pas une affirmation d'impossibilité chez Anthropic.

## Prochain essai borné proposé

Avant toute conversation de test, établir sur documentation officielle si un processus externe, sans appel modèle, peut déposer un message dans une session désignée par son identifiant. Les pages lues ne suffisent pas à établir ce contrat complet aujourd'hui : ne pas demander encore de manipulation Desktop à l'humain. Une absence de contrat établi n'est pas une preuve d'impossibilité ; la clarification amont reste une prochaine étape possible, pas un message déjà envoyé.

Si un canal suffisamment défini est établi, sur une conversation Desktop jetable désignée par le propriétaire, commencer sans envoi : relever version, identifiant, dossier et disponibilité de la messagerie avec les interfaces supportées. Aucun scan de secrets, modification de réception, changement de permissions, fermeture d'app ni automatisation d'interface.

Avant un dépôt réel, fixer un message unique. Vérifier séparément : identité exacte, message complet reçu, fin du tour lié, réponse associée et visibilité confirmée par l'humain. Tester ensuite les refus et interférences sur données fictives : session fermée, réception retenue/refusée, tour en cours, autre message, timeout et annulation. Aucun renvoi automatique, aucune sélection « la dernière », aucun contournement de consentement.

## Coopération comme test produit

Faire relire cette recherche via le Relay existant permet déjà d'évaluer la continuité avec un équipier, l'objet, la trace exacte et le retour de ses réserves. Cela ne valide pas encore la coopération visible avec Claude Desktop ouverte. Le futur essai doit mesurer les manipulations humaines et ambiguïtés réellement évitées, sans confondre échange réussi et réduction des erreurs.

### Observation de ce lot

Une relecture par Claude Opus 5.5 via Palabre Relay, dans la conversation de revue conservée en arrière-plan, a fait corriger l'ordre du plan : établir le contrat externe avant de demander une manipulation Desktop. L'export a conservé le message exact et la réponse ; `relay recent --limit 3` a retrouvé les trois échanges de revue présentés, sans avertissement, sans ouvrir ni envoyer. La liste était limitée, pas un inventaire exhaustif. Aucune de ces observations ne prouve un nouveau transport Claude ouvert. Les traces et identifiants restent locaux.
