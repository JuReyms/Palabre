# Messagerie native Claude : contrôles envisagés #193

État du 27 octobre 2026 : préparation hors ligne, puis un seul essai natif de refus
autorisé, dont le bilan est ci-dessous. La préparation ne lançait aucun modèle ;
l'essai a utilisé le SDK et un modèle, sans ouverture/fermeture d'app ni changement
de réglage utilisateur. Une réception n'est pas observée dans la lecture ciblée
décrite plus bas ; aucune garantie générale de non-envoi n'en découle. Les
[essais sur faux MCP](CLAUDE-MESSENGER.md) ne qualifient pas l'outil natif.

## Conclusion

Une piste documentée peut forcer le passage par un second contrôle : une règle
`permissions.ask` portant sur le nom complet `SendMessage`, au lieu du seul retrait
de `allowedTools`. L'application à l'outil natif reste **à tester**, pas acquise.
Le schéma d'entrée complet et la liaison à une conversation précise ne sont pas
établis ; aucune autorisation d'envoi ni décodeur natif n'est implémenté.

## Ce que les sources permettent de distinguer

| Contrôle | Appui disponible | Limite pour Palabre |
| --- | --- | --- |
| `PreToolUse` | Le hook reçoit l'outil, ses arguments, la session et l'ID d'appel avant exécution | Premier refus runtime lié observé, comparateur strict négatif ; pannes natives non testées |
| Retrait de `allowedTools` | N'ajoute pas de préapprobation | Un outil peut s'autoriser lui-même avant `canUseTool` |
| `permissions.ask: ["SendMessage"]` | Les règles ask documentées passent avant les autorisations ordinaires et conduisent au callback | Piste native, pas une qualification runtime |
| `permissions.deny: ["SendMessage"]` | Refus complet documenté, outil retiré du contexte | Empêche aussi d'observer une proposition normale du modèle pour cet outil |
| Contrôle du destinataire et du texte | À faire dans le callback sur les entrées réellement observées | Le nom d'outil seul ne valide ni adresse, ni contenu, ni unicité |

