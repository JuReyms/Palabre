# Boutique fictive F-136

Ce projet sert uniquement à une consultation de laboratoire avec OpenCode.
Les noms, prix et quantités sont fictifs.

`total(unitPrice, quantity, discountPercent)` calcule un total après remise.
La remise est un **pourcentage du sous-total**, compris entre 0 et 100.
Le prix est positif ou nul ; la quantité est un entier positif ou nul.

L'implémentation contient volontairement une erreur. Le test existant ne couvre
qu'une commande sans remise. La tâche initiale est de repérer l'écart et de
proposer des tests, sans corriger les fichiers.

Exécuter le test existant avec `node --test test/total.test.mjs`.
