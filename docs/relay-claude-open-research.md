# Claude ouvert : reprise de recherche #193 — 26 octobre 2026

## Conclusion provisoire

La messagerie native Claude est la piste prioritaire, pas une fonctionnalité Relay livrée. Deux voies restent distinctes : dépôt externe direct, ou Claude intermédiaire utilisant son outil natif avec un appel modèle supplémentaire. Il reste à qualifier identité Desktop, envoi exact et réponse finale ; aucune de ces voies n'est validée ici. Aucun transport n'est développé dans ce lot ; #193 reste ouverte.

## Éléments établis

Mise à jour du 27 octobre : les [calibrations SDK sur faux outil](../scripts/prototypes/relay/CLAUDE-MESSENGER.md#deux-essais-sdk-de-panne-autorisés--27-octobre-2026)
montrent qu'une exception non traitée du hook laisse exécuter l'outil préapprouvé,
alors qu'un timeout de 5 s a laissé son compteur à zéro. Les verdicts automatiques
stricts restent négatifs (métadonnées de refus absentes au timeout). Cette stratégie
ne peut donc pas être transposée telle quelle à la messagerie réelle ; aucune
conversation existante n'a reçu ces essais.

Un [profil restrictif préparé hors ligne](../scripts/prototypes/relay/CLAUDE-MESSENGER.md#profil-restrictif-préparé-hors-ligne--27-octobre-2026)
convertit maintenant les erreurs en refus explicites et prépare un second contrôle
sans préapprobation pour le faux MCP. Il refuse tout : ni envoi valide autorisé,
ni messager utilisable. La référence officielle classe `SendMessage` sans
permission requise par défaut ; enlever `allowedTools` ne suffit donc pas à prouver
que `canUseTool` contrôle le natif. Sa préparation n'a lancé aucun modèle.

Un [témoin SDK autorisé ensuite](../scripts/prototypes/relay/CLAUDE-MESSENGER.md#témoin-restrictif-sdk-autorisé--27-octobre-2026)
a proposé une demande intacte : premier contrôle neutre, puis `canUseTool` appelé
une fois et refus appliqué ; compteur factice nul, résultat d'outil et refus final
corrélés à l'unique appel. Le libellé runtime `user_reject` provient ici du callback,
pas d'un clic humain. Un seul lancement Opus5.5, aucune relance ; `passed: false`
conservé. Ce témoin ne teste pas les pannes. Ni `SendMessage` natif, ni envoi
autorisé, ni visibilité Desktop qualifiés.

Les [deux pannes du profil restrictif](../scripts/prototypes/relay/CLAUDE-MESSENGER.md#pannes-du-profil-restrictif-avec-sdk--27-octobre-2026)
ont ensuite été autorisées et testées une fois chacune : exception du contrôle,
puis attente suspendue avec réveil interne préparé à 2 s. Dans chaque cas,
refus explicite du premier contrôle appliqué, compteur nul, résultat d'outil et
refus final corrélés à l'unique appel. Second contrôle non consulté ; aucun
rattrapage par lui démontré. Pas de durée monotone mesurée pour le réveil,
ni de test d'event loop bloquée ou d'arrêt de l'hôte. Aucun envoi réel.

La [vérification des contrôles natifs](../scripts/prototypes/relay/CLAUDE-NATIVE-CONTROLS.md)
identifie une piste documentée : une règle ask sur `SendMessage` pourrait imposer
le second contrôle, contrairement au simple retrait de `allowedTools`.
Compatibilité de types vérifiée avec SDK0.3.302, sans runtime ni modèle ; analyse
de la règle et effet natif non qualifiés. Schéma complet et liaison UUID/adresse
restent à établir. Deux essais de refus séparés avaient été proposés :
le premier hook, puis la règle ask avec second callback. Une conversation jetable
et un message bénin devront être désignés par l'humain, car un refus encore non
qualifié ne garantit pas l'absence d'envoi. Aucun réglage utilisateur appliqué.

Le [premier lanceur natif](../scripts/prototypes/relay/CLAUDE-NATIVE-CONTROLS.md#premier-lanceur-préparé-hors-ligne)
est désormais préparé et testé hors ligne : uniquement le premier hook, toujours
refusant, sans règle ask ni décodeur natif. Prompt retenu jusqu'à confirmation
d'inscription du hook, trace exclusive et constat corrélé partiel, jamais une
preuve de non-réception. Sa préparation n'a lancé aucun appel Claude ; le premier
essai autorisé ensuite est décrit ci-dessous. Le second lanceur a été préparé ensuite.

Le [premier essai natif autorisé](../scripts/prototypes/relay/CLAUDE-NATIVE-CONTROLS.md#premier-essai-natif-autorisé--27-octobre-2026)
a observé un seul appel `SendMessage`, un hook refusant et un refus runtime lié.
Le verdict strict reste négatif : le hook reçoit un champ `summary` absent de
l'événement assistant ; aucune sortie brute du modèle présumée, aucun
assouplissement ou renvoi après observation.
Messager CLI2.1.302, version Desktop déclarée 2.1.308 ; schéma complet non établi.
Le marqueur n'a pas été trouvé lors de deux lectures passives du transcript de
test après l'appel ; le propriétaire a confirmé ne voir aucun message de test.
Ce sont des observations ponctuelles, pas une preuve générale de non-réception.
Revue Claude Opus5.5 via Palabre Relay intégrée, sans traces privées ni nouvel essai.

Le [plan du second contrôle natif](../scripts/prototypes/relay/CLAUDE-NATIVE-ASK-PLAN.md)
précise les inconnues du schéma et la piste d'une inspection des règles effectives.
Une méthode existe dans le bundle SDK inspecté, sans être déclarée dans l'interface
publique `Query`. La contre-analyse Claude a trouvé `matchedAskRule`, déclaré dans
le callback : piste de preuve après coup, pas inspection avant le modèle. Aucun
appel privé ni second essai lancé pendant ce lot de plan ; celui-ci prévoit le risque d'un
message livré si la règle n'intercepte pas l'appel.
Le vérificateur et le lanceur du premier essai restent inchangés.

Un [banc séparé du second contrôle](../scripts/prototypes/relay/CLAUDE-NATIVE-ASK-PLAN.md#banc-du-second-contrôle-préparé-hors-ligne)
est préparé hors ligne : une seule proposition candidate peut rendre le premier
hook neutre, puis le callback refuse toujours. Son oracle distinct exige la règle
ask déclarée et les événements de refus liés ; ses témoins sont entièrement
fictifs. Ce lot de banc n'ajoutait aucun lanceur SDK, appel natif, transport produit
ou qualification Desktop.

Le [second lanceur manuel](../scripts/prototypes/relay/CLAUDE-NATIVE-ASK-PLAN.md#lanceur-manuel-préparé-non-exécuté-avec-claude)
est ensuite préparé avec un déroulé testable à faux SDK injecté : plan privé
distinct, réservation exclusive avant runtime, handshake avant prompt, neutralité
seulement après inventaire lu, callback refusant, arrêt sans retry et bilan toujours
non qualifié. Aucun chemin réel `--run` exécuté pendant cette préparation.

L'[essai distinct autorisé ensuite](../scripts/prototypes/relay/CLAUDE-NATIVE-ASK-PLAN.md#essai-du-second-contrôle--27-octobre-2026)
a de nouveau été bloqué au premier hook : `message` et `summary` conservent le
texte prévu, mais `content` est raccourci. Le callback n'a donc pas été atteint ;
cela ne démontre pas un échec de la règle ask. Aucun changement des contrôles ou
de l'oracle, aucun rejeu. Deux lectures passives et le propriétaire ne trouvent
aucun message de test, observations ponctuelles sans garantie de non-réception.
Régression fictive ajoutée ; aucun envoi positif ou fonctionnement Desktop qualifié.

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

Le plan initial demandait d'établir un canal pris en charge vers une session désignée : dépôt externe direct (A), ou Claude messager encadré (B). « Sans appel modèle intermédiaire » est une préférence de coût et de simplicité, pas une exigence produit ajoutée au besoin humain. Le surcoût éventuel de B doit être expliqué et accepté avant son essai ; aucune acceptation n'est présumée. Les essais négatifs autorisés ensuite sont consignés plus haut ; ils ne qualifient toujours pas un envoi Desktop. La question amont publiée ci-dessous porte sur le contrat d'entrée de `SendMessage`, désormais prioritaire avant un nouvel essai.

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

## Question amont publiée — 27 octobre 2026

Après relecture Claude Opus5.5 via Palabre et accord explicite du propriétaire,
la question a été publiée chez Anthropic :
[claude-code #105445](https://github.com/anthropics/claude-code/issues/105445).
Son titre et son corps sont en anglais, sans signature ajoutée ni trace privée.

**Titre :** Which contract should a host use to verify SendMessage text before it is sent?

Elle demande le schéma d'entrée natif reçu par `PreToolUse`, les champs de
destinataire/texte effectivement livrés plutôt que d'affichage, et le moment où
un hôte SDK peut vérifier le contenu final. Les observations des deux essais
refusés y restent distinguées d'un envoi autorisé, jamais testé.

Le brouillon initial, plus large, portait sur un dépôt externe par UUID ; il n'a
pas été publié tel quel. Identité exacte, corrélation de réponse et visibilité
Desktop restent à qualifier séparément. La publication ne valide aucun transport
et n'autorise ni nouvel essai natif ni renvoi des essais précédents.