Sources officielles relues le 27 octobre : [hooks SDK](https://code.claude.com/docs/en/agent-sdk/hooks),
[ordre des permissions SDK](https://code.claude.com/docs/en/agent-sdk/permissions),
[outils natifs](https://code.claude.com/docs/en/tools-reference) et
[refus complet de messagerie](https://code.claude.com/docs/en/cross-session-messaging#turn-off-cross-session-messaging).
`SendMessage` n'exige pas de permission par défaut : ce fait ne rend pas une règle
ask impossible. La politique `always_ask` du faux MCP n'est pas celle de cet outil.

La [syntaxe générale des permissions](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
décrit aussi des règles ask/deny par paramètre scalaire. Elles ne constituent pas
une liste d'envois autorisés : paramètre absent non couvert, règles distinctes,
pas d'accord sur un destinataire et un texte liés. Ne pas inventer une règle
`SendMessage(to:...)` à partir du faux champ `recipient`. Retenir le nom complet
pour l'essai envisagé ; le contrôle exact reste à construire.

## Inspection locale, sans runtime SDK

Dans le paquet SDK0.3.302 déjà installé, `sdk.d.ts` contient les deux noms natifs
dans `BUILTIN_TOOL_NAMES`, `PreToolUseHookInput.tool_input: unknown`,
`CanUseTool` avec `toolUseID`, et `Settings.permissions.ask?: string[]`.
Le fichier `sdk-tools.d.ts` ne déclare pas d'entrée `SendMessageInput` ou
`ListAgentsInput` : la liste des noms ne fournit pas leur schéma.
La mention de `SendMessage({to: name})` dans la documentation d'un sous-agent
ne définit pas le contrat complet de messagerie inter-sessions.

Un fichier local ignoré a été compilé avec `tsc --noEmit` : options natives,
règle ask et deux callbacks de refus compatibles avec ces types. Imports de types
uniquement ; aucun `query()`, chargement du runtime SDK, processus Claude ou
fichier de paramètres appliqué. Les chaînes de règles sont typées `string[]` :
ce contrôle ne valide **ni leur analyseur ni leur effet réel**. La CLI2.1.302
a seulement été interrogée avec `--help` ; aucune commande d'export de schéma
n'y a été identifiée, sans conclure à son absence dans toute interface.

## Identité : ne pas confondre nom, adresse et conversation

La [documentation de découverte](https://code.claude.com/docs/en/cross-session-messaging#see-which-sessions-claude-can-reach)
décrit les noms et des identifiants courts pour les homonymes. Elle ne donne pas
ici de liaison vérifiée entre UUID de transcript, entrée Desktop et adresse exacte
de `SendMessage`. Un nom unique à un instant ne prouve pas cette liaison ni sa
stabilité. Aucun scan de secrets, token ou socket privé n'a été effectué.

Une proposition de schéma par le modèle ne suffit pas non plus : relever l'appel
structuré, sa validation par la CLI et les résultats liés avant de coder un
décodeur natif. Tout champ inconnu ou variation doit rester un refus, sans
normalisation du texte et sans repli du nom vers une autre session.

## Premier lanceur préparé hors ligne

Le [lanceur manuel](claudeNativeProbe.mjs) et son [module de banc](claudeNativeProbe.ts)
préparent uniquement le **premier** essai. Ils ne sont ni importés par la CLI,
ni livrés dans `dist`, ni lancés avec des paramètres valides par `pnpm test`.
L'aide et les arguments invalides restent accessibles sans charger le SDK :

```powershell
node scripts/prototypes/relay/claudeNativeProbe.mjs --help
pnpm build:test
node scripts/test.mjs .tmp/test-dist/tests/claude-native-probe.test.js
```

Ce lanceur ne configure volontairement **pas** de règle ask : le refus du premier
hook doit être observé séparément. `tools` ne demande que `SendMessage`, sans MCP
ou préapprobation ; hook et callback de permissions retournent toujours `deny`,
même si l'entrée ou sa capture échoue. Aucun chemin neutre, `allow`, mise à jour de
droits, décodage de destinataire ou reprise d'historique. Le second essai ask reste
seulement proposé ; aucune option ne permet de le lancer avec ce script.

Avant un lancement autorisé, l'agent préparera un plan privé explicite de forme
`{v: 1, target: {sessionId, directory, recipient}, message}` avec l'humain, sans lui
demander d'éditer du JSON. UUID, dossier et destinataire sont des déclarations à
vérifier, pas une liaison établie. Message conservé exactement, au plus 4096 octets
UTF-8 ; ni cible implicite ni champ supplémentaire. Le dossier déclaré doit exister,
mais le messager démarre dans un **autre dossier vide**, conservé pour le bilan.

SDK0.3.302 local et CLI Windows native2.1.302 sont exigés, sans installation ni
repli. Le prompt attend un handshake annonçant la bonne version et les hooks
appliqués ; une confirmation absente refuse de libérer le prompt. L'inventaire
`system/init` n'arrive qu'ensuite : sa vérification n'est **pas** un préflight
garanti avant le modèle. Inventaire inattendu : annulation, sans renvoi. Le hook
refuse toujours. Les plugins intégrés et le contexte implicite restent hors
garantie de confinement, comme dans les calibrations précédentes.

Le fichier de trace est réservé exclusivement avant `query()`. Même vide après
un arrêt, il reste conservé : ne pas l'effacer ou changer de nom pour rejouer une
tentative incertaine. Ce garde-fou de fichier n'est pas un anti-rejeu durable
inter-processus. Les observations capturées sont bornées et les événements ont un
budget de stockage ; cela ne borne pas toute la mémoire interne du SDK. Budget
coopératif de 120 s et fermeture demandée, pas retrait garanti d'un message.

Le lanceur n'imprime que des diagnostics sans identifiants sur stdout. Il garde
`passed: false`, code 1 et `delivery: unverified`, même si son constat partiel
`correlatedHookDenial` reconnaît un refus lié. **Aucun compteur d'exécution natif
n'est accessible au banc** : ce constat ne prouve pas une non-réception. Les entrées
opaques capturées ne sont pas annoncées comme un schéma natif validé par la CLI.

Les [tests](../../../tests/claude-native-probe.test.ts) utilisent des fixtures aux
clés arbitraires, sans SDK, compte ou conversation : plan, bornes de capture,
refus systématique, corrélation partielle et variantes négatives. L'aide et les
arguments invalides sont testés avec Node seulement. À la préparation, le chemin
complet `--run`, le handshake et les contrôles Claude n'avaient pas été exécutés.
Une compilation locale `tsc --noEmit`, à imports de types seuls, vérifie les
signatures contre SDK0.3.302 sans prouver son comportement.

## Premier essai natif autorisé — 27 octobre 2026

Le propriétaire a désigné une conversation Desktop jetable, son titre et son
dossier, puis autorisé la consommation de quota dans la suite de l'essai proposé.
Un seul `--run` a été lancé, sans relance. Avant l'appel : titre personnalisé et
dossier du transcript concordants ; un seul nom identique dans le registre ; UUID
et dossier concordants ; PID vivant et heure de création concordante avec
`procStart`. Ce recoupement local ne rend pas atomiques identité et envoi, et ne
constitue pas une authentification du routage natif. Aucun fichier de clé lu.

Messager : SDK0.3.302 et CLI native2.1.302 sous Windows. Le registre du processus
Desktop destinataire déclarait **2.1.308** : ne pas le confondre avec le messager
ni étendre les qualifications antérieures à cette version. Tour principal observé
Opus5.5 ; `modelUsage` comptabilise également Haiku5.5 auxiliaire.

| Observation de l'unique essai | Résultat |
| --- | --- |
| Handshake | Version attendue et `hooks_applied: true`, puis prompt libéré |
| Inventaire `init` | Seulement `SendMessage`, aucun MCP |
| Événement assistant | Un seul appel natif déclaré, nom sélectionné et texte de test exacts dans `to` et `message` |
| Premier hook | Une capture sans erreur, session et ID liés ; retour `deny` fixe |
| Résultat d'outil | Même session et ID, `is_error: true`, `permission-rule`, `reject/source: hook` |
| Fin SDK | `success`, `is_error: false`, un `permission_denials` lié ; pas d'erreur ni timeout global |
| Second callback | Aucun appel : aucun rattrapage par lui démontré |
| Verdict préparé | **`correlatedHookDenial: false`, `passed: false`, `delivery: unverified`, code 1** |

Le résultat négatif strict vient d'une différence d'entrée : l'événement assistant contient
`to`, `message`, `type`, `recipient`, `recipient_kind`, `content` ; le hook reçoit
aussi **`summary`**, absent de cette proposition. Dans cette observation, `summary`
égale le texte prévu, tandis que `content` est un aperçu raccourci déjà présent
dans cet événement. Rien ne prouve qu'il s'agit de la sortie brute du modèle :
la cause de l'ajout et l'origine des champs ne sont pas établies. Ces clés ne sont pas
promues en schéma natif validé : le refus arrive avant que le banc ait démontré
la validation ou l'exécution du gestionnaire natif.

Le comparateur opaque strict du banc refuse cette différence, malgré les autres
indices liés du refus runtime. **Aucune suppression de `summary`, normalisation,
modification du vérificateur ou relance pour obtenir du vert.** Un test conserve
cette forme minimale avec des identifiants/textes fictifs et attend toujours le
verdict négatif. Il faudra comprendre la transformation avant tout décodeur
ou autorisation positive ; ne pas choisir arbitrairement entre les champs.
Une future garde devra comparer le plan Palabre au champ dont la sémantique de
livraison est établie, pas traiter une de ces représentations comme référence.
La [référence officielle des outils](https://code.claude.com/docs/en/tools-reference)
décrit `summary` comme un aperçu et, en son absence pour un message texte, l'emploi
de sa première ligne. Cela rend l'enrichissement plausible, sans établir à quel
stade il se produit ici ni la sémantique du champ `content` observé. La documentation
inspectée ne suffit pas à qualifier l'entrée du hook comme une forme normalisée.

Après l'essai, une lecture du seul transcript localisé de la conversation jetable
(moins de 1 Mio, taille/date stables pendant cette lecture) n'a pas trouvé le
marqueur exact du test. **Absence observée**, pas preuve de non-réception : délais,
persistance et affichage Desktop restent distincts. Une seconde lecture passive,
plus tard, n'a pas trouvé le marqueur non plus, avec les mêmes bornes et une
taille/date stables. Ces observations ponctuelles ne couvrent pas toute réception
différée ou retenue. Le propriétaire a ensuite confirmé ne voir aucun message de
test dans Desktop ; ni saisie destinée à rafraîchir ni ouverture ne lui a été demandée.
Trace intégrale et données de compte restent privées ; registre de confiance
Palabre de même empreinte avant/après. Aucun nouveau message envoyé pour vérifier.

Revue Claude Opus5.5 via Palabre Relay, dans la conversation de revue fermée,
en arrière-plan et sans modification. Réponse et export reçus ; modèle observé
Opus5.5. Le relecteur a lu le bilan et le test, pas le vérificateur inchangé,
les traces privées ou les sources Web. Deux réserves ont été intégrées : employer
« événement assistant » sans présumer une sortie brute du modèle, et borner les
lectures d'absence dans le temps. Son hypothèse d'une normalisation par le runtime
reste une hypothèse, non une cause prouvée. Aucun second essai natif pour cette revue.

## Suite séparée

Deux vérifications séparées sont nécessaires :

1. Premier hook : refus runtime lié observé, mais comparateur strict négatif
   devant l'entrée enrichie. Analyser cette différence avant une extension.
2. Après bilan et accord distinct, laisser ce premier contrôle neutre et tester
   la règle ask avec `canUseTool` refusant tout. Sinon, un refus du premier hook
   masquerait l'absence du second contrôle.

Le premier essai n'est pas à rejouer ; le second reste à construire et autoriser.
Le [plan du second contrôle](CLAUDE-NATIVE-ASK-PLAN.md) sépare les questions de
schéma et de vérification de la règle ask, sans ouvrir de chemin d'envoi.
Conserver : seulement l'outil natif nécessaire,
aucun outil système/MCP, aucune préapprobation, aucun `allow`, un seul appel prévu,
versions vérifiées, trace privée et arrêt sans renvoi. Capturer l'ID et l'entrée
dans chaque contrôle ; aucun `updatedPermissions` ni changement de politique reçu
d'un agent. Vérifier l'inventaire et les événements ; pour l'essai ask, vérifier
aussi l'indication de règle appliquée dans le callback. Cette vérification arrive
après le prompt, pas en préflight public : le plan distinct explicite ce risque.

Avant chaque essai à quota : l'humain désigne une conversation jetable, son dossier
et un message bénin unique, et accepte les effets potentiels. **L'intention de
refuser n'est pas une garantie de non-envoi tant que le contrôle natif n'est pas
qualifié.** Ne viser aucune conversation de travail pour découvrir ce comportement.
Si une réception est observée malgré le refus attendu, arrêter et préserver les
preuves ; aucune relance ni changement de permissions pour réussir.

Même un refus natif réussi ne prouvera pas un envoi exact réussi, les pannes du
contrôle natif, l'anti-rejeu durable, la réponse du coéquipier ou sa visibilité dans
Desktop. Ces critères restent séparés. Aucune question Anthropic n'est publiée.

Vérification de la préparation : types compatibles, deux tests documentaires et liens
réussis, `git diff --check` réussi ; vrai profil Palabre inchangé pendant les tests.
Après préparation du lanceur : 12 tests spécifiques hors ligne, puis `pnpm check`,
`pnpm test` et `pnpm build` réussis (1206 tests, 1201 réussis, 5 ignorés).
Revue Codex interne indépendante du plan puis du lanceur en lecture seule : aucun
défaut important relevé. Le relecteur n'a exécuté ni test, runtime SDK ou modèle,
et n'a lu aucune trace privée. Cette revue précédait l'exécution du chemin réel.

Après le premier essai natif : régression hors ligne sur la différence `summary`,
sans modification du vérificateur ni rejeu SDK ; `pnpm check`, `pnpm test` et
`pnpm build` réussis (1207 tests, 1202 réussis, 5 ignorés, aucun échec).
Vrai profil Palabre inchangé pendant les tests. La revue Claude via Palabre et
ses limites sont consignées dans le bilan ci-dessus.
