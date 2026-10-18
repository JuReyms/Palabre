/** Tests hors ligne sur fichiers temporaires et bases en mémoire, sans profil utilisateur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {parseJsonc,modelFromDocuments,readStaticModel} from './static-model.mjs';
import os from 'node:os';
import {remotePresence} from './remote-presence.mjs';

test('JSONC : commentaires et virgules finales, chaînes préservées',()=>{
 const obj=parseJsonc('{/* comment */ "model":"p/a//b", "a":[1, true,],}');
 assert.equal(obj.model,'p/a//b');assert.deepEqual(obj.a,[1,true]);
});
test('JSONC : doublons, appel JS et commentaire inachevé refusés',()=>{
 for(const text of ['{"model":"p/a","model":"p/b"}','{"model":run()}','{/*','{"model":"p/a"} other'])assert.throws(()=>parseJsonc(text));
});
test('modèle explicite sous ses deux formes',()=>{
 assert.equal(modelFromDocuments([{model:'p/a#low'},{model:{providerID:'p',model:'a',variant:'low'}}]),'p/a#low');
});
test('absence et contradiction refusées, sans modèle choisi implicitement',()=>{
 assert.throws(()=>modelFromDocuments([{}]),/non-explicite/);
 assert.throws(()=>modelFromDocuments([{model:'p/a'},{model:'p/b'}]),/contradictoires/);
});
test('substitution, valeur invalide ou objet ambigu refusés',()=>{
 for(const model of ['{env:MODEL}','p/{file:key}',null,[],{providerID:'p',model:'a',unknown:true}])assert.throws(()=>modelFromDocuments([{model}]));
});
test('lecture statique : seuls dossiers fictifs et cohérence entre sources',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'palabre-opencode-static-'));
 try{
  const home=path.join(temp,'home'),cwd=path.join(home,'project'),global=path.join(temp,'config');
  fs.mkdirSync(global,{recursive:true});fs.mkdirSync(cwd,{recursive:true});
  fs.writeFileSync(path.join(global,'opencode.jsonc'),'// nothing executes\n{"model":"p/a", "plugins":["DO_NOT_IMPORT"]}');
  const env={OPENCODE_CONFIG_DIR:global,ProgramData:path.join(temp,'system'),OPENCODE_DISABLE_PROJECT_CONFIG:'true'};
  assert.deepEqual(readStaticModel({home,cwd,env,platform:'win32'}),{model:'p/a',sourceCount:1});
  env.OPENCODE_CONFIG_CONTENT='{"model":"p/b"}';assert.throws(()=>readStaticModel({home,cwd,env,platform:'win32'}),/contradictoires/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('présence distante : aucun secret ni nom de compte retourné',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE credential(integration_id TEXT,value TEXT); CREATE TABLE kv(key TEXT,value TEXT);');
  db.prepare('INSERT INTO credential VALUES (?,?)').run('opencode',JSON.stringify({key:'SECRET_MARKER'}));
  const result=remotePresence(db,{});assert.equal(result.consoleConnectionPresent,true);assert.equal(JSON.stringify(result).includes('SECRET_MARKER'),false);
 }finally{db.close();}
});
test('sources wellknown signalées, sources mal formées refusées',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE credential(integration_id TEXT); CREATE TABLE kv(key TEXT,value TEXT);');
  db.prepare('INSERT INTO kv VALUES (?,?)').run('wellknown:sources','["https://example.invalid"]');
  assert.equal(remotePresence(db,{}).wellknownPresent,true);
  db.prepare('UPDATE kv SET value=?').run('{}');assert.throws(()=>remotePresence(db,{}),/inconnues/);
 }finally{db.close();}
});
test('clé dans l’environnement : présence seule, aucune valeur retournée',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE credential(integration_id TEXT); CREATE TABLE kv(key TEXT,value TEXT);');
  assert.deepEqual(remotePresence(db,{OPENCODE_API_KEY:'SECRET_MARKER'}),{consoleConnectionPresent:true,wellknownPresent:false});
 }finally{db.close();}
});
test('profil fictif sans connexion ni source distante',()=>{
 const db=new DatabaseSync(':memory:');
 try{db.exec('CREATE TABLE credential(integration_id TEXT); CREATE TABLE kv(key TEXT,value TEXT);');assert.deepEqual(remotePresence(db,{}),{consoleConnectionPresent:false,wellknownPresent:false});}finally{db.close();}
});
