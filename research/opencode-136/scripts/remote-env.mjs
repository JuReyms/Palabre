/** Recherche historique adaptée aux chemins du clone, profils générés seulement. Pas un adapter produit. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { prepareLab } from './lab-paths.mjs';
const lab = prepareLab('remote');
export const { root, work, native, node } = lab;
export const agentName = 'palabre-ro-136';
export const model = 'openbmb/minicpm5-2b:q8_0';
export const policy = [{action:'*',resource:'*',effect:'deny'}, ...['read','grep','glob','list'].map(action=>({action,resource:'*',effect:'allow'}))];
for (const dir of ['home','config/opencode','data','state','cache','tmp','work','traces','system']) fs.mkdirSync(path.join(root,dir),{recursive:true});
fs.writeFileSync(path.join(work,'read-me.txt'),'PALABRE_READ_WITNESS_136\n');
export function configuration(baseURL='http://127.0.0.1:11434/v1') {return {
  model:'qualification-local/'+model, small_model:'qualification-local/'+model,
  update:'disable', snapshots:false, warming:false,
  permissions:policy,
  policies:[{action:'tool.use',resource:'*',effect:'deny'},...['read','grep','glob','list'].map(action=>({action:'tool.use',resource:action+':*',effect:'allow'})),{action:'provider.use',resource:'*',effect:'deny'},{action:'provider.use',resource:'qualification-local',effect:'allow'},{action:'integration.use',resource:'*',effect:'deny'}],
  agents:{[agentName]:{mode:'primary',description:'Read-only qualification',steps:2,permissions:policy,system:'Answer briefly. Only read tools are allowed. Do not delegate.'}},
  providers:{'qualification-local':{name:'Ollama qualification',env:[],package:'@opencode/ai/providers/openai-compatible',settings:{baseURL,timeout:45000},models:{[model]:{name:model,limit:{context:4096,output:256},capabilities:{toolcall:true}}}}}
};}

export function environment(config = configuration(), overrides = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|APIKEY|AUTH|ANTHROPIC|OPENAI|CLAUDE|CODEX|OPENCODE|GITHUB|^GH_|GOOGLE|GEMINI|AZURE|^AWS|^XDG_|NODE_OPTIONS|BUN_OPTIONS|LD_PRELOAD|DYLD_)/i.test(key)));
  const home = path.join(root, 'home');
  Object.assign(env, {
    HOME: home, USERPROFILE: home, HOMEDRIVE: home.slice(0, 2), HOMEPATH: home.slice(2),
    APPDATA: path.join(home, 'AppData/Roaming'), LOCALAPPDATA: path.join(home, 'AppData/Local'),
    XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'),
    XDG_CACHE_HOME: path.join(root, 'cache'), XDG_STATE_HOME: path.join(root, 'state'),
    ProgramData:path.join(root,'system'), TEMP: path.join(root, 'tmp'), TMP: path.join(root, 'tmp'), OPENCODE_TEST_HOME: home,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config), OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_DISABLE_MODELS_FETCH: 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true', OPENCODE_DISABLE_CLAUDE_CODE: 'true',
    OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true', OPENCODE_DISABLE_LSP_DOWNLOAD: 'true',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true', OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: '512',
    GIT_CONFIG_GLOBAL: 'NUL', GIT_CONFIG_NOSYSTEM: '1',
    npm_config_offline: 'true',
    ...overrides
  });
  return env;
}

export function start(label, args, options = {}) {
  const child = spawn(native, args, { cwd: work, env: options.env || environment(), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', timedOut = false, error;
  const stop = () => new Promise(resolve => {
    if (child.exitCode !== null || !child.pid) return resolve();
    execFile(path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, () => resolve());
  });
  const timeout = setTimeout(() => { timedOut = true; void stop(); }, options.timeoutMs || 60000);
  const collect = (name, chunk) => {
    if (name === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
    if (stdout.length + stderr.length > 4 * 1024 * 1024) void stop();
    options.onData?.(name, chunk.toString());
  };
  child.stdout.on('data', chunk => collect('stdout', chunk));
  child.stderr.on('data', chunk => collect('stderr', chunk));
  child.on('error', err => { error = err.message; });
  const done = new Promise(resolve => child.on('close', (code, signal) => {
    clearTimeout(timeout);
    const result = { label, code, signal, timedOut, error, stdout, stderr };
    fs.writeFileSync(path.join(root, 'traces', label + '.json'), JSON.stringify(result, null, 2));
    resolve(result);
  }));
  return { child, done, stop };
}
export const run = async (label, args, options) => start(label, args, options).done;
export const nonce = prefix => prefix + '_' + randomUUID().replaceAll('-', '');
export function save(name, value) { fs.writeFileSync(path.join(root, 'traces', name + '.json'), JSON.stringify(value, null, 2)); }
