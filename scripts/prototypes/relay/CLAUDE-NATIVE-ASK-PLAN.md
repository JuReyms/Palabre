# Second contrôle natif Claude : préparation et essai #193

Préparation du 27 octobre 2026 : analyse statique après le
[premier refus observé](CLAUDE-NATIVE-CONTROLS.md#premier-essai-natif-autorisé--27-octobre-2026).
Aucun nouveau `query()` pendant cette préparation ; le lancement autorisé ensuite
est décrit dans le bilan final. Aucun réglage utilisateur ou modèle installé
modifié. Le premier vérificateur et son résultat négatif sont conservés.

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

## Déroulé candidat au stade du plan

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

## Étape prévue après le plan (historique)

Préparer les fixtures du callback et de la garde candidate, puis leur lanceur
séparé, avec ces critères et limites explicites. Une absence de préflight public
n'interdit pas ce travail hors ligne ; elle interdit d'annoncer une garantie
préalable. Aucun nouveau test natif n'est nécessaire pour relire ce plan ; ne pas
mettre à jour le SDK ou l'app pour forcer une API à apparaître. Le banc préparé
ensuite est décrit ci-dessous ; ce lot de plan n'ajoutait aucun lanceur SDK.

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
tentative réseau dans ces tests. À ce stade le second lanceur SDK restait à
préparer ; sa préparation ultérieure est décrite ci-dessous, sans nouvel essai natif.

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

## Lanceur manuel préparé, non exécuté avec Claude

Le [lanceur séparé](claudeNativeAskProbe.mjs) relie le banc au
[déroulé à SDK injecté](claudeNativeAskRunner.ts). Le code produit et le premier
lanceur ne les importent pas ; aucune option d'envoi positif ou de retry.
L'aide reste accessible sans SDK ou conversation :

```powershell
node scripts/prototypes/relay/claudeNativeAskProbe.mjs --help
```

Un fichier privé distinct est exigé : `{v: 1, kind: "native-ask-deny-probe", plan}`,
où `plan` conserve UUID, dossier, nom et texte explicites du banc. Le plan nu du
premier essai est refusé ; aucun champ `approved` ou drapeau d'accord ajouté.
Ce format évite une confusion accidentelle, pas un rejeu volontaire ou un consentement
fabriqué. L'humain devra choisir un nouveau texte exact et accepter la possibilité
qu'il parte si le contrôle natif échoue. L'accord de quota ne suffit pas.

Le lanceur ne vérifie ni l'UUID destinataire, ni son PID, ni l'unicité du nom :
ces champs restent déclaratifs. Le chef de mission doit refaire les lectures
bornées d'identité juste avant un lancement autorisé (titre, dossier, UUID, nom
unique, PID vivant et heure de création), avec confirmation du propriétaire sur
la conversation jetable. Dérive ou doute : arrêt sans envoyer. L'UUID conservé
dans le plan ne lie pas le routage natif, qui reste par nom ; cette vérification
extérieure n'est pas atomique avec l'envoi. Ne pas la présenter comme telle.

Le lanceur vérifie SDK0.3.302 local et CLI Windows native2.1.302, sans installation,
repli ou modification de configuration. Environnement réduit, sans clé API ni
override de modèle hérités ; Opus5.5 demandé, pas de fallback. Il réserve une trace
neuve en création exclusive avant import runtime et `query`, puis utilise un
dossier messager vide distinct, conservé. Une réservation vide après crash reste
en place : ne pas la supprimer ou changer de chemin pour rejouer. Cette réserve
ne constitue toujours pas un anti-rejeu durable global.

Le déroulé construit un seul `query`. Prompt retenu jusqu'au handshake version/hooks,
sans inspection privée des règles. L'inventaire `init` arrive après libération du
prompt : pas un préflight avant modèle. Toutefois le hook ne peut rendre `{}`
qu'après lecture d'un inventaire conforme (`SendMessage` seul, aucun MCP, mode
`default`) ; un appel précoce reste refusé et invalide le constat. Le callback
reste toujours `deny`, avec capture de l'indication `matchedAskRule` candidate.
L'ordre de remise de `init` et de l'appel de hook par le SDK n'est pas qualifié :
un hook précoce donnera un refus sûr du banc mais aucun constat du second contrôle,
quota déjà potentiellement consommé. Annoncer aussi ce risque avant l'essai.

