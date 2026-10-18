<!-- Compte rendu historique du 18 octobre 2026. Les anciens chemins .cache et scripts cités sont des références de provenance, pas des instructions pour ce clone. Voir ../README.md. -->

# OpenCode 2.0.32 : connexion conservée, configuration remplacée

18 octobre 2026. Recherche, aucun code produit, aucune PR.

**Conclusion : la séparation locale fonctionne sur le profil fictif. La protection
avec une connexion Console quelconque n'est pas qualifiée : la Console peut
réautoriser un MCP avant le modèle. Le script d'essai gratuit demandé n'est donc
pas livré comme exécutable ; seul un diagnostic refusant cet essai est disponible.**

## 1. Essai réel, uniquement sur profil fictif

Moteur natif 2.0.32, SHA-256 vérifié avant et après :
`045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`.
HOME, USERPROFILE, APPDATA, XDG, ProgramData et fichiers temporaires fictifs.
Serveurs privés avec authentification éphémère sur localhost. Aucune donnée,
clé ou conversation du propriétaire utilisée.

Le profil fictif contient une conversation, une fausse clé pour le fournisseur
local, un plugin témoin, un MCP témoin et une règle autorisant les intégrations.
La fausse clé a été créée avant le remplacement de configuration. Les requêtes
au relais local d'Ollama confirment sa réutilisation, sans mettre cette clé
dans le compte rendu.

Montage testé :

- conserver XDG_DATA_HOME et XDG_STATE_HOME du profil fictif ;
- OPENCODE_CONFIG_DIR vers un dossier contrôlé vide ; OPENCODE_CONFIG_CONTENT
  contient exclusivement notre configuration ;
- retirer les autres sources explicites héritées, désactiver la découverte de
  configuration projet et la compatibilité Claude ;
- profil fictif sans réglages système, source wellknown ni connexion Console
  pour ce premier essai ; ces préconditions comptent.

Le code V2 utilise OPENCODE_CONFIG_DIR comme racine globale de configuration.
Il ne change pas, dans cet essai, le chemin de la base ni celui des identifiants.
Ce n'est pas une preuve que cette variable retire aussi les sources système
ou distantes : elle ne les retire pas.

Résultats :

| Contrôle | Constat |
| --- | --- |
| Plugin utilisateur autorisé, mais configuration remplacée | 0 import |
| MCP utilisateur | 0 démarrage |
| Déclarations du plugin/MCP dans GET /api/config | Absentes |
| Conversation source | Retrouvée dans la même base |
| Contexte après fork | Égal, après retrait des seuls IDs de messages réattribués |
| Ancienne fausse clé locale | Réutilisée pour l'appel dans la copie |
| Réponse d'Ollama dans la copie | Texte reçu ; un lancement CLI, deux requêtes fournisseur au passage final |
| Source avant fork, après fork, après réponse | Mêmes informations, export, contexte, inbox et instructions API |
| Copie | DELETE 204, puis GET 404 |
| Fichier de configuration utilisateur fictif | Inchangé |

Empreinte des trois instantanés de la source :
`bb90b1a6bcb6c1a3f8e771ec072bdf00bfcc3dbe52706bc4da079c126533ee4b`.

Un contrôle positif sans remplacement a d'abord importé le plugin et démarré
le MCP ; les zéros ci-dessus portent sur la phase isolée suivante. Le texte
du dernier passage Ollama ne respecte pas « Reply only OK » : une lecture
hors dossier est refusée, puis le modèle répond après sa limite d'étapes.
Ce passage prouve le transport et la clé, pas une réponse fonctionnelle `replied`.

Quatre contrôles supplémentaires utilisent un fournisseur SSE entièrement simulé,
pas Ollama : write, shell et webfetch refusés par la politique avant effet ;
aucun fichier témoin créé, zéro requête au récepteur web dont le témoin positif
avait réussi. read retrouve le témoin. Chaque copie est volontairement rendue
permissive pour vérifier que la politique dure reste nécessaire. Les outils
interdits peuvent être proposés au modèle mais leur exécution est refusée.
L'original reste inchangé pendant ces contrôles.

Limites : ce ne sont pas des essais de tous les outils, fichiers multimodaux,
compactages ou sous-agents, ni une isolation système. OpenCode écrit sa base,
ses journaux et caches de fonctionnement. La preuve porte sur cette source
fictive au repos et cette configuration fermée sans autorité distante.

## 2. Modèle par défaut lu comme des données

Sources locales à considérer en 2.0.32 :

1. OPENCODE_CONFIG_DIR, ou XDG_CONFIG_HOME/opencode, sinon ~/.config/opencode :
   opencode.json et opencode.jsonc ;
2. fichier explicite OPENCODE_CONFIG ;
3. opencode.json/opencode.jsonc des ancêtres du dossier de la conversation,
   et fichiers homonymes sous leurs .opencode, si la découverte projet est active ;
4. OPENCODE_CONFIG_CONTENT hérité, considéré seulement comme document de données ;
5. réglages système (%ProgramData%/opencode, /etc/opencode ou équivalent macOS)
   et préférences MDM macOS ;
6. sources wellknown enregistrées dans la base, et réglages Console : non
   résolus par la seule lecture des fichiers locaux.

