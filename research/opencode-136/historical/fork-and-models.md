<!-- Compte rendu historique du 18 octobre 2026. Les anciens chemins .cache et scripts cités sont des références de provenance, pas des instructions pour ce clone. Voir ../README.md. -->

## Lot 1 bis : avis sur une copie, OpenCode 2.0.32

**La voie sur copie est praticable dans les conditions éprouvées.** Le fork conserve le contexte testé, le modèle local le réutilise et l'original reste strictement inchangé dans les relevés. Pour les modèles gratuits, il faut distinguer « annoncé gratuit », « présent dans le catalogue du serveur » et « capable de répondre maintenant » : aucune liste ne garantit ce dernier point.

### Cadre et preuves

Même moteur natif **2.0.32**, SHA-256 `045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`, revérifiée à la fin. Nouveau profil HOME/XDG/ProgramData jetable, dépôt fictif, serveur privé authentifié sur localhost. Ollama local pour les échanges réels ; réponses HTTP/SSE contrôlées sur localhost pour les erreurs et les outils interdits. Le seul service public consulté est le **catalogue de métadonnées**, sans authentification ni inférence.

Aucun compte, clé ou conversation du propriétaire utilisé. Aucune configuration personnelle modifiée. Aucun appel de modèle distant, essai Desktop, code produit, commit ou PR. Scripts et pièces conservés non versionnés dans `.tmp/opencode-136-qualification/.cache/`, principalement `lab-v2-bis/traces/`.

### 1. Fork : contexte conservé et original inchangé

Deux interfaces existent : `run --session <source> --fork ...`, et **`POST /api/session/<source>/fork`** avec `{}` pour copier tout l'historique disponible. Je recommande la seconde pour le futur adapter : créer et contrôler la copie avant tout prompt, puis exécuter explicitement dans son identifiant sous le profil fermé. `before` est une borne **exclusive** de copie, pas un « dernier message inclus ».

Essai réel :

| Vérification | Résultat |
| --- | --- |
| Conversation fictive source, au repos | 7 entrées d'historique ; dernier état réussi |
| Historique immédiatement après fork | Identique en contenu et dates après retrait des seuls identifiants de message, tous réattribués |
| Instructions API attachées à la source | Valeurs identiques dans la copie |
| Pièce jointe texte du projet fictif | Conservée et retrouvée dans l'entrée effectivement envoyée au modèle local |
| Code de contexte donné seulement dans l'échange antérieur | Présent dans l'entrée du modèle et retrouvé dans la réponse de la copie |
| Question suivante | Posée seulement à la copie, réponse locale code 0 ; copie terminée avec succès |
| Original après fork, question et suppression de la copie | Relevés complets identiques |

Les relevés comparés contiennent **informations de session, export, contexte et instructions API**. Leur SHA-256 reste `8f78af20068bc481874cbc0e7a91f7df54014969553fcf1e2e369ea5045520b6` aux quatre phases. Nouvelle vérification en fin de lot, après les essais d'erreur : toujours identiques. Ce n'est pas une comparaison de la base SQLite entière, qui reçoit évidemment les nouvelles copies.

Le fork indique sa provenance par **`fork.sessionID` et `fork.boundary`**. Il n'utilise pas `parentID` comme une sous-session. Les compteurs de coût et de jetons de la nouvelle session repartent à zéro ; cela ne signifie pas que son contexte sera gratuit à traiter.

