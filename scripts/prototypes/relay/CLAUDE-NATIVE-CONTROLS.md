# Messagerie native Claude : contrôles envisagés #193

État du 27 octobre 2026 : recherche documentaire, puis premier lanceur préparé hors ligne.
Aucun appel modèle, SDK exécuté, message, inventaire de sessions utilisateur ou
lancement Desktop dans ce lot. Aucun réglage utilisateur modifié. Les
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
| `PreToolUse` | Le hook reçoit l'outil, ses arguments, la session et l'ID d'appel avant exécution | Refus natif et pannes encore non testés |
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

## Premier lanceur préparé, non exécuté avec Claude

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
arguments invalides sont testés avec Node seulement. Le chemin complet `--run`,
le handshake et l'application des contrôles par Claude restent **non exécutés**.
Une compilation locale `tsc --noEmit`, à imports de types seuls, vérifie les
signatures contre SDK0.3.302 sans prouver son comportement.

## Prochains essais réels, non exécutés

Deux vérifications séparées sont nécessaires :

1. Observer une proposition native avec `PreToolUse` refusant tout. Le résultat
   doit établir un refus natif corrélé, pas seulement un message final de Claude.
2. Après bilan et accord distinct, laisser ce premier contrôle neutre et tester
   la règle ask avec `canUseTool` refusant tout. Sinon, un refus du premier hook
   masquerait l'absence du second contrôle.

Le premier lanceur est préparé, le second reste à construire. Tous deux restent
à autoriser : seulement l'outil natif nécessaire,
aucun outil système/MCP, aucune préapprobation, aucun `allow`, un seul appel prévu,
versions vérifiées, trace privée et arrêt sans renvoi. Capturer l'ID et l'entrée
dans chaque contrôle ; aucun `updatedPermissions` ni changement de politique reçu
d'un agent. Vérifier l'inventaire et les événements ; pour l'essai ask, vérifier
aussi la règle effectivement appliquée, sans poursuivre si elle n'est pas vérifiable.

Avant chaque essai à quota : l'humain désigne une conversation jetable, son dossier
et un message bénin unique, et accepte les effets potentiels. **L'intention de
refuser n'est pas une garantie de non-envoi tant que le contrôle natif n'est pas
qualifié.** Ne viser aucune conversation de travail pour découvrir ce comportement.
Si une réception est observée malgré le refus attendu, arrêter et préserver les
preuves ; aucune relance ni changement de permissions pour réussir.

Même un refus natif réussi ne prouvera pas un envoi exact réussi, les pannes du
contrôle natif, l'anti-rejeu durable, la réponse du coéquipier ou sa visibilité dans
Desktop. Ces critères restent séparés. Aucune question Anthropic n'est publiée.

Vérification de ce lot : types compatibles, deux tests documentaires et liens
réussis, `git diff --check` réussi ; vrai profil Palabre inchangé pendant les tests.
Après préparation du lanceur : 12 tests spécifiques hors ligne, puis `pnpm check`,
`pnpm test` et `pnpm build` réussis (1206 tests, 1201 réussis, 5 ignorés).
Revue Codex interne indépendante du plan puis du lanceur en lecture seule : aucun
défaut important relevé. Le relecteur n'a exécuté ni test, runtime SDK ou modèle,
et n'a lu aucune trace privée. Les limites du chemin réel non exécuté sont conservées.
