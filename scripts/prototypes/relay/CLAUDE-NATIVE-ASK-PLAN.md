# Second contrôle natif Claude : plan, pas lanceur #193

État du 27 octobre 2026 : analyse statique uniquement après le
[premier refus observé](CLAUDE-NATIVE-CONTROLS.md#premier-essai-natif-autorisé--27-octobre-2026).
Aucun nouveau `query()`, message de test, changement de permissions ou de modèle
installé. Le premier vérificateur et son résultat négatif sont conservés.

## Ce que la différence d'entrée permet de conclure

La [référence des outils](https://code.claude.com/docs/en/tools-reference)
décrit `summary` comme un aperçu optionnel, avec la première ligne du message
comme repli. Le [contrat des hooks](https://code.claude.com/docs/en/hooks#pretooluse-input)
précise que les entrées dépendent de l'outil et documente certaines transformations
de chemins, mais la page inspectée ne contient pas d'entrée `SendMessage`.
Cela ne définit ni son schéma complet ni le moment où `summary` serait ajouté.

| Question | État après inspection |
| --- | --- |
| Le hook a-t-il reçu un champ supplémentaire ? | Oui, dans l'unique essai enregistré ; régression factice existante |
| Cet ajout vient-il certainement du runtime ? | Non établi ; ne pas assimiler l'événement assistant à une sortie brute du modèle |
| `message` ou `content` est-il le texte réellement livré ? | Non établi pour cette forme ; ne pas choisir par ressemblance avec le plan |
| Un nom unique prouve-t-il la conversation destinataire ? | Non ; liaison et stabilité du routage restent à établir |

Les types locaux SDK0.3.302 ne déclarent pas le schéma d'entrée natif. Une recherche
ciblée dans les fichiers `core-*.mjs` livrés n'a pas trouvé `recipient_kind` ; les
mentions de `SendMessage` relevées concernent des noms d'outils et des paramètres,
pas son gestionnaire. Ni import ni extraction/exécution du binaire pour cette lecture.
Ce périmètre ne démontre pas l'absence du schéma dans toute autre ressource.

## Distinguer inspection préalable et preuve après l'appel

L'[ordre documenté des permissions SDK](https://code.claude.com/docs/en/agent-sdk/permissions#how-permissions-are-evaluated)
place une règle `ask` avant les autorisations ordinaires et conduit au callback
en mode `default`. C'est l'hypothèse à éprouver pour `SendMessage`, pas le résultat
de son essai natif. Retirer `allowedTools` seul ne suffit pas.

L'inspection statique du paquet SDK0.3.302 fournit une piste supplémentaire :

- `SDKControlListPermissionRulesResponse` décrit un état avec les règles, leur
  source, `notInEffect`, les erreurs et `managedOnly` ;
- `sdk.mjs` contient une méthode `listPermissionRules()` qui émet la requête
  `list_permission_rules` ;
- l'interface publique `Query` inspectée dans `sdk.d.ts` ne déclare pas cette
  méthode. Sa présence dans le fichier ne suffit donc pas à en faire une API
  publique prise en charge ni à prouver sa disponibilité sur l'objet rendu.

Ne pas appeler une méthode privée avec `as any`, ni ouvrir un canal de contrôle
bricolé pour poursuivre. Un objet d'options conforme à TypeScript n'est pas
une preuve que la règle a été analysée et appliquée par la CLI.

Un contrôle local `tsc --noEmit`, avec imports de types SDK uniquement, confirme
que les options candidates sont typables et que `listPermissionRules` n'est pas
une clé de `Query` dans ce paquet. Il n'a chargé aucun runtime SDK et n'a appelé
aucune de ces méthodes. Cette preuve de types ne résout pas le contrat runtime.

La contre-analyse Claude a identifié une information publique typée que la première
version de ce plan avait omise : `CanUseTool` reçoit éventuellement
`matchedAskRule: { source, toolName, ruleContent? }`. Son commentaire SDK0.3.302
indique qu'une règle ask a forcé cette demande. Il s'agit d'une indication **au
moment du callback**, pas d'une inspection avant le prompt. `system/init` expose
aussi `permissionMode`, mais arrive après libération du prompt dans le lanceur
actuel ; `initializationResult()` ne déclare ni ce mode ni une liste de règles.

Exiger une inspection publique préalable introuvable dans cette interface
bloquerait artificiellement toute préparation. Le second essai peut être conçu
pour vérifier cette indication après coup, à condition d'annoncer le risque :
**si la règle ne s'applique pas, le message pourrait partir sans passer par le
callback**. Cette voie ne satisfait pas un préflight garantissant le non-envoi.
La source `flagSettings` est candidate pour l'option `settings`, non observée pour
ce cas natif ; ne pas la déclarer déjà vérifiée.

## Déroulé candidat, encore non exécutable

1. Retenir un profil de test séparé, sans toucher à la conversation ou aux réglages
   habituels : outil natif seul, aucun MCP, aucune préapprobation, mode `default`,
   règle `permissions.ask: ["SendMessage"]`, callback refusant systématiquement.
2. Retenir le prompt jusqu'au handshake vérifiant la version et l'inscription du
   hook, sans prétendre inspecter les règles avant le modèle. Dans le constat
   final, exiger `permissionMode: "default"` dans `init` et un seul callback lié
   à l'appel, avec `matchedAskRule.toolName: "SendMessage"`, la source candidate
   attendue et aucune restriction `ruleContent`. Une source ou forme différente
   reste non qualifiée ; aucune adaptation automatique après observation.
3. Préparer hors ligne un premier hook neutre uniquement pour la proposition
   unique attendue. Refuser les autres outils, appels répétés, défauts de capture,
   annulations ou identités ambiguës. Aucun `allow`, `updatedInput`,
   `updatedPermissions` ou nouvelle sélection de destinataire. Pour borner le
   pire cas sans prétendre connaître le schéma complet : retenir un message court,
   sur une ligne ; exiger au hook le jeu exact de clés observé, `type: "message"`,
   `recipient_kind: "name"`, `to` et `recipient` égaux au nom prévu, et **`message`,
   `summary`, `content` tous strictement égaux au texte prévu**. Toute différence
   reste refusée, sans choisir entre champs. Cette garde candidate n'est pas une
   preuve des champs effectivement livrés ou de l'identité finale du destinataire.
4. Avant toute exécution, présenter à l'humain un nouveau message bénin exact et
   sa conversation jetable ; faire revérifier l'identité. L'accord de quota ne
   vaut pas qualification du contrôle ni autorisation d'un envoi positif. L'accord
   doit couvrir explicitement la possibilité que le message parte si la règle
   ask ou le contrôle échoue ; ne pas déduire cet accord du présent plan.
5. Pour l'unique essai autorisé : réserver une trace neuve, capturer les deux
   contrôles et l'appel, vérifier session/ID et refus runtime attribué au callback.
   Conserver les deux entrées séparément : aucune suppression de champ pour les
   rendre égales. Résultat SDK réussi ne signifie pas message envoyé.

Critères à figer dans les fixtures avant tout lancement : callback exactement
une fois, `toolUseID` lié à l'appel, indication `matchedAskRule` attendue ; retour
`deny` fixe ; `tool_result` de même session/ID avec `is_error: true`, métadonnée
`permission_decision.decision: "reject"`, `source: "user_reject"` et
`non_execution_kind: "permission-rule"`, puis un `permission_denials` final lié.
`user_reject` a été observé sur le faux MCP, pas qualifié pour ce chemin natif :
une autre valeur donne un bilan non qualifié, pas un oracle réécrit. Une source
simplement différente de `hook` ne suffirait pas à prouver que le refus est appliqué.
Ici `user_reject` désignerait le callback, jamais un clic humain présumé.

Le second essai ne devrait pas être présenté comme qualifié si le premier hook
a bloqué : le callback doit avoir été effectivement consulté. Aucun compteur
d'exécution natif accessible ; absence ponctuelle dans l'historique ou Desktop
reste une observation. Aucun renvoi, autorisation positive ou extension au produit.

## Prochaine étape précise

Préparer les fixtures du callback et de la garde candidate, puis leur lanceur
séparé, avec ces critères et limites explicites. Une absence de préflight public
n'interdit pas ce travail hors ligne ; elle interdit d'annoncer une garantie
préalable. Aucun nouveau test natif n'est nécessaire pour relire ce plan ; ne pas
mettre à jour le SDK ou l'app pour forcer une API à apparaître. Le banc préparé
ensuite est décrit ci-dessous ; aucun lanceur SDK du second essai n'est ajouté.

Revue Claude Opus5.5 via Palabre Relay, arrière-plan et lecture seule : plan lu
entièrement, types ciblés inspectés, aucun SDK ou test exécuté. Le relecteur n'a
pas consulté le Web, `sdk.mjs` ou le module du premier banc ; le bilan du premier
essai était celui de sa revue précédente. Son apport principal est l'indication
`matchedAskRule`, recoupée ensuite dans les types locaux par le chef de mission.
Le contrôle `tsc --noEmit` a ensuite inclus cette forme factice et un callback de
refus typé, sans les invoquer ; pas une fixture d'exécution du second contrôle.
Précondition d'inspection préalable retirée ; garde candidate précisée. La
proposition d'accepter n'importe quelle source autre que `hook` n'a pas été
retenue : les critères de refus ci-dessus restent plus stricts, avant essai.

Vérification de ce lot documentaire : contrôle de types local sans émission
réussi ; 15 tests existants natifs/documentaires et `git diff --check` réussis.
Vrai profil Palabre inchangé pendant les tests. Aucun code produit, premier
vérificateur, dépendance ou skill installé modifié.

## Banc du second contrôle préparé hors ligne

Le [module séparé](claudeNativeAskProbe.ts) et ses
[tests](../../../tests/claude-native-ask-probe.test.ts) ne chargent aucun SDK et
n'ont aucune fonction d'envoi. Ni import par `src/` ni livraison dans `dist`.
Le lanceur du premier essai ne les utilise pas et reste inchangé.

Le plan privé est copié et figé ; message d'au plus 160 octets UTF-8, sur une
ligne sans contrôles ou caractères de formatage. Le banc doit être armé une fois
avec le handshake déclaré de la bonne version et l'inscription du hook. Cette
injection de test n'est pas un handshake réellement observé avec le SDK.

Une seule entrée peut rendre le hook neutre (`{}`, jamais `allow`) : session,
ID, outil, clés et valeurs exacts selon la garde candidate ci-dessus. La réservation
précède la capture ; répétition, réentrée, entrée hostile, expiration, annulation
ou défaut d'horloge ferment le banc. Le callback de permission rend **toujours
`deny`**, même si l'entrée est intacte et la règle attendue présente. Les captures
réutilisent les bornes du premier banc, sans modifier son comportement ; contextes
hôte et signaux ne sont pas sérialisés en entier.

Un oracle distinct exige le passage neutre unique et un seul callback, l'indication
ask exacte, les entrées conservées séparément et les événements liés dans l'ordre.
L'entrée assistant attendue a six clés, le hook en a sept avec `summary` ; les
textes doivent tous être identiques au plan. Callback et hook sont comparés
strictement, y compris l'ordre de représentation JSON. Toute variation est un
constat négatif, pas une normalisation. `user_reject` et `flagSettings` restent des
attentes candidates, pas des observations natives de ce chemin.

Le témoin positif des fixtures signifie seulement que cet oracle reconnaît les
preuves injectées ; il ne qualifie ni le SDK, ni une adresse ou livraison réelle.
L'état expose `possibleSend`, vrai dès qu'un hook neutre a été rendu et jamais
remis à faux, même après fermeture ou refus du callback : aucun compteur natif
n'atteste la non-exécution. Fin d'essai sans callback après cette neutralité :
**envoi possible, délivrance inconnue** ; préserver la trace, arrêter et demander
la vérification humaine de la conversation jetable, sans relance. Ne pas assimiler
une fermeture tardive à un refus du premier hook ou à un retrait du message.
Inversement, `possibleSend: false` n'est pas une preuve de non-réception par un
runtime externe ; ce champ décrit seulement la neutralité rendue par le banc.
Pas de compteur du gestionnaire natif, d'anti-rejeu durable, de retrait de message
ou de garantie contre une règle ask ignorée. Horloge et échéance injectées,
vérification synchrone uniquement ; pas de préemption d'une event loop bloquée.

19 tests couvrent la forme intacte, les altérations, la règle absente ou
étrangère, les callbacks hors ordre ou répétés, les captures hostiles, la fermeture
et les preuves runtime incomplètes. Aucune cible réelle, lecture de profil ou
tentative réseau dans ces tests. Le second lanceur SDK reste à préparer et son
exécution à autoriser séparément ; pas de nouvel essai natif dans ce lot.

Revue du banc par Claude Opus5.5 via Palabre Relay en arrière-plan, sans modification :
trois fichiers TS lus entièrement et plan à partir de la ligne 50, pas de test ou
SDK exécuté par le relecteur. Aucun défaut de double neutralité ou accord relevé.
Réserves intégrées : signal persistant d'envoi possible après neutralité, test
d'expiration entre contrôles et test de deux appels dans un seul événement assistant.
L'indicateur retenu est plus conservateur qu'une phase seulement `neutral` : une
fermeture ou un callback tardif ne l'effacent pas. Les limites de routage et le
risque d'un refus au premier hook sans apprentissage sur le second restent visibles.

Vérification du banc : compatibilité des signatures avec SDK0.3.302 par imports
de types uniquement ; `pnpm check`, suite complète et `pnpm build` réussis
(1226 tests, 1221 réussis, 5 ignorés). Un premier passage complet avait échoué sur
le timeout de 2 s d'un mock de shim PowerShell existant ; ce fichier a réussi
ensuite dans les 69 tests ciblés puis dans la suite complète, sans changement
de son code ou de son délai. Vrai profil Palabre inchangé pendant ces tests.
Les prototypes ne sont pas livrés dans le build produit.