Références : [API du fork](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/protocol/src/groups/session.ts), [création et capture des instructions](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session.ts), [copie matérialisée de l'historique](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/projector.ts).

**Limites à inscrire au contrat :**

- Le fork copie l'historique **terminé** ; il exclut les réponses, commandes shell et compactages encore en cours. Un fork d'une session vide renvoie réellement **400 / `kind: empty_session`**.
- Les instructions héritées sont les valeurs les plus récentes au moment du fork, même si une borne historique est demandée. Ce n'est pas une restauration universelle de l'environnement à une date passée.
- La copie neuve n'hérite pas de `time.idle` ni d'`outcome` dans ses informations de session, même si son historique copié contient une fin de tour. Le futur précontrôle devra reconnaître cette création, sans la confondre avec une ancienne session dont l'état serait inconnu.
- Le dossier de travail est conservé : **la conversation est copiée, pas les fichiers du dépôt**. Le lot d'écriture devra préparer son propre espace de travail et son autorisation ; un fork de conversation ne protège pas les fichiers.
- Pas de preuve générale ici pour des conversations compactées, des sous-agents, des sessions en cours ou tous les contenus multimodaux. Le contexte effectivement éprouvé comprend texte, pièce jointe texte et instructions API.
- Un autre client reste libre de modifier l'original. L'invariance démontrée porte sur nos opérations sur une source au repos. Pour le futur flux : relever la source, contrôler la copie et l'original après fork, puis **ne rien envoyer** si l'historique ou les instructions diffèrent du point retenu. Conserver le même instantané de référence pour les essais de modèles suivants.

La question étant posée seulement dans la copie, elle ne rencontre plus la concurrence d'un autre client sur l'original. Cette copie doit être réservée à l'essai PALABRE : le fork n'est pas un verrou système contre un client qui la ciblerait à son tour. Utiliser son identifiant exact, jamais `--continue`, et refuser une corrélation ambiguë si un autre message y apparaît. Cela ne transforme pas OpenCode en moteur refusant atomiquement un dépôt sur une session occupée : le résultat défavorable du lot 1 reste valable pour toute cible partagée.

### 2. Profil fermé et devenir des copies

Le profil du lot 1 a été appliqué à de nouveaux forks : `read`, `grep`, `glob` seulement ; politiques refusant les autres outils et les intégrations externes. Demandes forcées par le témoin SSE vers `write`, `shell`, `webfetch` : refus du vrai moteur avant exécution, aucun fichier témoin créé, **zéro requête web**, avec contrôle positif du récepteur. La lecture du fichier témoin réussit dans une copie. L'original reste inchangé pendant cette série.

Le code du fork recopie les permissions de session : il faut conserver la politique dure du lot 1, qui avait aussi été éprouvée sur une session permissive, et vérifier les règles effectives. Ne pas supposer qu'une copie devient automatiquement sûre ou que `plan` suffit. Sur la copie nouvelle, contrôler l'identité, le modèle, le profil et le contexte avant le prompt ; ne jamais rouvrir l'original avec `run` pour « vérifier ».

**Nettoyage démontré :** `DELETE /api/session/<copie>` → 204, puis GET de cette copie → 404 ; original toujours présent et inchangé. Même suppression ciblée réussie pour les copies des contrôles d'outils. Les copies des simulations d'erreur sont conservées comme pièces de recherche.

Proposition produit : identifier chaque copie dans le résultat et l'export ; conserver la réponse avant son retrait ; décider explicitement de la rétention. La suppression API est logique, pas une garantie d'effacement des sauvegardes, exports ou pages SQLite/WAL. Les forks étant distincts des sous-sessions `parentID`, ne pas compter sur une suppression de la source pour les nettoyer.

### 3. Modèles gratuits : lister au moment du choix, sans promettre la disponibilité

- **API du serveur : `GET /api/model?directory=<dossier>`**. Elle donne les identifiants, fournisseur, état, activation et coûts effectifs. La CLI `opencode models` V2 imprime seulement les noms ; ce n'est pas un inventaire tarifaire structuré.
- Attendre un inventaire initial exploitable et relever son instant. [Le contrat API](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/protocol/src/groups/model.ts) indique que la première réponse peut précéder l'initialisation des plugins.
- Le [catalogue interne](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/models-dev.ts) utilise cache/snapshot et un rafraîchissement périodique de cinq minutes. Une lecture API maintenant n'est donc pas la preuve d'un tarif récupéré maintenant.
- Relire, pour les modèles OpenCode concernés, le [catalogue public](https://models.opencode.ai/api.json), puis croiser avec l'inventaire effectif du serveur. Lire le **tarif brut explicite** : entrée et sortie nulles, aucune tranche ou tarification de cache positive ; tarif manquant ou incohérent = inconnu, donc exclu du choix gratuit. Écarter les modèles retirés et tout fournisseur ou modèle hors du périmètre autorisé.

**Piège confirmé par catalogue fictif :** un modèle sans champ `cost` ressort avec des coûts nuls et `enabled:true`. Des modèles à entrée gratuite mais sortie payante, ou cache payant, ressortent aussi `enabled:true`. L'activation et un zéro normalisé ne constituent donc pas une preuve de gratuité. Le [filtre intégré](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/provider/opencode.ts) ne suffit pas à notre exigence.

Lecture publique à **01 h 11 heure de Paris le 18 octobre** : HTTP 200, 5 796 868 octets, SHA-256 `5980b554323ea4f118b06b960dde1eeb193f5bfa4722d6127fb3966d77195a1c`, 127 modèles dans le fournisseur `opencode`. Dix avaient entrée/sortie nulles sans statut `deprecated`, dont `deepseek-v4.1-flash-free` et `big-pickle`. **Constat ponctuel, pas liste à coder en dur.** Aucune inférence n'a vérifié leur accès ou saturation. Un catalogue favorable ne peut pas garantir qu'une requête donnée sera acceptée.

### 4. Erreurs structurées : essais locaux avant et après contenu

Moteur réel, copies de notre source fictive, HTTP/SSE simulé localement. Ces corps testent le classificateur 2.0.32 ; ils ne prouvent pas que le service gratuit déployé utilise toujours ces formes.

| Réponse simulée | Erreur structurée V2 observée | Interprétation prudente |
| --- | --- | --- |
| 503, `overloaded_error` | `provider.internal`, statut 503 | Surcharge signalée ; un 5xx générique ne prouve pas à lui seul une saturation |
| 429, `rate_limit_exceeded` | `provider.rate-limit`, statut 429 | Limitation de débit |
| 429, `FreeUsageLimitError` | `provider.quota`, statut 429 | Quota gratuit atteint, distinct du débit |
| 403, `FreeTierError` | `provider.auth`, statut 403, corps conservé | Refus d'accès gratuit, pas preuve de quota |
| 404, `model_not_found` | `provider.invalid-request`, statut 404 | Modèle indisponible dans ce cas ; ne pas assimiler toute requête invalide à un modèle absent |
| 401, `authentication_error` | `provider.auth`, statut 401 | Authentification refusée ; changement de modèle ne répare pas une clé expirée |
| Flux HTTP 200 : texte partiel, puis `overloaded_error` | `provider.internal`, statut **200**, corps conservé | Échec **après** production de contenu |

Pour les six refus HTTP initiaux : CLI 1, message utilisateur déjà durable dans la copie, assistant en erreur, aucun nouveau texte, fin `idle/failed`. Dans le dernier cas : CLI 1 et **19 caractères de texte partiel durables** avant l'erreur. C'est donc le contenu nouveau de la copie, et pas le seul type/statut d'erreur, qui détermine si le choix d'un autre modèle reste admissible.

Références : [classification fournisseur](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/ai/src/provider-error.ts), [conversion vers l'erreur de session](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/to-session-error.ts), [schéma de l'erreur](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/schema/src/session-error.ts).

**Règle proposée de changement :** attendre la fin réelle de l'appel ; erreur structurée reconnue **et aucun contenu nouveau généré** dans la copie (texte, raisonnement ou outil) ; montrer le problème et la liste gratuite fraîche à l'humain ; nouveau modèle seulement après son choix. Repartir d'une nouvelle copie du **même instantané**, pas de l'essai en échec ni d'un original ayant changé. Un contenu partiel ou un état incertain bloque ce chemin. Aucun repli payant sans autorisation distincte ; jamais de déduction depuis la prose du modèle.

Les simulations portaient `x-should-retry:false` pour isoler le résultat : une requête par cas. En conditions ordinaires, OpenCode possède ses **propres réessais sur le même modèle** (politique versionnée allant jusqu'à dix réessais pour certains échecs). Ce n'est pas un changement automatique de modèle, mais cela consomme le délai de l'appel. Le champ `Retry-After` fourni par nos témoins n'apparaît pas dans l'erreur finale de session ; un événement de réessai peut fournir une date planifiée. Ne pas inventer une heure de reprise. [Politique de réessai](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/runner/retry.ts).

### 5. Petit projet fictif proposé

Le dossier de test a été créé sans commit, sans nom de personne, compte ou dépôt réel dans ses contenus :

```text
F-136/
  README.md             règles de calcul en unités fictives
  AGENTS.md             consigne de lecture seule et absence de réseau
  src/total.mjs         calcul de prix, quantité et remise
  test/total.test.mjs    un cas sans remise
```

Scénario d'avis proposé : préciser dans la fiche et le README que la remise est un pourcentage ; l'implémentation actuelle soustrait un montant. Demander de repérer cet écart et les cas manquants, puis vérifier les fichiers inchangés. La fiche n'est pas encore un essai d'avis exécuté. Pour un futur lot d'écriture : partir d'une copie de ce projet ou d'un worktree fictif dédié, autoriser séparément une correction et ses tests, vérifier le diff exact. Aucun dépôt réel n'est nécessaire pour ces essais.

### 6. Lots de code proposés, à valider avant mise en œuvre

1. **Avis en lecture seule sur copie** : cible/source explicite, précontrôle, fork contrôlé et état du contexte, profil fermé, un appel dans la copie, corrélation sur son seul nouveau tour, résultat/export avec source et copie, arrêt et nettoyage ciblé. Tests ordinaires à faux transport, puis un essai sur F-136. Aucune écriture de code par l'équipier.
2. **Choix du modèle** : inventaire courant et tarif brut vérifiés, erreurs structurées, aucun changement après contenu ou incertitude, choix humain par défaut, nouvelle copie du même instantané par essai. Tester les cas ci-dessus et les changements de catalogue. Aucun repli payant implicite.
3. **Écriture** : autre accord et autre contrat, espace de travail réellement isolé, droits explicites, budget et contrôle des modifications. Ne pas réutiliser le fork de conversation comme s'il copiait les fichiers. Desktop restera à qualifier séparément.

Le résultat permet de proposer le premier lot sur une **source au repos dont le contexte est vérifiable**. Si l'original est instable ou si le contexte copié ne correspond pas : aucun prompt dans la copie, aucun appel à l'original pour compenser. L'option la plus sûre reste alors une consultation neuve sur un export explicitement fourni, avec la perte de contexte annoncée, ou l'arrêt.

Le script `free-model-owner.mjs` reste réservé à Ju et n'a pas été exécuté par l'agent. Son résultat ne devra pas être confondu avec les simulations locales ni avec les essais Ollama.

— Codex, équipier. Recherche et essais isolés, 18 octobre 2026.