Budget coopératif 120 s, signal d'annulation et demande de `close()` ; attente du
handshake ou du prochain événement interrompue par une course avec l'annulation.
Cela ne prouve ni kill d'un processus récalcitrant ni retrait du message. Timers et
écouteur du déroulé sont nettoyés ; état du tour figé avant tout nettoyage ou
demande de fermeture, y compris sur annulation. Callbacks tardifs refusés et comptés
séparément lorsqu'observés pendant la fermeture ; ils ne peuvent atténuer le signal
« sans callback pendant le tour », ni qualifier le constat. Ce n'est pas une
observation continue après retour du lanceur. Pas de boucle de renvoi. Stockage des événements
limité à 256/4 Mio et stderr à 16 extraits de 2048 unités UTF-16 ; ni toute la mémoire
du SDK ni un seul événement déjà matérialisé ne sont bornés par ce stockage.

Le résultat garde **`passed: false`, code 1 et `delivery: unverified`**, même si
`correlatedCallbackDenial` reconnaît ses critères partiels. `possibleSend` décrit
une neutralité observée ; si le lanceur n'obtient aucun rapport, il affiche
`unknown`, pas une preuve de non-envoi. Neutralité sans callback :
`attention: possible-send-without-callback`, arrêt, vérification humaine, aucun
retry. Les données de compte, cibles, textes et événements complets restent privés.

Les [tests du déroulé](../../../tests/claude-native-ask-runner.test.ts) injectent
un faux `query`, une horloge et un timer. Ils n'importent aucun SDK et ne lancent
pas Claude. Témoin corrélé partiel, mauvais handshake/inventaire/mode, hook précoce,
ask ignorée avec compteur factice à 1, règle étrangère, erreurs, annulation,
attentes suspendues, plafonds et nettoyage. Le script manuel est seulement lancé
avec `--help` ou des arguments invalides pendant cette préparation ; le chemin
complet `--run` n'avait pas encore été exécuté. L'essai autorisé ensuite figure
dans le bilan ci-dessous ; le second contrôle n'y a pas été atteint.

Revue Claude Opus5.5 via Palabre Relay, arrière-plan et lecture seule : trois
fichiers lanceur/déroulé/tests et cette section lus, pas de test exécuté. Le
relecteur n'a pas relu le banc, le SDK, le Web ou des traces privées. Réserves
intégrées : UUID non vérifié par le lanceur, capture avant nettoyage avec trois
régressions de callbacks de fermeture, risque de refus précoce consommant du quota.

Vérification finale de cette préparation : 21 tests nouveaux, 55 ciblés avec les
bancs et la documentation ; syntaxe du `.mjs` et compatibilité structurelle de la
surface `query` vérifiées sans runtime SDK. `pnpm check`, `pnpm test` et
`pnpm build` réussis après corrections (1247 tests, 1242 réussis, 5 ignorés).
Vrai profil Palabre inchangé ; `git diff --check` réussi et prototypes absents du
build produit. Pas d'exécution du chemin manuel valide, SIGINT/écriture de trace
réels non éprouvés par les tests ; aucune qualification native supplémentaire.

## Essai du second contrôle — 27 octobre 2026

Le propriétaire a confirmé le nouveau message exact, la conversation jetable
toujours ouverte et le risque de réception malgré le refus attendu. Identité
recoupée avant lancement : titre/dossier/UUID concordants, nom unique dans le
registre, PID vivant et heure de création concordante. Aucun fichier de clé lu.
Ce contrôle extérieur n'authentifie toujours pas atomiquement le routage par nom.

Un seul `--run`, SDK0.3.302 et messager CLI2.1.302, destinataire Desktop déclaré
2.1.308. Opus5.5 observé pour les événements assistant ; le bilan `modelUsage`
compte aussi Haiku5.5 auxiliaire. Aucun repli configuré, aucune relance.

