# Qualifications MCP et PTY de l’audit run 1

Ces contrôles complètent les correctifs livrés dans les [PR #276](https://github.com/JuReyms/Palabre/pull/276) et [#277](https://github.com/JuReyms/Palabre/pull/277). Ils utilisent la vraie CLI Codex et le vrai pseudo-terminal Windows, avec des entrées de test. Ils se lancent manuellement depuis la racine de Palabre, après `pnpm build`. Pour le test Codex, obtenir l’accord du mainteneur avant le lancement et choisir le chemin exact de la CLI à qualifier.

## MCP sur un profil jetable

Sous Windows, prévoir Node.js, Git et une CLI Codex installée. Remplacer le chemin d’exemple par le chemin absolu de l’exécutable choisi ou de son shim npm reconnu.

```powershell
pnpm build
node scripts/qualify_codex_mcp.mjs 'C:\chemin\vers\codex.exe'
```

Le script crée un profil Codex et un projet jetables sous `.tmp/qualify-mcp-*`. Il réutilise le [serveur MCP témoin](../scripts/prototypes/relay/mcp-witness.cjs) dans les deux couches. Il configure un serveur d’inférence simulé sur `127.0.0.1` qui renvoie une réponse fixe. L’essai n’utilise ni compte ni quota de modèle.

1. L’inventaire doit retrouver exactement les deux connecteurs attendus sans les démarrer. Le script vérifie aussi leur commande, leurs arguments et l’absence de paramètres d’environnement ajoutés. Un écart arrête le scénario avant tout tour.
2. Le tour de contrôle démarre les deux témoins et présente leurs deux outils au serveur simulé. Ce contrôle valide les deux moyens de mesure.
3. La CLI reprend la même conversation avec les arguments de neutralisation générés par Palabre. Le tour doit se terminer, sans nouveau démarrage de témoin et avec zéro outil témoin dans la requête.

**Observé le 18 novembre 2026 avec Codex CLI 0.163.0.** Les deux témoins figuraient dans l’inventaire. Les deux tours se sont terminés et la reprise a conservé la même conversation. Le contrôle a observé deux démarrages et deux outils. La reprise n’a déclenché aucun nouveau démarrage et n’a exposé aucun outil témoin.

La mesure couvre les couches profil et projet. Une couche administrée reste à qualifier avec une politique réellement appliquée dans un environnement de test dédié. Le script appelle Codex avec les arguments de reprise de Palabre et mesure la neutralisation à ce niveau.

## Argument PTY vers un exécutable natif

Sous Windows, prévoir Node.js et le module natif `node-pty` du dépôt.

```powershell
pnpm build
node scripts/qualify_pty_native.mjs
```

L’adapter PTY de Palabre lance un petit programme Node local dans ConPTY. Le programme écrit les arguments reçus sous `.tmp/qualify-pty-*`. Le script compare ce tableau au prompt généré et exige exactement un argument identique, avec ses accents, espaces, guillemets, retours à la ligne et esperluette. L’essai ne lance aucun modèle.

**Observé le 18 novembre 2026 avec Node.js 24.22.2 et `node-pty` 1.1.0.** Le prompt complet a été reçu intact dans un seul argument et le programme s’est terminé normalement. Le résultat couvre l’exécutable natif. Les wrappers `.cmd` et `.bat` restent à qualifier côté PTY.

## Traces locales

Chaque script affiche un bilan JSON et le chemin relatif du dossier de preuve. Les journaux et historiques restent sous `.tmp/`, ignoré par Git. Les identifiants de conversation et les traces brutes restent locaux.
