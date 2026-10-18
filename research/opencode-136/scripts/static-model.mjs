/** Lecture statique de recherche : aucun moteur, plugin, import ou substitution de fichier. */
import fs from 'node:fs';
import path from 'node:path';

/** JSONC borné : commentaires et virgules finales admis ; doublons et syntaxe exécutable refusés. */
export function parseJsonc(text){
 if(Buffer.byteLength(text)>1024*1024)throw Error('configuration-trop-grande');
 let i=0,depth=0;
 const fail=()=>{throw Error('configuration-jsonc-invalide');};
 function space(){for(;;){while(/\s/.test(text[i]??'')&&i<text.length)i++;if(text.slice(i,i+2)==='//'){i=text.indexOf('\n',i+2);if(i<0)i=text.length;}else if(text.slice(i,i+2)==='/*'){const end=text.indexOf('*/',i+2);if(end<0)fail();i=end+2;}else return;}}
 function string(){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"'){try{return JSON.parse(text.slice(start,i));}catch{fail();}}}fail();}
 function value(){space();if(++depth>50)fail();let result;
  if(text[i]==='"')result=string();
  else if(text[i]==='{'){i++;result=Object.create(null);space();while(text[i]!=='}'){if(text[i]!=='"')fail();const key=string();if(Object.hasOwn(result,key))throw Error('configuration-cle-repetee');space();if(text[i++]!==':')fail();result[key]=value();space();if(text[i]===','){i++;space();}else if(text[i]!=='}')fail();}i++;}
  else if(text[i]==='['){i++;result=[];space();while(text[i]!==']'){result.push(value());space();if(text[i]===','){i++;space();}else if(text[i]!==']')fail();}i++;}
  else{const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!match)fail();result=JSON.parse(match[0]);i+=match[0].length;}
  depth--;return result;
 }
 const result=value();space();if(i!==text.length)fail();return result;
}

/** Refuse la sélection implicite ou calculée ; un défaut explicite doit être univoque. */
export function modelFromDocuments(documents){
 const models=[];
 for(const doc of documents){
  if(!doc||typeof doc!=='object'||Array.isArray(doc))throw Error('configuration-racine-invalide');
  if(!Object.hasOwn(doc,'model'))continue;
  const m=doc.model;
  let selected;
  if(typeof m==='string')selected=m;
  else if(m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).every(k=>['providerID','model','variant'].includes(k))&&typeof m.providerID==='string'&&typeof m.model==='string'&&(m.variant===undefined||typeof m.variant==='string'))selected=m.providerID+'/'+m.model+(m.variant?'#'+m.variant:'');
  if(!selected||/[{}\s\x00-\x1f]/.test(selected)||!/^([^/#]+)\/([^#]+)(#[^#]+)?$/.test(selected))throw Error('modele-non-litteral-ou-invalide');
  models.push(selected);
 }
 if(models.length===0)throw Error('modele-par-defaut-non-explicite');
 if(new Set(models).size!==1)throw Error('modeles-contradictoires');
 return models[0];
}

/** Inventaire conservateur des fichiers locaux ; les sources distantes restent une porte distincte. */
export function readStaticModel({home,cwd,env=process.env,platform=process.platform}){
 if(!path.isAbsolute(home)||!path.isAbsolute(cwd))throw Error('dossier-absolu-requis');
 const globalDir=env.OPENCODE_CONFIG_DIR||path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'opencode');
 if(!path.isAbsolute(globalDir))throw Error('dossier-config-relatif');
 const system=platform==='win32'?path.join(env.ProgramData||'C:\\ProgramData','opencode'):platform==='darwin'?'/Library/Application Support/opencode':'/etc/opencode';
 const candidates=new Set();
 for(const dir of [system,globalDir])for(const name of ['opencode.json','opencode.jsonc'])candidates.add(path.join(dir,name));
 if(env.OPENCODE_CONFIG){if(!path.isAbsolute(env.OPENCODE_CONFIG))throw Error('config-explicite-relative');candidates.add(env.OPENCODE_CONFIG);}
 if(!/^(1|true)$/i.test(env.OPENCODE_CONFIG_PROJECT_DISABLE??env.OPENCODE_DISABLE_PROJECT_CONFIG??'')){
  for(let dir=cwd;;dir=path.dirname(dir)){
   for(const rel of ['opencode.json','opencode.jsonc','.opencode/opencode.json','.opencode/opencode.jsonc'])candidates.add(path.join(dir,rel));
   if(path.dirname(dir)===dir)break;
  }
 }
 if(candidates.size>256)throw Error('trop-de-sources');
 const documents=[],sources=[];let total=0;
 for(const file of candidates){
  let stat;try{stat=fs.lstatSync(file);}catch(e){if(e.code==='ENOENT')continue;throw Error('configuration-illisible');}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('configuration-non-admise');
  const text=fs.readFileSync(file,'utf8');total+=Buffer.byteLength(text);if(total>4*1024*1024)throw Error('configuration-trop-grande');
  documents.push(parseJsonc(text));sources.push(file);
 }
 if(env.OPENCODE_CONFIG_CONTENT){documents.push(parseJsonc(env.OPENCODE_CONFIG_CONTENT));sources.push('OPENCODE_CONFIG_CONTENT');}
 if(platform==='darwin')throw Error('preferences-mdm-non-qualifiees');
 return {model:modelFromDocuments(documents),sourceCount:sources.length};
}
