/** @file #128 : filtrage du PATH enfant seulement, sans élargir la lecture seule. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codexWindowsEnvironment, inspectWindowsPowerShell, type CodexWindowsEnvironmentOptions } from '../src/externalSessions/codexWindowsEnvironment.js';
const apps='C:\\Users\\fixture\\WindowsApps', native='C:\\Windows\\System32\\WindowsPowerShell\\v1.0', pwsh='C:\\Program Files\\PowerShell\\7';
const key=(s:string)=>s.replaceAll('/','\\').toLowerCase();
function probes(files:string[], aliases:string[]=[apps+'\\pwsh.exe']): CodexWindowsEnvironmentOptions {
 return {platform:'win32',exists:file=>files.map(key).includes(key(file)),regularFile:file=>files.map(key).includes(key(file))&&!aliases.map(key).includes(key(file)),appExecutionAlias:async file=>aliases.map(key).includes(key(file))};
}

test('alias AppExecLink confirmé : seul le dossier concerné est retiré, parent intact',async()=>{
 const env={Path:`${apps};${native};C:\\Tools`,PATHEXT:'.COM;.EXE;.BAT;.CMD',KEEP:'value'};
 const result=await codexWindowsEnvironment(env,probes([apps+'\\pwsh.exe',native+'\\powershell.exe']));
 assert.equal(result.Path,`${native};C:\\Tools`);assert.equal(result.KEEP,'value');assert.equal(env.Path,`${apps};${native};C:\\Tools`);assert.notEqual(result,env);
});
test('vrai pwsh installé avant ou après le Store : priorité native ou repli natif',async()=>{
 for(const first of [true,false]){
  const env={PATH:first?`${pwsh};${apps};${native}`:`${apps};${pwsh};${native}`};
  const result=await codexWindowsEnvironment(env,probes([apps+'\\pwsh.exe',pwsh+'\\pwsh.exe',native+'\\powershell.exe']));
  assert.equal(result.PATH,first?env.PATH:`${pwsh};${native}`);
 }
});
test('vrai exécutable dans WindowsApps : jamais supprimé sur le seul nom du dossier',async()=>{
 const env={PATH:`${apps};${native}`};
 assert.deepEqual(await codexWindowsEnvironment(env,probes([apps+'\\pwsh.exe',native+'\\powershell.exe'],[])),env);
});
test('pas de repli réel, autre alias, paquet Store ou script : PATH inchangé',async()=>{
 for(const [suffix,aliases] of [['',[]],[`;${pwsh}`,[pwsh+'\\pwsh.exe']],[`;C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7`,[]]] as Array<[string,string[]]>){
  const env={PATH:apps+suffix};
  const files=[apps+'\\pwsh.exe',...aliases,...(suffix.includes('Microsoft.PowerShell')?['C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7\\pwsh.exe']:[])];
  assert.deepEqual(await codexWindowsEnvironment(env,probes(files,[apps+'\\pwsh.exe',...aliases])),env);
 }
 const env={PATH:`${apps};${native}`};assert.deepEqual(await codexWindowsEnvironment(env,probes([apps+'\\pwsh.exe',native+'\\powershell.cmd'])),env);
});
// Essai réel #171 (Windows, Store 7.6.7) : l'alias du dossier propre au paquet passe en tête, suivi
// d'un dossier d'installation versionné sans pwsh, puis de l'alias de WindowsApps lui-même.
const pkg=apps+'\\Microsoft.PowerShell_8wekyb3d8bbwe', installed='C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.2.0_x64__8wekyb3d8bbwe';
test('alias du dossier de paquet puis alias de WindowsApps : les deux sont écartés, repli natif',async()=>{
 const env={PATH:`${pkg};${installed};${apps};${native}`};
 const deps=probes([pkg+'\\pwsh.exe',apps+'\\pwsh.exe',native+'\\powershell.exe'],[pkg+'\\pwsh.exe',apps+'\\pwsh.exe']);
 assert.equal((await codexWindowsEnvironment(env,deps)).PATH,`${installed};${native}`);
 const report=await inspectWindowsPowerShell(env,deps);
 assert.equal(report.status,'store-alias-with-fallback');assert.equal(report.alias,pkg+'\\pwsh.exe');assert.equal(report.fallback,native+'\\powershell.exe');
});
test('second alias non confirmé : il resterait choisi par Codex, donc aucun contournement',async()=>{
 const env={PATH:`${pkg};${apps};${native}`};
 const deps=probes([pkg+'\\pwsh.exe',apps+'\\pwsh.exe',native+'\\powershell.exe'],[pkg+'\\pwsh.exe']);
 deps.regularFile=file=>key(file)===key(native+'\\powershell.exe');
 assert.deepEqual(await codexWindowsEnvironment(env,deps),env);
 assert.equal((await inspectWindowsPowerShell(env,deps)).status,'store-alias-only');
});
test('dossier d\'installation versionné en tête : jamais traité comme un emplacement d\'alias',async()=>{
 let calls=0;const env={PATH:`${installed};${native}`};
 const deps=probes([installed+'\\pwsh.exe',native+'\\powershell.exe'],[]);deps.appExecutionAlias=async()=>{calls++;return true;};
 assert.equal((await inspectWindowsPowerShell(env,deps)).status,'not-applicable');assert.equal(calls,0);
});
test('sonde négative ou indisponible : pas de filtrage',async()=>{
 const env={PATH:`${apps};${native}`};
 for(const answer of [false,undefined]){
  const deps=probes([apps+'\\pwsh.exe',native+'\\powershell.exe']);deps.appExecutionAlias=async()=>answer===true;
  assert.deepEqual(await codexWindowsEnvironment(env,deps),env);
 }
});
test('casse, guillemets, doublons et extensions : entrées étrangères conservées exactement',async()=>{
 const env={Path:`"${apps}";c:/users/fixture/windowsapps/;${native}; C:\\Tools `,PATHEXT:'.EXE'};
 const result=await codexWindowsEnvironment(env,probes([apps+'\\pwsh.exe',native+'\\powershell.exe']));
 assert.equal(result.Path,`${native}; C:\\Tools `);
});
test('hors Windows, PATH absent et absence de pwsh : aucune sonde ni changement',async()=>{
 let calls=0;const deps=probes([]);deps.appExecutionAlias=async()=>{calls++;return true;};
 for(const env of [{PATH:`${apps};${native}`},{}])assert.deepEqual(await codexWindowsEnvironment(env,{...deps,platform:'darwin'}),env);
 assert.deepEqual(await codexWindowsEnvironment({},deps),{});assert.equal(calls,0);
});

test('exchange applique le même environnement fournisseur à MCP, création et reprise',async()=>{
 const {exchange}=await import('../src/externalSessions/adapter.js');
 const {CodexSessionAdapter}=await import('../src/externalSessions/codex.js');
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'palabre-128-env-'));
 try{
  for(const creating of [false,true]){
   const history=path.join(root,`rollout-${creating}.jsonl`),marker=path.join(root,`calls-${creating}.jsonl`);fs.writeFileSync(history,'');
   const adapter=new CodexSessionAdapter({home:root});let count=0;
   adapter.environment=async source=>{count++;return {...source,PALABRE_PROVIDER_ENV_TEST:'present'};};
   const result=await exchange(adapter,{command:process.execPath,prefixArgs:[path.resolve('tests/fixtures/external-sessions/fake-codex.cjs')]},
    {agent:'codex',provider:'codex',sessionId:creating?'':'0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',cwd:root},'Question',{
     timeoutMs:10000,env:{...process.env,FAKE_CODEX_ROLLOUT:history,FAKE_CODEX_MARKER:marker},
     ...(creating?{onCreatedSession:()=>{}}:{})});
   assert.equal(count,1);assert.equal(result.verdict?.interpretation.isError,false);
   const calls=fs.readFileSync(marker,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));
   assert.equal(calls.length,2);assert.ok(calls.every(call=>call.envKeys.includes('PALABRE_PROVIDER_ENV_TEST')));
   assert.equal(calls[0].argv[0],'mcp');assert.equal(calls[1].argv[0],'exec');
   assert.ok(calls[1].argv.includes('sandbox_mode="read-only"'));
   assert.equal(process.env.PALABRE_PROVIDER_ENV_TEST,undefined);
  }
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
