# Changelog

Toutes les evolutions notables de Palabre CLI sont consignees ici. Format inspire de [Keep a Changelog](https://keepachangelog.com/), versionnage [SemVer](https://semver.org/).

## [0.6.2] - 2026-06-08

### Fixed

- Nettoyage des sorties parasites `taskkill` Windows dans l'adapter CLI, notamment le bruit localise francais/mojibake que Codex peut emettre apres l'arret de process enfants.

### Added

- Ajout de `pnpm smoke:real-presets`, un smoke test de release qui lance de vrais debats sur les presets prioritaires disponibles et verifie le flux agent -> NDJSON -> export Markdown.

## [0.6.1] - 2026-05-31

### Changed

- Mise a jour de maintenance CLI et documentation associee.

## [0.6.0] - 2026-05-21

### Added

- Contrats d'integration stabilises pour l'extension VS Code : renderer NDJSON v1, `palabre presets --json`, `palabre context scan --json`, erreurs structurees et exports partiels.
- Support des workflows de contexte et des presets exposes dynamiquement aux integrations.
