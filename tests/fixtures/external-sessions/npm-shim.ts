/** @file Modèle du shim PowerShell généré par npm (`cmd-shim`), pour les tests de résolution du relay. */

/** Shim npm complet pour un script relatif au dossier du shim (séparateurs `/`). */
export function npmPowerShellShim(scriptRelativePath: string): string {
  return [
    "#!/usr/bin/env pwsh",
    "$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent",
    "",
    "$exe=\"\"",
    "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
    "  # Fix case when both the Windows and Linux builds of Node",
    "  # are installed in the same directory",
    "  $exe=\".exe\"",
    "}",
    "$ret=0",
    "if (Test-Path \"$basedir/node$exe\") {",
    "  # Support pipeline input",
    "  if ($MyInvocation.ExpectingInput) {",
    `    $input | & "$basedir/node$exe"  "$basedir/${scriptRelativePath}" $args`,
    "  } else {",
    `    & "$basedir/node$exe"  "$basedir/${scriptRelativePath}" $args`,
    "  }",
    "  $ret=$LASTEXITCODE",
    "} else {",
    "  # Support pipeline input",
    "  if ($MyInvocation.ExpectingInput) {",
    `    $input | & "node$exe"  "$basedir/${scriptRelativePath}" $args`,
    "  } else {",
    `    & "node$exe"  "$basedir/${scriptRelativePath}" $args`,
    "  }",
    "  $ret=$LASTEXITCODE",
    "}",
    "exit $ret",
    ""
  ].join("\r\n");
}
