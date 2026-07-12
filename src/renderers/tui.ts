/**
 * @file Point d'entrée public du rendu TUI. Ré-exporte l'API des modules spécialisés :
 * `tui-renderer` (événements de débat/ask), `tui-screens` (écrans plein terminal),
 * `tui-prompts` (entrées readline et commandes slash). Les primitives visuelles de
 * `tui-theme` restent internes au rendu TUI et ne sont pas ré-exportées.
 */
export { createTuiRenderer } from "./tui-renderer.js";
export {
  renderTuiAgentsHelp,
  renderTuiConfig,
  renderTuiHelp,
  renderTuiHistory,
  renderTuiHome,
  renderTuiRolesHelp,
  renderTuiUpdate
} from "./tui-screens.js";
export {
  parseComposerTopic,
  parseTuiOllamaUrlCommand,
  promptTuiAgentsWizard,
  promptTuiConfigCommand,
  promptTuiHomeTopic,
  promptTuiRolesWizard,
  renderTuiComposer,
  type TuiAgentsWizardInput,
  type TuiConfigInput,
  type TuiHomeInput,
  type TuiHomeMode,
  type TuiRolesWizardInput
} from "./tui-prompts.js";
