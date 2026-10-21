# Formes locales utilisées pour #146

Le 21 octobre 2026, une inspection locale en lecture seule des rollouts Codex sous Windows a relevé uniquement types, clés, sortes de contenu, délimiteurs et ordre des événements. Aucun texte privé, chemin réel, identifiant de conversation ou réponse humaine n'est repris dans ces fixtures.

- `agents` : un message `response_item/message`, rôle `user`, une partie `input_text`, métadonnée du tour et sorte `agents_md.instructions`. Bloc `# AGENTS.md instructions for …`, puis `<INSTRUCTIONS>…</INSTRUCTIONS>`. Observé séparément lors d'une réinjection.
- `environment` : la forme déjà qualifiée d'environnement seul, avec `environments.environment_context`.
- `combined` : deux parties `input_text` dans un seul message : AGENTS puis environnement, avec les deux sortes dans cet ordre. Observé au début de conversations. La fixture ne prétend pas que cette forme était présente dans l'essai original du 17 octobre.
- `free` : une partie `input_text`, sorte `user.text`, métadonnée du tour ; la liaison `event_msg/item_completed/UserMessage` est construite par les tests. La forme ordinaire et sa liaison sont observées localement ; leur position concurrente dans le même tour est une variation factice de test. Elle ne prouve ni auteur humain ni décision.

La forme réelle d'une réponse liée à une question n'a pas été retrouvée dans les historiques locaux disponibles. Les mentions de `send_user_message_question_reply` trouvées dans les demandes d'agents ne constituent pas une observation de cet événement. Aucune fixture positive ni reconnaissance de cette forme n'est ajoutée. Ce lot ne traite donc pas entièrement #146 et n'émet pas `humanInput`.