| Observation | Résultat |
| --- | --- |
| Handshake, prompt et inventaire | Version/hooks vérifiés, prompt libéré, `SendMessage` seul, aucun MCP, mode `default` |
| Appels observés | Un `SendMessage`, un hook capturé sans erreur |
| Premier contrôle | **Refus**, aucune neutralité |
| Second contrôle | **Aucun callback** : `matchedAskRule` et la règle ask ne sont pas éprouvés |
| Refus runtime | Même session/ID, `is_error: true`, `permission-rule`, `reject/source: hook` ; refus final lié |
| Fin et nettoyage | `success`, pas d'erreur, timeout ou troncature ; fermeture demandée, aucun callback tardif observé |
| Verdict | `correlatedCallbackDenial: false`, `passed: false`, `delivery: unverified`, code 1 |

Le hook a refusé parce que `content` diffère du texte prévu. `message` et `summary`
conservent chacun les 101 octets du texte exact ; dans cet échantillon, `content`
égale ses 49 premières unités UTF-16 suivies de `…` (50 unités au total). Nom,
`type: message`, `recipient_kind: name` et jeu de sept clés concordent avec la
garde candidate. Cette relation ne prouve ni l'origine de la transformation,
ni que `content` n'est qu'un aperçu sans effet sur la livraison.

L'événement assistant contient cette fois lui aussi `summary` (sept clés), alors
que l'oracle candidat attend six clés à cet endroit : autre variation négative,
pas la cause du refus du hook. Ni événement assistant assimilé à la sortie brute
du modèle, ni champ supprimé ou normalisé pour faire passer le constat.

Le résultat ne dit **pas** que la règle ask échoue : elle n'a pas été atteinte.
Le garde, le lanceur et l'oracle restent inchangés. Une régression entièrement
factice conserve le texte complet et `content` distinct, et exige encore le refus
avant callback. Recoupement de la trace privée hors ligne, sans runtime SDK.

Deux lectures passives bornées de l'historique localisé, après l'essai puis plus
tard, n'ont pas trouvé le marqueur ; taille/date stables pendant chacune. Le propriétaire confirme
ne voir aucun message de test dans Desktop, sans saisie pour rafraîchir. Observations
ponctuelles, pas preuve contre toute réception différée ou retenue. Aucun compteur
du gestionnaire natif disponible, donc aucune mesure d'exécution zéro annoncée.
Registre de confiance de même empreinte avant/après ; trace et identités privées.

Vérification de ce bilan : 57 tests ciblés réussis (bancs, lanceur et liens),
dont deux nouvelles régressions fictives ; vrai profil Palabre inchangé. Inspection
hors ligne de la trace réussie, sans SDK ni nouvel appel modèle. Aucun changement
des contrôles, du lanceur, de l'oracle, du code produit ou des permissions.

Suite : analyser la représentation reçue, puis définir éventuellement un nouvel
essai distinct avec accord humain sur un nouveau texte. Ne pas raccourcir ou
renvoyer automatiquement celui-ci, supprimer sa réservation ou assouplir la garde
pour atteindre le callback. Aucun envoi positif, transport produit ou comportement
Desktop qualifié par ce résultat.

Revue Claude Opus5.5 via Palabre Relay en arrière-plan et lecture seule : bilan
final et nouvelle régression lus, aucun test exécuté, aucune trace privée ou
source Web consultée. Les observations natives lui étaient rapportées, pas
vérifiées indépendamment. Aucun défaut important relevé. Réserve de couverture
intégrée : une fixture distincte part désormais d'une preuve factice conforme et
ajoute seulement `summary` à l'événement assistant ; l'oracle doit la refuser,
sans qu'un état fermé masque ce critère. Contrôles et oracle restent inchangés.

Choisir un futur texte pour que `content` égale le message pourrait permettre
de franchir le premier contrôle : l'accord humain devrait couvrir explicitement
l'envoi possible si la règle ask n'est pas appliquée. Ce n'est ni un test autorisé
ici ni une raison de renvoyer le texte précédent.

