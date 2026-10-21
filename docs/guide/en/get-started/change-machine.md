---
title: Change machines
description: Resume a project with Relay on another machine, including a previously used one, without transferring approvals or local conversations.
seo:
  title: Change machines and resume with Relay
  description: Preserve local work, update PALABRE and agents, reinstall the skill and start with a new Relay conversation.
---

Your project and its tracking travel through GitHub. Agent sign-ins, approvals and conversations stay local. On the destination machine, prepare PALABRE, then create a new teammate with `--new`.

This path applies to Windows, macOS and Linux. On a previously used machine, start with the inventory below. Do not delete any old clone or `.palabre/` folder before finding the work you need to keep.

## 1. Take inventory without changing installations

In each old clone, on both machines if they are accessible:

```text
git --no-optional-locks status --short --branch
git --no-optional-locks diff --stat
git --no-optional-locks diff --cached --stat
git log --oneline --branches --not --remotes
git worktree list
```

These commands show modified or untracked files, commits missing from local remote-tracking references and separate worktrees. References may be outdated: also check GitHub before concluding that a commit was pushed. `--no-optional-locks` avoids optional index refreshes during this inventory. Do not update a clone containing unsaved work yet.

After this inventory, refresh remote-tracking references (without changing your working files):

```text
git fetch --prune
git log --oneline --branches --not --remotes
git branch --remotes --contains <commit-sha>
```

A squash-merged branch may still appear: its commits were combined under another identifier. With the GitHub CLI already signed in, find the commit's PR, then check its state and diff on GitHub:

```text
gh api repos/<owner>/<repository>/commits/<commit-sha>/pulls --jq '.[].html_url'
gh pr view <pr-number> --repo <owner>/<repository> --json state,mergedAt,url
gh pr diff <pr-number> --repo <owner>/<repository>
```

Without proof that the work is preserved, keep the branch. Do not delete or force anything based only on `git log`.

Find which installations are being used. In PowerShell:

```powershell
Get-Command node,npm,pnpm,palabre,codex,claude,pwsh,powershell -All -ErrorAction SilentlyContinue | Select-Object Name,Source
```

In Bash or Zsh, on macOS or Linux:

```sh
type -a node npm pnpm palabre codex claude
```

For commands that are present, record their versions:

```text
node --version
npm --version
pnpm --version
palabre --version
codex --version
claude --version
```

