/* OpenCode fictif : aucun compte, outil ou modèle ; API locale et historique dans un fichier jetable. */
const fs = require('node:fs');
const http = require('node:http');
const args = process.argv.slice(2);
const file = process.env.PALABRE_FAKE_COPY_STATE;
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = value => fs.writeFileSync(file, JSON.stringify(value));
const state = read();
fs.appendFileSync(process.env.PALABRE_FAKE_COPY_CALLS, JSON.stringify({ args, cwd: process.cwd() }) + '\n');
if (args[0] === '--version') { console.log(state.version || 'opencode v2.0.32'); process.exit(0); }
if (args[0] === 'run') {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { text += chunk; });
  process.stdin.on('end', () => {
    const latest = read();
    const id = args[args.indexOf('--session') + 1];
    if (id !== latest.copy.info.id || id === latest.source.info.id) process.exit(12);
    latest.copy.context.push({ id: 'msg_userNew', type: 'user', text },
      { id: 'msg_assistantNew', type: 'assistant', agent: latest.copy.info.agent, model: latest.copy.info.model,
        content: [{ type: 'text', text: 'Avis fictif transport' }], finish: 'stop', time: { completed: 30 } },
      { id: 'msg_idleNew', type: 'idle', outcome: 'succeeded' });
    if (latest.mode === 'partial') latest.copy.context.pop();
    if (latest.mode === 'source-changed') latest.source.info.title = 'changed';
    save(latest);
    console.log(JSON.stringify({ type: 'text', sessionID: id, text: 'Avis fictif transport' }));
    process.exit(latest.mode === 'client-error' ? 1 : 0);
  });
} else if (args[0] === 'serve') {
  let overflowStarted = false;
  const server = http.createServer((req, res) => {
    const expected = 'Basic ' + Buffer.from('opencode:' + process.env.OPENCODE_PASSWORD).toString('base64');
    if (req.headers.authorization !== expected) { res.writeHead(401).end(); return; }
    // Cause d'arrêt connue pendant des requêtes pendantes : le socket coupé est une conséquence.
    if (state.mode === 'server-overflow-request') {
      if (!overflowStarted) {
        overflowStarted = true;
        for (let i = 0; i < 100; i++) process.stderr.write('X'.repeat(65536));
      }
      return;
    }
    if (state.mode === 'api-disconnect') { req.socket.destroy(); return; }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const latest = read();
      latest.apiCalls ??= [];
      latest.apiCalls.push({ route: req.url, method: req.method }); save(latest);
      if (req.url === '/api/model' && req.method === 'GET') {
        if (latest.mode === 'model-overflow') { res.end(JSON.stringify({ data: 'X'.repeat(4 * 1024 * 1024 + 1) })); return; }
        res.end(JSON.stringify({ data: [{ providerID: 'fake', id: 'other', enabled: true, variants: [{ id: 'high' }] }] })); return;
      }
      const match = /^\/api\/(experimental\/)?session\/(ses_[A-Za-z0-9]+)(.*)$/.exec(req.url);
      if (!match) { res.writeHead(404).end('{}'); return; }
      const id = match[2], suffix = match[3];
      let snapshot = id === latest.source.info.id ? latest.source : id === latest.copy.info.id ? latest.copy : undefined;
      if (!snapshot) { res.writeHead(404).end('{}'); return; }
      let value;
      if (suffix === '/fork' && req.method === 'POST') {
        if (id !== latest.source.info.id || body !== '{}') { res.writeHead(400).end(); return; }
        value = { id: latest.mode === 'bad-fork' ? latest.source.info.id : latest.copy.info.id };
      } else if (suffix === '/model' && req.method === 'POST') {
        if (id !== latest.copy.info.id || id === latest.source.info.id) { res.writeHead(400).end(); return; }
        const model = JSON.parse(body).model;
        if (latest.mode !== 'model-no-effect') {
          latest.copy.context.push({ id: 'msg_modelSelection', type: 'model-switched', model,
            previous: latest.copy.info.model, time: { created: 11 } });
          latest.copy.info.model = model; save(latest);
        }
        if (latest.mode === 'model-ack-lost') { req.socket.destroy(); return; }
        if (latest.mode === 'model-bad-ack') { res.end(JSON.stringify({ data: null })); return; }
        res.writeHead(204).end(); return;
      } else if (suffix === '/interrupt' && req.method === 'POST') value = { interrupted: false };
      else if (suffix === '') value = snapshot.info;
      else if (suffix === '/context') value = snapshot.context;
      else if (suffix === '/inbox') value = snapshot.inbox;
      else if (suffix === '/export') value = snapshot.export;
      else if (suffix === '/instructions/entries') value = snapshot.instructions;
      else { res.writeHead(404).end('{}'); return; }
      if (latest.mode === 'api-overflow' && suffix === '/context') value = 'X'.repeat(4 * 1024 * 1024 + 1);
      if (latest.mode === 'api-total-limit' && suffix === '/export') value = { large: 'X'.repeat(3 * 1024 * 1024) };
      if (latest.mode === 'api-total-limit' && suffix === '/instructions/entries') value = ['X'.repeat(3 * 1024 * 1024)];
      if (latest.mode === 'api-redirect') { res.writeHead(302, { location: 'http://example.invalid/secret' }).end('{}'); return; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: value }));
    });
  });
  server.listen(0, '127.0.0.1', () => {
    console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}` }));
    if (state.mode === 'server-overflow') {
      for (let i = 0; i < 100; i++) process.stdout.write('X'.repeat(65536));
    }
  });
  process.stdin.resume(); process.stdin.on('end', () => {
    if (state.mode === 'server-overflow-stop') {
      for (let i = 0; i < 100; i++) process.stderr.write('X'.repeat(65536));
    }
    server.close();
  });
} else process.exit(9);