## Analyse statique du raccourci — 27 octobre 2026

Lecture des deux traces déjà enregistrées, du code du banc et du SDK0.3.302
installé ; aucun import runtime SDK, appel Claude, extraction du binaire ou
nouvel envoi. Recoupement sans imprimer texte, identité ou données de compte :
dans les deux échantillons de 101 unités UTF-16, `content` contient les 49 premières
unités suivies de `…`, aussi bien dans l'événement assistant que dans le hook.
`message` reste complet et le hook contient un `summary` complet. Les deux traces
n'ont aucun `stream_event` : aucune entrée brute du modèle à comparer ici.
Deux échantillons ne définissent pas une limite générale ou son unité pour Unicode.

| Étape inspectée | Ce que la lecture établit |
| --- | --- |
| Prompt du banc | Texte du plan complet sérialisé ; la consigne de conserver les aperçus ne constitue pas un contrôle du runtime |
| SDK `ProcessTransport.readMessages` | Ligne stdout analysée par `Fe`, qui appelle `JSON.parse`, puis objet rendu sans sélection de champ |
| SDK `Query.readMessages` | Événement assistant placé dans la file ; aucun raccourcissement de son entrée sur ce chemin inspecté |
| SDK `handleControlRequest` / `handleHookCallbacks` | `request.input` passé au callback enregistré, sans transformation du texte dans ces méthodes |
| Capture du banc | Copie JSON bornée, refus en cas de dépassement ; pas de découpe des chaînes |

Référence locale reproductible : `sdk.mjs`0.3.302, SHA-256
`baf41bb694a59df1a1ac2577b06d759c5cd81f4f13953161c1a91c4b54434d6b`.
Les noms de méthodes servent de repères dans le fichier minifié, pas d'API à appeler.
Les recherches ciblées dans les fichiers JS/types livrés ne fournissent pas le
gestionnaire natif `SendMessage` ; ce constat ne couvre pas le binaire non inspecté.

Le [changelog officiel SDK0.3.292](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md#03292)
annonce l'ajout de `recipient_kind` aux entrées `SendMessage` des événements
assistant. C'est une preuve documentaire que cette représentation peut être
enrichie, pas une explication de `content`, `summary` ou de leur origine dans ces
essais. La [référence des outils](https://code.claude.com/docs/en/tools-reference)
décrit `summary` comme aperçu facultatif, raccourci au-delà de 200 caractères :
ce contrat ne décrit pas le `content` de 50 unités constaté ici. La page des hooks
inspectée ne décrit toujours pas l'entrée `SendMessage`.

Conclusion bornée : aucune découpe dans les chemins Palabre/client SDK inspectés ;
la représentation raccourcie arrive déjà à ces consommateurs. **Attribution au
modèle ou à une transformation interne de Claude Code non établie**, champ réellement
livré toujours non établi. Aucun décodeur plus permissif justifié par cette lecture.
La question utile à résoudre avant une autorisation positive est le contrat entre
l'entrée modèle, l'entrée du hook et le texte livré, pas seulement la longueur du
message. Un prochain essai sur texte court ne résoudrait pas à lui seul ce contrat.

Avant publication, revue statique indépendante Codex interne du diff public et
des modules publics : aucun défaut important relevé. Ce n'était pas un appel
Claude/Palabre ; ni tests, SDK, Web ou traces privées consultés par ce relecteur.
Les faits réels et constats SDK lui restaient rapportés. Les 57 tests ciblés et
les liens ont été revérifiés par l'auteur, vrai profil Palabre inchangé.

## Relais vers Anthropic — 27 octobre 2026

Question sur le contrat d'entrée publiée après relecture Claude via Palabre et
accord humain explicite :
[claude-code #105445](https://github.com/anthropics/claude-code/issues/105445).
Titre et corps en anglais, aucun historique, identifiant ou texte de test privé
joint. La relecture portait sur le brouillon, pas sur une vérification indépendante
de toute la documentation. Lien conservé pour reprendre la recherche ; aucun
nouveau test natif ou changement des contrôles ne découle de cette publication.
