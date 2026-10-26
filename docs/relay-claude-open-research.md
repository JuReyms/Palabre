# Claude ouvert : reprise de recherche #193 — 26 octobre 2026

## Conclusion provisoire

La messagerie native Claude est la piste prioritaire, pas une fonctionnalité Relay livrée. Deux voies restent distinctes : dépôt externe direct, ou Claude intermédiaire utilisant son outil natif avec un appel modèle supplémentaire. Il reste à qualifier identité Desktop, envoi exact et réponse finale ; aucune de ces voies n'est validée ici. Aucun transport n'est développé dans ce lot ; #193 reste ouverte.

## Éléments établis

- L'essai Windows du 23 octobre montre qu'une reprise CLI de l'historique partagé ne réveille pas la fenêtre Desktop. Le changement de conversation puis la commande d'ouverture ne rafraîchissaient pas l'échange ; le propriétaire a dû quitter lui-même l'app. Le registre CLI vide annonçait pourtant la conversation fermée. Voir [l'essai Desktop](relay-desktop-qualification.md).
- Le contrat B1 note une réception TUI Claude 2.1.292 depuis un messager `-p`, qui consomme lui-même un appel modèle. Ce constat, antérieur à la version installée 2.1.302, ne prouve ni Desktop ni un transport déterministe externe. Voir [le contrat B1, alternatives Claude](../scripts/prototypes/relay/CONTRAT-B1.md#alternatives-et-suite-claude).
- Installation inspectée aujourd'hui : `claude.exe` 2.1.302. Pour cette inspection, seules `--version` et `--help` ont été lancées ; aucune session utilisateur ouverte n'a reçu de message. L'aide expose reprise, ouverture Desktop et entrées stream-json, mais pas une commande analogue à `codex queue`. L'absence dans l'aide n'est pas une preuve d'absence de capacité : la référence officielle précise que l'aide n'énumère pas tous les flags. [Référence CLI](https://code.claude.com/docs/en/cli-reference).

## Ce que documente Anthropic

Pages lues le 26 octobre 2026 par Codex, chef de mission ; non revérifiées sur le Web par Claude, équipier de revue. À relire avant tout essai.

La [messagerie entre sessions](https://code.claude.com/docs/en/cross-session-messaging) utilise `ListAgents` et `SendMessage`, appelés par Claude. Le message est lu entre outils ou déclenche un tour au repos. Sous Windows natif, la version minimale annoncée est 2.1.234. Un message ne vaut pas consentement.

Chaque session peut exposer un socket, un named pipe sous Windows, et des variables destinées à ses enfants. La documentation décrit l'authentification d'un script vers sa propre session ; elle ne constitue pas, à elle seule, un contrat complet de dépôt externe vers une autre conversation. Les politiques `accept`, `hold`, `refuse` s'appliquent. Desktop ne peut pas montrer le dialogue d'accord de réception ; un message retenu par défaut peut expirer. Une connexion, un envoi annoncé ou une réponse du messager ne prouvent donc pas le traitement par la bonne conversation. Ne pas extraire de token privé pour passer ces contrôles.

Sans valeur explicite, la réception dépend des classes de permissions des deux sessions ; elle n'est donc pas systématiquement retenue dans Desktop. Ne pas déduire `hold` de la seule interface.

## Contrôles complémentaires, sans message de test

- `claude agents --help`, `agents --json` et `attach --help` inspectés sur 2.1.302. L'inventaire lu expose `sessionId`, mais pas la surface, la version ou l'adresse native. Aucun nom, identifiant, PID ou dossier n'est publié. Un élément d'inventaire n'est pas une preuve d'ouverture Desktop ; `attach` n'a pas été exécuté.
- [Types publics SDK 0.3.302](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.302/sdk.d.ts) lus en mémoire, sans installation. Les signatures inspectées exposent `streamInput` et des contrôles sur le processus SDK ; aucun export de dépôt inter-sessions ou d'attachement Desktop n'y a été identifié. Recherche bornée, pas preuve d'absence universelle. La [release 0.3.302](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.302) annonce sa parité avec CLI 2.1.302. La version plus récente repérée n'est ni installée ni qualifiée ici.
- Une [réponse du mainteneur dans #24798](https://github.com/anthropics/claude-code/issues/24798#issuecomment-5311328527) confirme les outils natifs et renvoie à leur documentation, sans fournir un protocole de dépôt externe. Les commentaires communautaires ne remplacent pas ce contrat.

## Pistes et décision de recherche

| Piste | Intérêt | Limite pour Relay |
| --- | --- | --- |
| Messagerie native, dépôt externe direct | Réception dans le processus déjà ouvert, sans modèle messager | Contrat externe complet non établi ; UUID, authentification, accusé et corrélation à qualifier |
| Claude messager utilisant l'outil natif | Réutiliser la messagerie officielle | Appel modèle supplémentaire ; contrôler avant envoi la destination, le texte exact et l'unicité, puis lire la réponse de l'équipier, pas celle du messager |
| Channels | Interface officielle d'événements entrants | Serveur MCP et activation propres ; ce n'est pas un accès transparent à toute conversation existante |
| Remote Control | Synchronisation entre interfaces utilisateur | Ne suffit pas à établir une API locale de dépôt pour Palabre |
| SDK / stream-json | Dialogue structuré avec un processus lancé par le client | Ne prouve pas l'attachement au processus d'une conversation Desktop déjà ouverte |
| Reprise CLI parallèle | Fonctionne pour l'arrière-plan | Écartée pour simuler un envoi ouvert : visibilité et branche de l'app non garanties |

Références : [Channels](https://code.claude.com/docs/en/channels-reference), [Remote Control](https://code.claude.com/docs/en/remote-control), [CLI](https://code.claude.com/docs/en/cli-reference). Les limites ci-dessus sont des déductions pour les exigences de Palabre, pas une affirmation d'impossibilité chez Anthropic.

## Prochain essai borné proposé

Avant toute conversation de test, établir un canal pris en charge vers une session désignée : dépôt externe direct (A), ou Claude messager encadré (B). « Sans appel modèle intermédiaire » est une préférence de coût et de simplicité, pas une exigence produit ajoutée au besoin humain. Le surcoût éventuel de B doit être expliqué et accepté avant son essai ; aucune acceptation n'est présumée. Les pages lues ne suffisent pas à qualifier l'une de ces voies aujourd'hui : pas encore de manipulation Desktop demandée. Une question amont précise est proposée ci-dessous, sans publication.

### Ce que le garde d'un éventuel messager devrait prouver

Le SDK documente [PreToolUse](https://code.claude.com/docs/en/agent-sdk/hooks), exécuté avant l'outil, et [l'ordre des permissions](https://code.claude.com/docs/en/agent-sdk/permissions). `canUseTool` seul n'est pas un garde systématique : un outil déjà autorisé peut ne pas y passer. `allowedTools` préapprouve, sans limiter à lui seul les outils exposés. Ne pas s'appuyer sur ces seules options.

Hypothèse à qualifier, pas implémentation : outils exposés limités à l'envoi natif et éventuellement l'inventaire ; contrôle restrictif avant toute action, destinataire exact et texte inchangé, une seule tentative, refus des autres actions. Le garde n'accorde jamais de permission : refus ou décision neutre laissant les contrôles ordinaires s'appliquer. La documentation ne dit pas qu'un `allow` efface toutes les règles de refus : cette généralisation, proposée pendant la revue, n'est pas retenue.

Panne et timeout du garde doivent empêcher l'envoi. Les [timeouts de callbacks SDK](https://code.claude.com/docs/en/agent-sdk/hooks#hook-timeout) sont documentés comme bloquants sur `PreToolUse` ; ne pas les confondre avec les hooks de commande, dont certains échecs restent non bloquants sans [onFailure: block](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails). Exception, arrêt de l'hôte et application réelle à `SendMessage` restent à vérifier sur la version choisie. Aucun hook n'est ajouté dans ce lot.

La liaison UUID/adresse native et la corrélation restent nécessaires même avec un garde correct. Un accusé ou une réponse finale du messager n'est jamais la réponse de l'équipier ; réception, fin du tour et réponse doivent être établies dans la conversation désignée. Ne jamais utiliser l'intermédiaire pour faire exécuter une action interdite au messager. Aucun réglage de réception ni droit n'est modifié pour faire passer un test.

Si un canal suffisamment défini est établi, sur une conversation Desktop jetable désignée par le propriétaire, commencer sans envoi : relever version, identifiant, dossier et disponibilité de la messagerie avec les interfaces supportées. Aucun scan de secrets, modification de réception, changement de permissions, fermeture d'app ni automatisation d'interface.

Avant un dépôt réel, fixer un message unique. Vérifier séparément : identité exacte, message complet reçu, fin du tour lié, réponse associée et visibilité confirmée par l'humain. Tester ensuite les refus et interférences sur données fictives : session fermée, réception retenue/refusée, tour en cours, autre message, timeout et annulation. Aucun renvoi automatique, aucune sélection « la dernière », aucun contournement de consentement.

## Coopération comme test produit

Faire relire cette recherche via le Relay existant permet déjà d'évaluer la continuité avec un équipier, l'objet, la trace exacte et le retour de ses réserves. Cela ne valide pas encore la coopération visible avec Claude Desktop ouverte. Le futur essai doit mesurer les manipulations humaines et ambiguïtés réellement évitées, sans confondre échange réussi et réduction des erreurs.

### Observation de ce lot

Une relecture par Claude Opus 5.5 via Palabre Relay, dans la conversation de revue conservée en arrière-plan, a fait corriger l'ordre du plan : établir le contrat externe avant de demander une manipulation Desktop. L'export a conservé le message exact et la réponse ; `relay recent --limit 3` a retrouvé les trois échanges de revue présentés, sans avertissement, sans ouvrir ni envoyer. La liste était limitée, pas un inventaire exhaustif. Aucune de ces observations ne prouve un nouveau transport Claude ouvert. Les traces et identifiants restent locaux.

Une seconde relecture a fait retirer la contrainte injustifiée « sans appel modèle » et préciser les contrôles du messager. Ses assertions techniques ont été recoupées avec les sources officielles par Codex ; le relecteur n'avait toujours pas d'accès Web. La coopération a corrigé le plan, pas qualifié un transport.

## Question amont proposée — non publiée

La question reste une option, pas un préalable au prototype isolé approuvé par le
propriétaire. Le [banc hors ligne du messager](../scripts/prototypes/relay/CLAUDE-MESSENGER.md)
du 27 octobre teste les refus et la réservation unique sur des données fictives.
Il ne qualifie ni le SDK natif, ni la liaison UUID/adresse, ni l'envoi Desktop.

**Titre :** Interface officielle de dépôt externe dans une conversation Claude Code locale ouverte

Nous développons un outil local de coopération entre outils IA. Nous souhaitons transmettre un message unique à une conversation Claude Code précise, notamment dans l'onglet Code de Desktop sous Windows, sans second écrivain sur son historique, automatisation d'interface ou contournement des permissions.

La documentation décrit `ListAgents`/`SendMessage` et l'accès d'un enfant au socket de sa propre session. Existe-t-il une interface publique pour un programme externe, adressable par UUID ? Où sont définis l'authentification prévue, la liaison UUID/adresse, le message, les accusés de réception/retenue/refus/expiration et les identifiants reliant réception, tour et réponse finale ?

Sinon, le parcours pris en charge passe-t-il par un Claude messager ou un Channel explicitement configuré ? Pour Desktop, comment la réception applique-t-elle les classes de permissions sans dialogue, et quelle action humaine est prévue pour un message retenu ?

Aucune donnée de compte, clé ou conversation privée ne serait jointe. La publication de cette question demande l'accord du propriétaire ; aucun message n'a été envoyé à Anthropic dans ce lot.
