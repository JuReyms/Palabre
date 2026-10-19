# Laboratoire OpenCode avec le profil habituel

Le premier essai réel a réussi le 19 octobre 2026 ; voir le
[bilan et les limites](habitual-profile-result-2026-10-19.md). La procédure est
conservée pour la provenance, pas pour demander de refaire cet appel.

## Décision du propriétaire, 19 octobre 2026

Pour OpenCode, Relay respecte l'environnement configuré par l'utilisateur :
connexions, modèles, permissions et intégrations. La désactivation générale des
MCP et plugins n'est plus une condition de départ. Les règles d'organisation
continuent à s'appliquer. Le cadrage Claude Code reste inchangé et sera discuté
séparément.

Le premier objectif devient **demander un avis dans une copie avec les permissions
habituelles**, puis observer le résultat. « Ne modifie pas les fichiers » est une
consigne de tâche ; ce parcours ne garantit pas un confinement ni une lecture
seule imposée. Les tests historiques avec profil fermé conservent leurs résultats
et leur périmètre.

Le propriétaire a indiqué utiliser OpenCode surtout pour des tests et comme agent
supplémentaire de débat. Le laboratoire emploie donc un nouveau projet fictif et
une nouvelle conversation désignée, sans réutiliser une conversation personnelle.
Aucune modification de configuration nécessaire à cette préparation.

## Préparer les fichiers, sans lancer OpenCode

Depuis la racine du worktree de recherche :

```powershell
$lab = node research/opencode-136/scripts/habitual-lab.mjs prepare | ConvertFrom-Json
Get-Content -Raw -LiteralPath $lab.instructions
```

Le préparateur crée un dossier neuf sous le dossier temporaire Windows, **hors du
dépôt Palabre**. `project/` contient quatre fichiers fictifs ; `control/` conserve
leurs empreintes initiales et un code de contexte unique, absent du projet.
Le préparateur ne démarre aucun processus, ne contacte aucun serveur et ne lit
aucune connexion ou configuration OpenCode. Le relevé ne couvre que ces quatre
fichiers : il ne prouve ni l'absence de nouveaux fichiers, ni l'état des sessions,
ni l'absence d'autres effets.

Pour vérifier ces témoins ultérieurement :

```powershell
node research/opencode-136/scripts/habitual-lab.mjs check $lab.root
```

Exécuter cette commande depuis la racine du worktree, ou utiliser le chemin absolu
du script. Aucun nettoyage automatique : conserver le dossier pour examiner les
résultats, sans commiter les traces de compte ou de conversation.

## Premier échange, dans l'interface du propriétaire

1. Ouvrir le projet : `opencode --standalone $lab.project`.
2. Choisir le modèle voulu dans l'interface **avant l'envoi**. Garder le modèle
   configuré s'il convient ; aucun modèle gratuit ou payant n'est sélectionné par
   le laboratoire. Une éventuelle facturation dépend du modèle choisi.
3. Dans une conversation neuve, envoyer le texte de `$lab.seedPrompt`, également
   présent dans `control/seed-prompt.txt`. Il demande seulement de retenir un code
   puis de répondre `ACK`, sans lire les fichiers.
4. Attendre la fin. Noter le modèle et l'identifiant exact `ses_...`, puis fermer
   l'interface. Si nécessaire, `opencode session list --standalone --format json`
   depuis le projet permet de retrouver la conversation par son dossier exact.
   L'ordre de la liste ne désigne jamais la cible.

Un serveur privé `--standalone` continue à utiliser les données et la configuration
habituelles. « Privé » décrit ici son processus, pas un profil isolé. Les connexions
aux fournisseurs et aux intégrations peuvent avoir lieu normalement.

## Étape suivante : consultation sur une copie contrôlée

Une fois la source et son dossier explicitement désignés, préparer un seul essai :

- vérifier la version/empreinte, l'existence de la source et son dossier ;
- relever informations, export, contexte, inbox et instructions de cette source ;
- créer une copie par l'API officielle et vérifier le contexte copié et la source
  avant de lui envoyer un message ;
- garder le modèle choisi dans la source pour ce premier essai, sans override
  silencieux ; rapporter le modèle réellement observé ;
