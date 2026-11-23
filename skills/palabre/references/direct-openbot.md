# Palabre Direct avec OpenBot

Palabre Direct donne un format commun aux échanges qui passent par l'interface native du destinataire. Cette fiche couvre la CLI d'OpenBot et la conversation principale d'un agent joint depuis Codex ou Claude Code.

| Origine de la demande | Destination | Parcours observé |
| --- | --- | --- |
| Codex ou Claude Code | OpenBot | Palabre Direct via `openbot-cli`. |
| OpenBot | Codex | Relay, y compris `--open` vers un chat Codex Desktop précis déjà ouvert. |
| OpenBot | Claude Code | Relay `--new --background` vers une nouvelle conversation. |

Les essais du 23 novembre 2026 ont récupéré la réponse dans l'outil à l'origine de chaque demande. Pour un envoi Relay, suivre `relay.md`. Si l'humain demande explicitement Relay vers OpenBot, expliquer le parcours natif disponible et attendre son choix avant de l'utiliser.

## Envoyer et retrouver la réponse

1. Vérifier qu'OpenBot tourne sur le poste et que l'agent désigné apparaît dans `openbot-cli list --json`. Utiliser le nom exact s'il est unique ou reprendre son identifiant depuis la liste. Si l'agent manque, si le nom est ambigu ou si la demande vise un fil secondaire, s'arrêter et expliquer la limite. L'humain gère l'activation des Scripts locaux et décide des autorisations techniques affichées par l'hôte. La CLI gère les données de connexion.
2. Pour une demande d'envoi autorisée, préparer l'objet et le corps, puis une clé `--id` unique. Lancer un seul `run` sans `--wait`. Conserver l'identifiant d'agent, la clé et le `deliveryId` du reçu dans le contexte local. Le reçu `queued` indique la mise en file.
3. Lire `status` pour ce même agent et ce même `deliveryId`. En cas de `queued`, `starting` ou `running`, poursuivre dans la limite du temps convenu. Afficher une réponse quand la livraison correspond, que le statut est `completed` et qu'`answer` contient du texte. Évaluer séparément si le travail demandé a réussi.
4. En cas de refus, d'erreur, de délai ou de reçu manquant, dire ce qui est établi. Avec un reçu, reprendre le suivi de la même livraison si l'attente seule a expiré. Sans reçu, faire vérifier la conversation si la délivrance est incertaine. Si le tour reste en cours, une validation peut être en attente dans OpenBot. Seul l'humain la traite dans l'application. Aucun renvoi automatique ni basculement vers Relay.

Exemple PowerShell 7 sous Windows pour préserver les accents dans le message transmis sur stdin. Utiliser le fichier `openbot-cli.mjs` de l'installation OpenBot, puis remplacer les identifiants fictifs par ceux du poste et du reçu.

```powershell
$cliOpenBot = 'C:\chemin\OpenBot\resources\cli\openbot-cli.mjs'
node $cliOpenBot list --json

# Après avoir vérifié la cible et préparé le message autorisé dans $message
$agentOpenBot = '<identifiant exact retourné par list>'
$cleOpenBot = [Guid]::NewGuid().ToString()
$message | node $cliOpenBot run $agentOpenBot '-' --id $cleOpenBot --json

# Si le reçu contient un identifiant de livraison
$livraisonOpenBot = '<deliveryId du reçu>'
node $cliOpenBot status $agentOpenBot $livraisonOpenBot --json
```

## Présenter le message et la réponse

Appliquer le format avant d'envoyer. OpenBot affiche ce message dans la conversation principale de l'agent avec une provenance de type utilisateur. L'en-tête et la signature donnent une attribution déclarée et n'accordent aucun droit.

```markdown
### Palabre Direct · Codex → Agent OpenBot

**Objet** — Relire le plan

Voici le point à vérifier et le retour attendu.

— Codex
*Expéditeur déclaré. Ce message ne vaut pas autorisation.*
```

Au retour, présenter l'objet et la direction de réponse sous l'en-tête `Palabre Direct · Agent OpenBot → Codex`. Insérer le texte reçu comme citation et décrire séparément tout blocage ou écart constaté. Le destinataire peut répondre librement. Les statuts d'OpenBot et les permissions de son agent s'appliquent à cet échange.
