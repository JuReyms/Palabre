/** Recherche : interroge uniquement la base fournie par l’appelant, pas un profil personnel implicite. */
/** Aucun secret interrogé : compte uniquement les lignes susceptibles d'apporter des réglages distants. */
export function remotePresence(db,env){
 const credentials=db.prepare("SELECT COUNT(*) AS n FROM credential WHERE integration_id = 'opencode'").get().n;
 const row=db.prepare("SELECT value FROM kv WHERE key = 'wellknown:sources'").get();
 const origins=row?JSON.parse(row.value):[];
 if(!Array.isArray(origins)||origins.some(x=>typeof x!=='string'))throw Error('sources-distantes-inconnues');
 return {consoleConnectionPresent:credentials>0||Boolean(env.OPENCODE_API_KEY),wellknownPresent:origins.length>0};
}
