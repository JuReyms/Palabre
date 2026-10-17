/**
 * @file Modèle du shim PowerShell généré par pnpm (`@zkochan/cmd-shim`), relevé sur des shims
 * installés par pnpm 10 sous Windows. Pour les tests des adapters et de Relay (#109).
 */

/** Shim pnpm complet : script relatif au dossier du shim (`/`), valeurs `NODE_PATH` Windows et POSIX. */
export function pnpmPowerShellShim(script: string, windowsNodePath: string, posixNodePath = "/proc/cygdrive/c/pnpm/global/5/.pnpm/node_modules"): string {
  return [
    "#!/usr/bin/env pwsh",
    "$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent",
    "",
    "$exe=\"\"",
    "$pathsep=\":\"",
    "$env_node_path=$env:NODE_PATH",
    `$new_node_path="${windowsNodePath}"`,
    "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
    "  # Fix case when both the Windows and Linux builds of Node",
    "  # are installed in the same directory",
    "  $exe=\".exe\"",
    "  $pathsep=\";\"",
    "} else {",
    `  $new_node_path="${posixNodePath}"`,
    "}",
    "if ([string]::IsNullOrEmpty($env_node_path)) {",
    "  $env:NODE_PATH=$new_node_path",
    "} else {",
    "  $env:NODE_PATH=\"$new_node_path$pathsep$env_node_path\"",
    "}",
    "",
    "$ret=0",
    "if (Test-Path \"$basedir/node$exe\") {",
    "  # Support pipeline input",
    "  if ($MyInvocation.ExpectingInput) {",
    `    $input | & "$basedir/node$exe"  "$basedir/${script}" $args`,
    "  } else {",
    `    & "$basedir/node$exe"  "$basedir/${script}" $args`,
    "  }",
    "  $ret=$LASTEXITCODE",
    "} else {",
    "  # Support pipeline input",
    "  if ($MyInvocation.ExpectingInput) {",
    `    $input | & "node$exe"  "$basedir/${script}" $args`,
    "  } else {",
    `    & "node$exe"  "$basedir/${script}" $args`,
    "  }",
    "  $ret=$LASTEXITCODE",
    "}",
    "$env:NODE_PATH=$env_node_path",
    "exit $ret",
    ""
  ].join("\r\n");
}