Le lecteur expérimental `static-model.mjs` ne charge aucun module déclaré, ne
lance aucun moteur et n'effectue aucune substitution de fichier/environnement.
JSONC, modèle texte ou objet V2 sont acceptés. Documents illisibles, doublons,
modèle calculé, défaut absent ou plusieurs défauts différents : refus. Le choix
de refuser plusieurs valeurs différentes est volontairement plus restrictif que
la fusion native, même quand une priorité pourrait départager ces valeurs.
Le parcours local conservateur peut aussi relever une source que la découverte
native exclurait par sa racine canonique ; ce n'est pas une réimplémentation
complète de cette découverte. macOS/MDM reste refusé par ce lecteur.

Le modèle choisi dans une fenêtre ou l'ancien modèle de la conversation ne
prouvent pas qu'un défaut explicite existe dans les fichiers. Ne pas les
substituer silencieusement. Une future option --model explicite peut lever
l'absence de défaut, mais ne lève aucun refus de sécurité. Les définitions
personnelles de fournisseurs ne doivent pas être réimportées comme du code.

Dix tests ordinaires réussissent : syntaxe JSONC, refus des ambiguïtés et
substitutions, fichiers entièrement fictifs, présence de sources distantes
sans lecture des clés. Cela ne qualifie pas un résolveur complet de modèle
pour tous les profils.

## 3. Contre-exemple Console distante

Console simulée sur localhost et clé fictive, sans métadonnée orgID. Au démarrage,
elle fournit providers: {}, une politique integration.use '*' allow et un MCP
HTTP témoin. La configuration locale reste intégralement remplacée et contient
integration.use '*' deny.

Résultat avec le vrai moteur, sans session ni modèle :

- configuration Console demandée ;
- **une requête reçue par le MCP** ;
- politique distante absente de GET /api/config.

L'absence d'orgID ne prouve donc pas l'absence de politique distante. Inspecter
les fichiers ou cette seule API de configuration ne suffit pas.

Détection sûre avant démarrage : considérer une connexion Console (même sans
orgID), OPENCODE_API_KEY, des sources wellknown ou une autorité système inconnue
comme non qualifiées. Refuser avant de lancer le serveur. Une lecture ponctuelle
de /api/v2/config peut constater des règles dangereuses, mais ne verrouille pas
les réponses suivantes : le plugin Console est protégé contre la désactivation
et renouvelle sa configuration. Aucun script ne doit faire passer ce contrôle
ponctuel pour une barrière persistante.

Il reste à trouver une voie supportée pour imposer une limite d'appel que les
autorités distantes ne puissent pas élargir, ou pour les détecter et bloquer leur
activation avant leurs effets. Cette recherche n'en a pas établi une. Ne pas
retirer des règles d'organisation, copier des clés dans un autre magasin,
intercepter le HTTPS ou modifier OpenCode en guise de contournement implicite.

## 4. Script réservé à Ju

`owner-profile-preflight.mjs`, accompagné de `static-model.mjs`, est un
**diagnostic uniquement**. En-tête français explicite, SHA-256 obligatoire,
base ouverte en lecture seule ; seule la présence des connexions/sources est
interrogée, pas les clés. Aucun moteur, réseau, fork, question ou fichier rapport.
Le diagnostic refuse toujours l'essai, même si aucune source distante n'est
détectée : la qualification complète n'existe pas encore.

Il ne remplace pas le script modèle demandé. Ne pas demander à Ju de créer une
conversation ou de le lancer pour espérer une réponse gratuite à ce stade.
Lorsque la protection sera établie, la procédure sera : ouvrir un dossier fictif
dans OpenCode CLI habituel, créer une conversation sans données sensibles avec
le modèle gratuit souhaité, conserver son identifiant ses_..., fermer la
conversation, puis fournir cet identifiant et son dossier au futur script relu.

## 5. Provenance et pièces

Sources versionnées :

- [Racines XDG et configuration](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/util/src/global.ts),
  [discovery](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/config/discovery.ts),
  [assemblage des documents](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/config.ts) ;
- [stockage des connexions](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/credential.ts),
  [sélection de connexion](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/integration.ts) ;
- [Console : publication des politiques, MCP, rafraîchissement et GET /api/v2/config](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/provider/opencode.ts) ;
- [priorité des politiques](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/managed-policy.ts),
  [plugins Console et politique protégés](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/internal.ts) ;
- [API de configuration : documents uniquement](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/server/src/handlers/config.ts),
  [connexion asynchrone MCP](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/mcp/index.ts),
  [API du véritable export expérimental](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/protocol/src/groups/session.ts).

Correction de provenance : les anciens scripts appelaient /api/session/:id/export,
qui renvoie 404 en 2.0.32. Leurs comparaisons de cette réponse ne prouvaient pas
le contenu d'un export. Les autres relevés étaient distincts. Le nouvel essai
utilise /api/experimental/session/:id/export et exige HTTP 200 sur chaque pièce.

Scripts non versionnés dans `.tmp/relay-opencode-copy/.cache/` :
qualify-config-isolation.mjs, qualify-remote-policy.mjs, static-model.test.mjs.
Synthèses finales, profils distincts : local-isolation-2/traces/isolation-summary.json
et remote-policy-lab/traces/remote-policy-summary.json. Les passages antérieurs
sont conservés dans isolation-lab. Le témoin de clé est réinitialisé juste avant
l'appel dans la copie pour ne pas attribuer à cette copie l'authentification du tour de préparation.
Tous les serveurs témoins arrêtés, moteur relu identique. Arbre produit inchangé,
aucun commit, PR, modèle distant, compte personnel ou essai Desktop.
