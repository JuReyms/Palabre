# Palabre — Relay : pilote OpenCode

Lire avant tout --copy ; ce parcours ne reprend ni les modes ni les garanties Codex/Claude de `relay.md`.

## OpenCode : consultation sur copie (pilote CLI)

Windows et OpenCode CLI 2.0.32 seulement, non publié. Un essai réel de la commande
sur projet fictif a réussi le 19 octobre 2026 ; Desktop hors périmètre. Ne pas
modifier les réglages Claude Code ou Codex pour suivre ce parcours.

```powershell
palabre relay --copy --to opencode:ses_ExempleSource --dir "C:\projets\exemple" --subject "Avis sur le plan" "Lis docs/plan.md et relève les risques, sans modifier de fichier." --json
```

Le propriétaire choisit la source, le dossier et le modèle dans OpenCode ; attendre
la fin puis fermer la conversation avant l'appel. Remplacer l'ID fictif ; jamais
« la dernière ». La source ne reçoit pas le prompt : un fork vérifié reçoit un
seul message. Agent, modèle, variante, connexion, permissions, plugins, MCP et
règles d'organisation sont conservés. Aucune neutralisation générale ; des
intégrations peuvent démarrer avant le message. Demander un avis sans modification
n'impose pas de lecture seule. Le fork partage les fichiers du projet : pas de
bac à sable ni d'autorisation supplémentaire. Aucun --auto ou modèle de repli.

Une seule notice système core/date strictement qualifiée peut précéder l'enveloppe
dans le nouveau tour : date et jour de semaine valides, texte/métadonnées exacts,
aucun ajout ni doublon. Les autres notices restent refusées. Cela ne prouve pas
une autorité et ne change aucune permission. Après refus, vérifier la délivrance,
jamais rejouer le modèle pour contourner le lecteur.

`copy.source` est la source demandée, `to.session` la copie vérifiée ou null.
`copy.session` conserve même une copie non vérifiée ; `copy.verified` ne prouve pas
la réussite du tour. Rendre source, copie, dossier, statut, délivrance et export.
Une réponse validée reste conservée si un relevé final, l'arrêt ou l'export échoue.
`persisted-no-reply`/`unknown` : aucun renvoi automatique. Une copie peut exister
sans ID après un POST incertain ; ne pas refaire le fork pour la retrouver.

Source et copie restent dans OpenCode même en échec ; --no-export désactive le
fichier, pas la copie. Les relevés de source ne sont pas un verrou global : ne pas
la réutiliser pendant l'appel. Timeout/annulation : interruption au mieux de la
copie, arrêt du serveur possédé (10 s de nettoyage maximum), aucun retrait promis.
Pour inspecter une copie connue depuis le dossier du projet :
`opencode --session ses_IdentifiantCopie`. Une nouvelle consultation Relay exige
encore `--copy --dir` et crée une autre copie ; ne jamais donner une commande de
reprise directe. Aucun --new, --open, --background, --check, --follow, --then-follow,
--write, --task, --pr ou Mission ici. La préférence relay.view ne s'applique pas :
mode: copy et modeSource: explicit, sans quota/lien Codex ni champ de suivi.
Version inconnue : le propriétaire vérifie `opencode --version` ; aucun contournement,
mise à jour ou repli automatique. La config Palabre doit être approuvée normalement.
