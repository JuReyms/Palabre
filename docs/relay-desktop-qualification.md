# Ouverture et actualisation de Claude Desktop — essai Windows du 23 octobre 2026

## Résultat pour l'utilisateur

Une conversation Claude créée par Relay peut être ouverte dans Desktop pour
relire son historique. Dans le scénario testé, une réponse ajoutée ensuite par
Relay en arrière-plan n'apparaît pas dans la fenêtre déjà ouverte. Quitter
complètement l'app, puis relancer l'ouverture, a rendu cet échange visible.
Ce redémarrage est un dépannage ponctuel, pas le parcours normal visé.

## Observations, dans l'ordre

1. Une revue Relay en arrière-plan crée une conversation précise ; l'ouverture
   native `claude --desktop --resume <id>` réussit avec un terminal TTY, et le
   propriétaire confirme voir la revue dans Desktop. Sans TTY, Claude refuse.
2. Alors que le propriétaire a cette conversation ouverte, `relay --check`
   annonce `checked`, `mode: background`, `check.target: closed`. La sonde du
   registre Claude ne trouve aucun processus pour cette session. Cela ne prouve
   donc pas la fermeture de sa fenêtre Desktop.
3. Le mode ouvert explicite est refusé pour Claude (`unsupported-agent`), sans
   message : `--open` reste le transport Codex, pas une commande d'ouverture.
4. À la demande explicite du propriétaire pour ce test, un seul message témoin
   est réellement envoyé en arrière-plan. Un premier lancement a été refusé par
   le parseur avant tout appel Claude ; le texte est ensuite transmis par fichier.
   Résultat `replied`, identité `same-as-target`, délivrance `replied`, persistance
   et branche active signalées vraies. La réponse contient le témoin attendu.
   Aucun renvoi après délivrance, aucun changement de permissions/configuration.
5. Le propriétaire ne voit pas ce nouvel échange dans la fenêtre. Passer à une
   autre conversation puis revenir ne l'affiche pas non plus.
6. Relancer l'ouverture native échoue : Claude dit que la session est ouverte
   dans un autre terminal et conseille `/desktop` dans ce terminal. Ce diagnostic
   ne prouve ni l'identité du détenteur ni sa surface. Aucun verrou n'est forcé.
7. Le propriétaire quitte lui-même l'app via **Fichier > Quitter**. Une nouvelle
   ouverture native de la même conversation réussit, sans nouveau message ; le
   propriétaire confirme alors voir la réponse témoin.

## Portée

Essai unique sous Windows, sur la même revue et son historique partagé ; aucune
généralisation à toutes les versions, aux sessions occupées, à macOS/Linux ou à
un flux de génération en direct. Les identifiants et traces brutes restent locaux.
Les événements Relay et le retour humain sont des preuves distinctes : un code 0
du lanceur ne prouve pas à lui seul l'affichage. Aucun nouvel appel modèle n'est
nécessaire pour documenter cette preuve.

## Conséquences produit

- #225 : ouverture pour consulter, avec avertissement d'actualisation.
- #193 : dépôt/corrélation vers Claude ouverte et détection fiable Desktop restent
  non résolus ; l'absence d'entrée dans le registre CLI ne certifie pas sa fermeture.
- #219 : centraliser l'ouverture, en séparant le résultat du lanceur de l'état
  observé. Pour Claude, ne pas assimiler le registre CLI à un verrou Desktop ni
  promettre rafraîchissement, visibilité ou permissions. Ne jamais fermer l'app,
  archiver, supprimer, tuer son processus ou relancer un message automatiquement.
