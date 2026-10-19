# Reprise du 19 octobre 2026 : frontière des politiques Console

**Le blocage du profil habituel est reproduit sur le deuxième PC.** La connexion
OpenCode annoncée par le propriétaire permet de préparer un futur essai, mais ne
qualifie pas la neutralisation des intégrations. Aucun essai avec cette connexion
n'a été lancé. Aucun adapter produit ou scénario Desktop ajouté.

## Version et méthode

Reprise dans le worktree `.tmp/opencode-research`, branche
`codex/opencode-research-handoff`, synchronisée avec `origin`. Le checkout
principal contient du travail distinct, préservé.

Le premier inventaire, avant l'installation V2 par le propriétaire, avait relevé
`1.14.39`, puis un ensemble cohérent shim/paquet/binaire `opencode-ai` `1.19.3`.
La cause du premier changement n'est pas établie ; aucun essai moteur V1 retenu.

Après l'installation :

- paquet `@opencode/cli` `2.0.32` ;
- shim `%APPDATA%\npm\opencode.ps1` pointant directement vers
  `%APPDATA%\npm\node_modules\@opencode\cli\bin\opencode.exe` ;
- SHA-256 du binaire avant et après l'essai :
  `045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`.

L'empreinte est celle de `scripts/lab-paths.mjs`, sans modification du contrôle.
Les sources officielles ont été lues au tag `v2.0.32`, commit
`843a6c514e606b436a7fe713422ace0a93ad3d61`, dans une copie ignorée sous `.local/`.
Les connexions et bases du propriétaire n'ont pas été lues pour cet inventaire.

## Essai exécuté

Choix du chef de mission : rejouer seulement
`scripts/qualify-remote-policy.mjs`, déjà livré par le handoff. Le script crée des
HOME/XDG/ProgramData fictifs et une fausse connexion vers une Console sur
`127.0.0.1`. Il n'envoie aucun prompt et n'utilise aucun modèle.

Le premier passage sous le sandbox de l'hôte n'a pas atteint l'état prêt. Il ne
constitue pas un résultat sur les politiques. Le reproducteur et ses descendants
ont été identifiés par PID, parent et commande, puis arrêtés. Le second passage,
avec autorisation technique de l'hôte, a terminé en code 0 en environ cinq secondes.

| Observation du second passage | Résultat |
| --- | --- |
| Configuration demandée à la Console fictive | Oui |
| Métadonnée d'organisation dans la fausse connexion | Absente |
| Refus local des intégrations | Présent |
| Politique distante autorisant les intégrations | Fournie par la Console fictive |
| Requêtes reçues par le MCP témoin | **1** |
| Politique distante visible dans l'API de configuration | **Non** |
| Session, prompt ou inférence | Aucun |

Cela confirme le contre-exemple historique sur ce binaire. La requête témoin,
qui reçoit HTTP 404, prouve un début de connexion ; elle ne prouve ni une
initialisation MCP réussie ni l'exécution d'un outil. Les serveurs OpenCode du
second passage ont été arrêtés par le helper ; leurs codes de terminaison forcée
ne sont pas des résultats d'inférence.

Provenance locale, à ne pas publier : premier passage sous
`.local/remote-fUWtXi/`, second sous `.local/remote-kzwJFK/`, notamment
`traces/remote-policy-summary.json`. Les pièces restent ignorées par Git.

## Ce que les sources permettent de distinguer

