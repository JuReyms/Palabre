# ADR-0001 — Reprise de session et checkpoints atomiques

- Statut : accepté pour le MVP
- Date : 2026-07-12
- Issues liées : #8, #19, #22

## Contexte

Les exports `.debate.md` et `.ask.md` sont des artefacts humains ; ils ne suffisent pas à reprendre de manière fiable une session interrompue. Les futures capacités de suivi conversationnel, de mémoire de décision et d’action contrôlée ont besoin d’une identité de session et d’un état machine explicites.

Cette ADR fixe le MVP de reprise sans introduire de session persistante côté adapters ni de streaming.

## Décision

### Portée du MVP

Le MVP couvre Débat et Ask exécutés en batch, après un arrêt du processus ou l’échec d’un agent. Il ne tente pas de reconnecter une CLI en cours d’exécution : un appel d’agent est soit non commencé, soit terminé avec succès, soit échoué/annulé.

Le chat de #19 reste stateless. Il ne dépend pas de cette ADR et ne doit pas prétendre bénéficier de reprise automatique ou de mémoire durable.

### Identité, emplacement et format

Chaque session qui demande un checkpoint reçoit un identifiant stable et stocke un état JSON versionné sous :

```text
.palabre/sessions/<session-id>.json
```

Le schéma porte un entier majeur `v`. Une version majeure inconnue ou un état invalide est refusé avec un diagnostic actionnable ; Palabre ne tente jamais une reprise approximative.

Les checkpoints sont **opt-in** au MVP, via une option de session ou un défaut de configuration explicite. Cet opt-in est nécessaire car l’état contient le transcript et des métadonnées qui peuvent être sensibles.

### Contenu minimal de l’état

- identité, dates, statut et phase de session ;
- options résolues non secrètes : mode, agents, rôles, modèles, tours, synthèse et limites ;
- référence canonique de la configuration et empreinte approuvée au démarrage ;
- références de contexte retenues et leurs empreintes ;
- transcript composé uniquement de réponses complètes validées ;
- phases terminées, phase suivante et diagnostics structurés nécessaires à la reprise.

Les secrets, arguments sensibles, sorties terminal brutes et sorties partielles ne sont pas persistés comme état de session.

### Points d’écriture et atomicité

Palabre écrit un checkpoint :

1. après résolution/validation de session, avant le premier appel d’agent ;
2. après chaque réponse complète acceptée ;
3. après la synthèse complète ;
4. à l’annulation ou à une erreur terminale.

Une réponse partielle n’est jamais ajoutée au transcript de reprise. Elle peut apparaître uniquement dans un diagnostic éphémère, assaini et borné.

Chaque écriture utilise un fichier temporaire dans le même répertoire, suivi d’un renommage atomique. Le dernier état complet reste ainsi utilisable après un crash pendant l’écriture.

### Reprise et sécurité

La reprise se fait par une commande explicite, par exemple `palabre resume <session-id>`. Avant tout nouvel appel externe, Palabre :

1. valide le schéma et l’intégrité de l’état ;
2. vérifie l’approbation et l’empreinte de la configuration ;
3. compare les références de contexte et avertit/refuse selon la politique si elles ont changé ;
4. affiche un aperçu de la phase qui sera relancée ;
5. demande confirmation en TTY avant de reprendre une session qui contactera un agent.

Le MVP ne rejoue jamais une réponse déjà marquée complète. Il relance seulement la prochaine phase non terminée ou une phase explicitement choisie pour retry.

### Rétention et confidentialité

Les checkpoints appartiennent au workspace et restent sous `.palabre/`, séparés des exports Markdown. Palabre doit fournir une commande de liste et de suppression explicite avant toute politique automatique de nettoyage.

Une future mémoire de décision est un artefact distinct : elle pourra indexer des décisions consenties par l’utilisateur, mais ne doit pas être déduite silencieusement des checkpoints.

## Conséquences

- Les adapters restent batch et sans sessions persistantes.
- Les contrats de session nécessaires aux futures fonctionnalités sont stabilisés sans empêcher le MVP chat stateless.
- Les parcours stateful, la mémoire durable et l’exécution riche devront s’appuyer sur ce format ou faire évoluer sa version majeure.
- L’implémentation se découpe ensuite en schéma, écriture atomique, commande de reprise, diagnostics et tests de crash/corruption.