- demander uniquement dans la copie : restituer le code retenu, relever l'erreur
  de remise en pourcentage et proposer des tests, sans modifier les fichiers ;
- vérifier la réponse terminée et attribuable, les relevés de la source et les
  quatre fichiers témoins. Examiner séparément les nouveaux fichiers éventuels.

La remise de `total` est volontairement implémentée comme un montant soustrait.
Un avis fonctionnel doit relever cet écart ; un `ACK` ou un simple code CLI 0 ne
suffit pas. Le code de contexte doit être retrouvé depuis l'historique copié,
sans être réintroduit dans la question de consultation.

Préparation vérifiée le 19 octobre : les deux tests hors ligne du préparateur et
du relevé passent ; le test initial du projet fictif passe. Un laboratoire concret
a été créé dans le dossier temporaire Windows habituel. Aucun processus OpenCode,
échange avec un modèle ou test de copie avec le compte du propriétaire n'a été
lancé par cette préparation. Son chemin et son code de contexte restent locaux.

L'identifiant source ne doit jamais recevoir le prompt d'avis. Un contexte
différent, un apport concurrent, un contenu partiel, un timeout ou une erreur
structurée interrompt la qualification. Conserver les identifiants et l'état de
délivrance ; aucun renvoi automatique ni changement automatique de modèle.
L'arrêt du lanceur ne promet pas l'annulation d'un tour déjà admis. Conserver la
copie et les traces jusqu'à examen ; la rétention finale sera décidée ensuite.

Les écritures du laboratoire, l'adapter produit et Desktop restent des étapes
distinctes. L'emploi futur de permissions plus larges fera l'objet d'un scénario
annoncé et d'une vérification des fichiers.

## Lanceur de recherche de l'essai réel

`scripts/habitual-copy.mjs` reçoit l'export Markdown et le dossier du laboratoire
par leurs chemins absolus. `PALABRE_LAB_OPENCODE` désigne explicitement le binaire
natif dont l'empreinte est vérifiée. Il démarre un serveur privé avec le profil
habituel, vérifie la source, crée un fork et contrôle son contenu avant de lancer
un seul `run` dans cette copie. Le prompt est transmis par stdin, sans shell.
Il ne passe ni `--model`, ni `--agent`, ni `--auto`, ni politique fermée.

Les appels API sont bornés, la sortie CLI est limitée à 4 Mio, l'appel à 150 s,
et l'essai global à environ quatre minutes, arrêt compris. Un timeout du client
déclenche une tentative d'interruption sur la seule copie : la délivrance peut
rester inconnue et aucun nouvel envoi n'est effectué. Les tentatives internes du
fournisseur restent celles d'OpenCode sur le même modèle.

Le résultat `verified-transport-review-to-inspect` est une preuve de transport,
de contexte et des relevés, pas une notation automatique de l'avis. Le contenu
de l'avis est inspecté séparément. Un code CLI 0 ne suffit jamais. Le test
`habitual-copy.test.mjs` couvre les mauvaises cibles, l'absence de modèle, la
concurrence, le contenu partiel, les erreurs d'outil et les tours ambigus, sans
OpenCode ni compte.

## Texte de mise à jour de #136, préparé mais non publié

> Décision du propriétaire, 19 octobre 2026 : pour OpenCode, Relay doit respecter
> l'environnement choisi par l'utilisateur, avec ses modèles, connexions,
> permissions, plugins, MCP et politiques d'organisation. La neutralisation
> générale des intégrations n'est plus un préalable au premier lot.
>
> Le contre-exemple Console reste valide pour l'ancien objectif. Le premier lot
> devient une consultation demandée sur copie avec les permissions habituelles,
> sans promesse de lecture seule imposée. Les essais démarrent sur un projet
> fictif et une conversation neuve désignée ; original, contexte, modèle, réponse
> et fichiers doivent être contrôlés. Aucun retry ni repli de modèle implicite.
> Le code produit et Desktop gardent leurs qualifications distinctes. Claude Code
> reste inchangé ; son cadrage sera discuté ultérieurement.
>
> — Codex MSI, recherche #136.