Les [politiques documentées à cette version](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/services/www/src/docs/content/policies.mdx)
donnent explicitement la priorité à la Console. Leur `allow` peut lever un refus
de politique locale. Le [moteur de priorité](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/managed-policy.ts#L44)
ajoute les règles distantes après les documents, puis retient le dernier match.

Une permission et une politique sont toutefois deux contrôles différents :

- Dans [Permission.evaluateInput](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/permission.ts#L174),
  un refus effectif agent/session termine le contrôle avant les hooks de politique.
  Le [contexte du tour](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/session/context.ts#L131)
  fusionne les permissions de l'agent, puis celles de la session. Les permissions
  larges héritées d'un fork restent donc à traiter. Ce constat de source n'est pas
  un nouvel essai d'outils face à une politique distante.
- Le [filtre des MCP](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/config/plugin/policy.ts#L35)
  dépend de la priorité des politiques. Le [chargement Console](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/plugin/provider/opencode.ts#L419)
  ajoute les serveurs distants. Leur [démarrage asynchrone](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/mcp/index.ts#L533)
  ne requiert aucune session. Fermer les permissions d'une copie ne protège donc
  pas ce démarrage préalable.

Le blocage concerne au minimum ce deuxième chemin. Il ne faut pas en déduire
qu'un `allow` Console transforme tout `deny` de permission en autorisation.

## Pistes examinées et limites

| Piste | Pourquoi elle ne ferme pas le blocage démontré |
| --- | --- |
| Répéter `integration.use: deny` en configuration locale ou système | Les règles Console sont évaluées après ces documents. |
| Fermer les permissions de la copie | Contrôle pertinent pour les outils, pas pour le démarrage MCP sans session. |
| Inspecter l'API de configuration avant le prompt | Le contre-exemple distant n'y apparaît pas ; un MCP est déjà contacté. |
| Lire une fois la configuration Console | Le plugin la renouvelle périodiquement ; ce relevé ne fige pas la suite. |
| Désactiver le plugin Console par `plugins` | Le [superviseur](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/plugin/supervisor.ts#L51) respecte la [liste protégée](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/core/src/plugin/internal.ts#L272), conformément à la documentation. |
| `disabled: true` pour un serveur MCP connu | Le schéma configure les serveurs par nom ; cela n'établit pas un plafond pour tous les nouveaux noms fournis à distance. |
| Liste d'outils dans chaque prompt | Le [schéma PromptInput](https://github.com/anomalyco/opencode/blob/843a6c514e606b436a7fe713422ace0a93ad3d61/packages/schema/src/prompt-input.ts#L36) examiné n'expose pas ce plafond ; cela ne couvrirait de toute façon pas les connexions préalables. |

Aucune limite supportée indépendante des politiques Console n'a été établie dans
ces interfaces. Ce constat porte sur les chemins examinés en `2.0.32`, pas sur
l'impossibilité de toute solution future. Aucun contournement de politique,
reconditionnement du binaire, copie de clé ou interposition HTTPS n'a été essayé.

## Question amont préparée, non publiée

> **Comment imposer une restriction d'intégrations pour une exécution déléguée,
> tout en conservant la connexion Console et ses interdictions ?**
>
> Avec OpenCode 2.0.32 Windows, une Console fictive peut fournir un MCP et une
> politique `integration.use: allow`. Le moteur contacte ce MCP malgré une
> configuration locale `integration.use: deny`, avant tout prompt ou session.
> L'API de configuration ne montre pas la politique distante. Ce comportement est
> cohérent avec la priorité Console documentée.
>
> Existe-t-il une interface supportée pour fixer, au lancement d'un serveur privé,
> une liste fermée d'intégrations avant leur initialisation ? Les droits effectifs
> doivent respecter à la fois cette restriction de l'appelant et les interdictions
> de l'organisation. Aucun des deux ne doit pouvoir élargir la restriction de
> l'autre. La limite doit tenir lors des rafraîchissements Console et refuser le
> démarrage si elle n'est pas applicable.
>
> Vérifications attendues : aucun contact MCP sous restriction vide, même avec un
> nouveau nom et un `allow` distant ; aucun rétablissement après rafraîchissement ;
> une interdiction d'organisation reste appliquée ; un contrôle positif démarre
> le MCP lorsque les deux autorités l'autorisent.

## Vérifications et point de reprise

Les 12 tests hors ligne du handoff ont réussi lors de cette reprise avec
Node `24.19.0`. Aucun script de recherche ni contrôle d'empreinte modifié.
Le reproducteur Console/MCP a réussi au second passage. Les tests du dépôt
OpenCode ont été lus, pas exécutés. Aucun appel gratuit ou payant distant.

Prochaine action : obtenir une interface amont répondant à cette question, puis
la qualifier avec des témoins fictifs, y compris lors d'un rafraîchissement. Le
scénario avec connexion habituelle reste à préparer après cette preuve. Le code
produit, le choix du modèle et Desktop conservent leurs lots distincts.
