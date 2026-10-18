/** Recherche locale #136 : profil fictif uniquement, jamais le profil du propriétaire. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {server} from './isolation-server.mjs';
import {root,work,node,native,configuration,agentName,model,run,save} from './isolation-env.mjs';

const pinned='045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903';
assert.equal(createHash('sha256').update(fs.readFileSync(native)).digest('hex'),pinned);
const ownConfig=path.join(root,'config/opencode/opencode.json');
const closedDir=path.join(root,'closed-config'); fs.mkdirSync(closedDir,{recursive:true});
const plugin=path.join(root,'plugin-witness'); fs.mkdirSync(plugin,{recursive:true});
const pluginLog=path.join(root,'traces/plugin.jsonl');
const mcpLog=path.join(root,'traces/mcp.jsonl');
const witnessScript=path.join(root,'mcp-witness.cjs');
fs.writeFileSync(path.join(plugin,'package.json'),JSON.stringify({name:'isolation-witness',type:'module'}));
fs.writeFileSync(path.join(plugin,'server.js'),`import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(pluginLog)},'import\\n');export default {id:'isolation-witness',async setup(){}};`);
fs.writeFileSync(witnessScript,`require('node:fs').appendFileSync(${JSON.stringify(mcpLog)},'started\\n');process.exit(0);`);
const count=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).length:0;
let modelRequests=0,keyReused=false,forced=null,webHits=0;
const web=http.createServer((req,res)=>{webHits++;res.end('local-witness');});
await new Promise(r=>web.listen(0,'127.0.0.1',r));
const webURL='http://127.0.0.1:'+web.address().port+'/witness';
await fetch(webURL);assert.equal(webHits,1);webHits=0;
const key='FAKE_LOCAL_CREDENTIAL_'+randomUUID();
const proxy=http.createServer(async(req,res)=>{
 try {
  let b='';for await(const c of req)b+=c;
  modelRequests++;keyReused ||= req.headers.authorization==='Bearer '+key;
  if(forced){
   const request=JSON.parse(b);forced.offered=request.tools?.map(x=>x.function.name)??[];
   const first=forced.requests++===0;
   const delta=first?{role:'assistant',tool_calls:[{index:0,id:'call_witness',type:'function',function:{name:forced.tool,arguments:JSON.stringify(forced.args)}}]}:{role:'assistant',content:'FIXTURE_DONE'};
   res.writeHead(200,{'Content-Type':'text/event-stream'});
   res.write('data: '+JSON.stringify({id:'chatcmpl_fixture',object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
   res.write('data: '+JSON.stringify({id:'chatcmpl_fixture',object:'chat.completion.chunk',choices:[{index:0,delta:{},finish_reason:first?'tool_calls':'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})+'\n\n');
   res.end('data: [DONE]\n\n');return;
  }
  const response=await fetch('http://127.0.0.1:11434'+req.url,{method:req.method,headers:{'Content-Type':'application/json'},body:b,signal:AbortSignal.timeout(45000)});
  res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-length','transfer-encoding','content-encoding'].includes(k))));
  for await(const chunk of response.body)res.write(chunk);res.end();
 }catch{res.writeHead(500);res.end('local-model-failed');}
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const baseConfig=configuration('http://127.0.0.1:'+proxy.address().port+'/v1');
baseConfig.compaction={auto:false};baseConfig.providers['qualification-local'].models[model].limit.context=16384;
const foreign={plugins:[plugin],mcp:{servers:{witness:{type:'local',command:[node,witnessScript]}}},policies:[{action:'integration.use',resource:'*',effect:'allow'}],model:'qualification-local/'+model};
const snapshot=async(s,id)=>Object.fromEntries(await Promise.all(['','/export','/context','/inbox','/instructions/entries'].map(async suffix=>{
 const route=['/instructions/entries','/export'].includes(suffix)?'/api/experimental/session/'+id+suffix:'/api/session/'+id+suffix;
 const value=await s.api(route);assert.equal(value.status,200);return[suffix||'info',value.data];
})));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const summary={version:'2.0.32',model:'qualification-local/'+model,fixtureOnly:true};
let source;
try {
 // Seed a source and a fake, local provider credential, with no user plugins configured.
 fs.writeFileSync(ownConfig,'{}');
 const seed=await server('isolation-seed',baseConfig);
 try {
  const cred=await seed.api('/api/credential',{integrationID:'qualification-local',value:{type:'key',key},label:'Fictional only'});assert.equal(cred.status,200);
  const created=await seed.api('/api/session',{location:{directory:work},agent:agentName,model:{providerID:'qualification-local',id:model},title:'Fictional isolation source'});assert.equal(created.status,200);source=created.data.data.id;
  const result=await run('isolation-source-message',['run','--server',seed.url,'--session',source,'--agent',agentName,'--model','qualification-local/'+model,'--format','json','Reply only ACK'],{env:seed.env});assert.equal(result.code,0);assert.equal(result.timedOut,false);
 }finally{await seed.close();}

 fs.writeFileSync(ownConfig,JSON.stringify(foreign));
 const originalConfigHash=digest(fs.readFileSync(ownConfig,'utf8'));
 const controlBefore={plugin:count(pluginLog),mcp:count(mcpLog)};
 const control=await server('isolation-positive-control',baseConfig);
 try{
  assert.equal((await control.api('/api/plugin?directory='+encodeURIComponent(work))).status,200);
  assert.equal((await control.api('/api/mcp?directory='+encodeURIComponent(work))).status,200);
  for(let i=0;i<30&&count(mcpLog)===controlBefore.mcp;i++)await new Promise(r=>setTimeout(r,100));
  summary.positiveControl={pluginImported:count(pluginLog)>controlBefore.plugin,mcpStarted:count(mcpLog)>controlBefore.mcp};
  assert.ok(summary.positiveControl.pluginImported);assert.ok(summary.positiveControl.mcpStarted);
 }finally{await control.close();}
 const closedBefore={plugin:count(pluginLog),mcp:count(mcpLog)};
 // Keep the same data, state and fake credential; replace only configuration discovery.
 const closed=await server('isolation-closed',baseConfig,{OPENCODE_CONFIG_DIR:closedDir});
 try {
  const entries=await closed.api('/api/config?directory='+encodeURIComponent(work));save('isolation-config',entries);
  const plugins=await closed.api('/api/plugin?directory='+encodeURIComponent(work));
  const mcps=await closed.api('/api/mcp?directory='+encodeURIComponent(work));
  summary.pluginImports=count(pluginLog)-closedBefore.plugin;summary.mcpStarts=count(mcpLog)-closedBefore.mcp;
  assert.equal(summary.pluginImports,0);assert.equal(summary.mcpStarts,0);
  const entriesText=JSON.stringify(entries.data);assert.equal(entriesText.includes(plugin),false);assert.equal(entriesText.includes(witnessScript),false);
  const before=await snapshot(closed,source);const history=before['/context'].data;
  const f=await closed.api('/api/session/'+source+'/fork',{});assert.equal(f.status,200);const copy=f.data.data.id;
  try{
   const afterFork=await snapshot(closed,source);
   const copyBefore=await snapshot(closed,copy);
   const normalize=items=>items.map(({id,...rest})=>rest);
   summary.contextCopied=JSON.stringify(normalize(history))===JSON.stringify(normalize(copyBefore['/context'].data));assert.ok(summary.contextCopied);
   const requestBefore=modelRequests;
   keyReused=false;
   const reply=await run('isolation-copy-question',['run','--server',closed.url,'--session',copy,'--agent',agentName,'--model','qualification-local/'+model,'--format','json','Reply only OK'],{env:closed.env});
   assert.equal(reply.code,0);summary.localModelReply=true;summary.connectionReused=keyReused;assert.ok(keyReused);
   summary.requestsForCopy=modelRequests-requestBefore;
   const after=await snapshot(closed,source);
   summary.sourceHashes=[digest(before),digest(afterFork),digest(after)];assert.equal(new Set(summary.sourceHashes).size,1);
   const remove=await closed.api('/api/session/'+copy,undefined,{method:'DELETE'});assert.equal(remove.status,204);
   summary.copyRemoved=(await closed.api('/api/session/'+copy)).status===404;assert.ok(summary.copyRemoved);
  }finally{
   const remains=await closed.api('/api/session/'+copy);if(remains.status===200)await closed.api('/api/session/'+copy,undefined,{method:'DELETE'});
  }
  const denials=[];
  for(const [name,tool,args,file] of [
   ['write','write',{path:'forbidden-write.txt',content:'FORBIDDEN'},'forbidden-write.txt'],
   ['shell','shell',{command:'echo FORBIDDEN > forbidden-shell.txt',description:'local fixture'},'forbidden-shell.txt'],
   ['web','webfetch',{url:webURL,format:'text'},null],
   ['read','read',{path:'read-me.txt'},null]
  ]){
   const fork=await closed.api('/api/session/'+source+'/fork',{});assert.equal(fork.status,200);const id=fork.data.data.id;
   try{
    // A permissive inherited session must not defeat the hard closed policy.
    assert.equal((await closed.api('/api/session/'+id,{permissions:[{action:'*',resource:'*',effect:'allow'}]},{method:'PATCH'})).status,204);
    forced={tool,args,requests:0};
    const r=await run('isolation-forced-'+name,['run','--server',closed.url,'--session',id,'--agent',agentName,'--model','qualification-local/'+model,'--format','json','Perform the fictional check '+name],{env:closed.env});
    assert.equal(r.timedOut,false);
    const context=await closed.api('/api/session/'+id+'/context');assert.equal(context.status,200);save('isolation-forced-'+name+'-context',context);
    const output=JSON.stringify(context.data);
    const filePresent=file?fs.existsSync(path.join(work,file)):false;assert.equal(filePresent,false);assert.equal(webHits,0);
    if(name==='read')assert.ok(output.includes('PALABRE_READ_WITNESS_136'));
    else assert.ok(output.includes('Blocked by configuration policy')||output.includes('No tool named'));
    denials.push({name,filePresent,webHits,refusalOrReadWitness:true,offered:forced.offered});
   }finally{forced=null;await closed.api('/api/session/'+id,undefined,{method:'DELETE'});}
  }
  summary.forcedChecks=denials;
  assert.equal(digest(await snapshot(closed,source)),summary.sourceHashes[0]);
  summary.userConfigUnchanged=digest(fs.readFileSync(ownConfig,'utf8'))===originalConfigHash;assert.ok(summary.userConfigUnchanged);
  save('isolation-summary',summary);console.log(JSON.stringify(summary,null,2));
 }finally{await closed.close();}
}finally{proxy.closeAllConnections();web.closeAllConnections();await Promise.all([new Promise(r=>proxy.close(r)),new Promise(r=>web.close(r))]);}