Several paths may mean several installations. On Windows, a `WindowsApps` path may be a Microsoft Store alias rather than the expected installation. Do not delete anything just to hide a duplicate; identify the installation to keep using [Windows troubleshooting](/en/troubleshooting). Complete duplicate diagnostics remain tracked in [#153](https://github.com/JuReyms/Palabre/issues/153).

Check for duplicate npm and pnpm installations too, not just duplicate agents. Several wrappers from one installation do not prove a duplicate; compare their directories and versions. Report distinct installations without uninstalling them during this process.

Also check whether the personal PALABRE folder exists. PowerShell:

```powershell
if (Test-Path -LiteralPath "$HOME/.palabre") {
    Get-ChildItem -LiteralPath "$HOME/.palabre" -Force
}
```

POSIX shell:

```sh
if [ -d "$HOME/.palabre" ]; then
    ls -la "$HOME/.palabre"
fi
```

Locate project configurations (`palabre.config.json`, or the older `chicane.config.json`) and skill copies: `~/.agents/skills/palabre/`, `~/.claude/skills/palabre/`, the older `~/.codex/skills/palabre/` and project skill directories. Also check skills added through your application. Keep backups outside directories where agents load their skills.

### PALABRE installed from a repository clone (development version)

If `palabre --version` shows an old version installed from a clone, update the clone yourself, after preserving the work identified in step 1:

```text
git -C <clone-directory> switch main
git -C <clone-directory> pull --ff-only
pnpm -C <clone-directory> install
pnpm -C <clone-directory> build
cd <clone-directory>
pnpm link --global
palabre --version
```

Before 0.17.0, `palabre update` only displays instructions, and `--check` does not exist. If Git refuses the update (local changes, a different branch), stop and examine the situation: do not force anything.

If `node_modules` was created by another major version of pnpm, an installation without an interactive terminal may stop with:

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY Aborted removal of modules directory due to no TTY
```

In the clone, check the `packageManager` version in `package.json` and `pnpm --version`. Run `pnpm install` again in your terminal and confirm rebuilding dependencies only after preserving local work. If you choose to run without a terminal, pnpm's suggested remedy is `CI=true`, limited to this command. PowerShell:

```powershell
$previousCI = $env:CI
try {
    $env:CI = 'true'
    pnpm install
} finally {
    $env:CI = $previousCI
}
```

POSIX shell:

```sh
CI=true pnpm install
```

This operation may recreate `node_modules`; apply it only to the selected clone. If pnpm reports that the `node-pty` build script was ignored, that message alone does not prove a failure: the prebuilt binary may be sufficient, as in trial #171. From the clone, check that it loads with `node -e "require('node-pty')"`. If it fails, stop and keep the diagnostic; do not approve all dependency scripts by default.

## 2. Update the tools

For an installation from a clone, follow the [clone update instructions](#palabre-installed-from-a-repository-clone-development-version) above.

First preserve the work you found: review changes, then publish the commits or PR you want to resume. For work kept in a Relay worktree, follow [Retrieve the result](/en/usage/relay#retrieve-the-result). Until then, GitHub does not know about your local changes.

Install operating system updates, then check the [installation prerequisites](/en/get-started/installation), including Node.js 20 or later. If PALABRE is already installed:

```text
palabre update --check
palabre update
```

The first command checks without updating; the second shows the plan and asks for confirmation in the terminal. Depending on the installation, it may update the Git checkout and its dependencies or the global package. If PALABRE is missing, follow [Installation](/en/get-started/installation). Choose one installation source for each tool.

Update agent CLIs according to how they were installed too. For a native Claude Code installation:

```text
claude update
```

For Codex installed with npm:

```text
npm install --global @openai/codex
```

For other installations, use the [Claude Code](/en/agents/claude-code) and [Codex](/en/agents/codex) guides. Close and reopen the terminal, then record paths and versions again.

### Windows: check for PowerShell 7 outside Microsoft Store

Before your first Relay to Codex, check that PowerShell 7 installed outside the Store is present. The Store package itself, not just its alias, made some Codex commands fail during trial #171. A version number alone is not enough:

```powershell
Get-Command pwsh -All -ErrorAction SilentlyContinue | Select-Object Source
Test-Path -LiteralPath "$env:ProgramFiles/PowerShell/7/pwsh.exe"
```

If you find only `WindowsApps` or no PowerShell 7, install the non-Store version yourself:

```text
winget install --id Microsoft.PowerShell --source winget --installer-type wix
```

`--installer-type wix` requests the MSI: `--source winget` alone may still select an MSIX package. If the MSI is unavailable, follow the MSI or ZIP instructions in [Windows troubleshooting](/en/troubleshooting), without treating the Store as equivalent. Open a new terminal, then check again. For a standard installation:

```powershell
& "$env:ProgramFiles/PowerShell/7/pwsh.exe" --version
```

A custom installation may use another path: check that it is outside `WindowsApps`. Do not remove the Store package or change Codex permissions to bypass the block. See [Windows troubleshooting](/en/troubleshooting).

Check sign-in, then sign in only if needed:

```text
claude auth status
codex login status
```

```text
claude auth login
codex login
```

Choose the account and access terms yourself. Being signed in to Desktop does not prove that the CLI is signed in. Do not transfer sign-in files from `~/.claude/` or `~/.codex/`; keep the results of these checks on your machine.

## 3. Recreate, review and approve the configuration before Relay

An approved configuration is a prerequisite: otherwise Relay refuses to start with `config-untrusted` (code 8), even if `palabre agents --json` or `doctor` shows available tools.

In the project, run:

```text
palabre init
```

This creates the global configuration and approves the content it has just created. If that file already exists, it keeps it: it does not replace or repair an old configuration. To choose a project-specific configuration, use `palabre init --local` only if you want that scope.

Review the configuration actually being used, local or global: agent commands, absolute paths, models, export directory and Relay policy. An absolute path from the old machine may be missing here; `palabre config --sync-agents` deliberately preserves it. Adapt it using [advanced configuration](/en/configuration/advanced-json), without changing your security settings to make a test pass.

After reviewing an existing file, approve its exact content yourself. For the global configuration, in PowerShell or a POSIX shell:

```text
palabre config --config "$HOME/.palabre/palabre.config.json" --trust-config
```

For an existing project file:

```text
palabre config --config ./palabre.config.json --trust-config
```

Only approve the file actually selected; [local/global precedence](/en/configuration/local-vs-global) matters on a previously used machine too. An agent must not approve a configuration that grants itself rights on your behalf.

`--trust-config` is described in `palabre help`, not in `palabre config --help`. Run this command yourself in an interactive terminal: after approval, `palabre config --trust-config` also opens the configuration wizard. It is not an approval-only command. Exit the wizard without selecting a change if you only want to approve; do not run it from an agent or a non-terminal stream that might select an action on your behalf.

For approvals referring to missing files:

```text
palabre config --prune-trust --dry-run
palabre config --prune-trust
```

The preview writes nothing. Cleanup requires your keyboard confirmation and creates a timestamped backup. It keeps existing or inaccessible paths; it does not approve any file again. Never copy an approval registry from the old machine.

If your help does not offer `--new` in `palabre relay --help` or `--prune-trust` in `palabre config --help`, the version being used does not contain this path yet. After `palabre update`, if the published version still lacks these options, use [installation from the source repository](/en/get-started/installation#install-from-the-source-repository) to test the changes available on `main`.

## 4. Reinstall the skill

To install it for your agents on this machine, across all your projects:

```text
palabre skill --install codex
palabre skill --install claude
```

Run only the command for the intended agent. The skill comes from the running CLI package without network access; review the plan before confirming. Replaced customizations are backed up outside skill directories. For older CLIs without this command, follow [the skill guide](/en/get-started/skill) and copy the entire bundled folder, including references.

For existing copies, preview and then refresh:

```text
palabre skill --sync --dry-run
palabre skill --sync
```

An agent preparing installation must not add `--yes` without your consent. You select the agents and confirm the plan.

External tools such as `npx skills add/update` follow the GitHub repository rather than the installed CLI version; do not use them to certify that correspondence.

`palabre update` also offers refreshing detected copies in its single confirmation, with backups and preserved junctions. Check that only one version remains active for each agent, then reload the skill or resume the conversation.

## 5. Check with doctor

From the project:

```text
palabre doctor --terminal
```

Follow the actions in order: unapproved configuration, Microsoft Store PowerShell alias on Windows (reported when Codex is detected, see [Troubleshooting](/en/troubleshooting)), Claude Code or Codex sign-in, archived agent, skill and multiple locations. `doctor` does not approve, install or sign in. An unapproved configuration remains inspectable, but returns code 1 and permits no agent command or configured URL.

For an approved configuration, `claude auth status --json` and `codex login status` probes use the configured command, without its model arguments, without a shell and without a model call. Each probe is limited to 3 seconds and 32 KiB; an older CLI, unsupported wrapper, timeout or unknown output gives “not verified”. The reported state does not guarantee that an expired token can be refreshed or that a future call will succeed. No account data is displayed.

The skill is sought in `.agents/skills/palabre/`, `.claude/skills/palabre/` and `.codex/skills/palabre/`, in the project and personal directory. Presence does not mean loaded or up to date; a skill installed through the application may not be found. Duplicate diagnostics cover distinct PATH locations for Node, npm, pnpm, Claude Code and Codex, without reading versions or uninstalling anything. Neighboring wrappers count once; complete diagnostics remain tracked in [#153](https://github.com/JuReyms/Palabre/issues/153).

`doctor` may still check PALABRE's version with npm and contact Ollama servers from an approved configuration. It does not prove that Codex can read the project: the first Relay must still provide that evidence.

## 6. Find the project and create a new teammate

Resume the preserved clone, or clone your repository from its GitHub URL into a new directory. Read README, `AGENTS.md`, issues and PRs: they describe completed work, what remains and decisions needed. Prepare a short brief with those links, without a local conversation identifier.

From a new conversation with your agent, say for example:

> Use PALABRE to ask Codex to review docs/plan.md without changing any files. Create a new teammate and keep its identifier for follow-up.

Or, from the project terminal:

Before this call, complete approval in step 3 and, on Windows, the non-Store PowerShell 7 check in step 2. Also check agent sign-in and that a file is available to read.

```text
palabre relay --new --to codex --subject "Resume fictional project Orion" "Read README.md and docs/plan.md. Summarize what still needs checking, without changing any files." --json
```

For a Claude teammate, replace `codex` with your configured Claude agent name. This first call uses its account and model and may consume its quota. Desktop paths and platform limitations are detailed in [Your first Relay](/en/get-started/first-relay).

PALABRE does not transfer conversations from the old machine. An old identifier is not a new local target. `--new` returns a new identifier in `to.session`, with `cwd` and the delivery result; keep it locally for further exchanges. Check status, reply and evidence before continuing. No automatic resend after failure or unknown delivery.

`delivery.status: replied` proves that a response arrived, not that files were read. If `status` is `read-unavailable` or `readAccess.status` is `blocked`, stop: a plausible response is not a verified read. Follow troubleshooting, then decide yourself whether to try again.

## What to keep, recreate or leave local

`~` means your personal directory. `.palabre/` is relative to the directory from which you run PALABRE, usually the project. If you run it from your personal directory, that path may therefore be `~/.palabre/`. `outputDir` can select a different location for exports.

| Item | What to do |
| --- | --- |
| Unpushed code, untracked files, branches and worktrees | Preserve before any cleanup. Have the work reviewed and published to resume it; do not treat it as a cache. |
| README, `AGENTS.md`, decisions, issues and PRs | Shareable starting point, after checking that it contains no secret or conversation identifier. |
| `~/.palabre/palabre.config.json`, older config or project config | Recreate or adapt, then approve locally. Preferences can be reused after review; do not blindly copy paths. Only version a project config with shareable values, without secrets or personal paths. |
| `~/.palabre/trusted-configs.json` and its backups | Never copy to another machine or commit. Approval is local and deliberate. |
| `~/.palabre/relay-write/` | Local write approvals and state: do not transfer or commit. A worktree inside may contain unique work: recover its code before any cleanup. |
| Exports in `.palabre/` or `outputDir` | Keep locally if useful. They may contain private messages, paths and identifiers: do not transfer or commit them raw. Share a reviewed summary instead. |
| `.palabre/sessions/`, `.palabre/missions/` | Local state tied to files and configuration. They do not promise resumption on another machine; keep them on the old one while useful. Mission remains frozen. |
| Agent conversations and sign-in files, conversation identifiers | Stay on the original machine. Do not copy or commit them; sign in again and create new conversations. |
| Installed skill, dependencies and build output | Reinstall or rebuild. Preserve any customization before replacing a skill copy. |

Cleanup is a separate step, after verifying the new setup. This guide never asks you to delete all of `.palabre/`.
