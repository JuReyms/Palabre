/** @file Témoin Node pour lire le texte écrit dans un pseudo-terminal. */

/** Capture les arguments et le stdin après 800 ms sans donnée, car le PTY ne signale pas de fin d'entrée. */
export function fakePtyStdinCli(capture: string): string {
  return `
    let input = "";
    let idle;
    function done() {
      const seen = { argv: process.argv.slice(2), stdin: input, nodePath: process.env.NODE_PATH ?? null };
      require("node:fs").writeFileSync(${JSON.stringify(capture)}, JSON.stringify(seen), { flag: "wx" });
      process.stdout.write("ok");
      process.exit(0);
    }
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => {
      input += chunk;
      clearTimeout(idle);
      idle = setTimeout(done, 800);
    });
  `;
}
