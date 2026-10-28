import { DatabaseSync } from 'node:sqlite'; import { webcrypto as C } from 'node:crypto'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await C.subtle.exportKey('jwk',kp.publicKey)),kid:'k1'};
const env={DB,GOOGLE_CLIENT_ID:'cid',JWKS_PRUEBA:JSON.stringify({keys:[jwk]}),ADMIN_EMAILS:'luis@x.com,falso@x.com'};
const b64=b=>Buffer.from(b).toString('base64url');
async function jwt(sub,email){const h=b64(JSON.stringify({alg:'RS256',kid:'k1'}));const d=b64(JSON.stringify({iss:'accounts.google.com',aud:'cid',sub,email,email_verified:true,name:'G',exp:Math.floor(Date.now()/1000)+3600}));
 const s=await C.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+d));return h+'.'+d+'.'+b64(new Uint8Array(s));}
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
let [s,r]=await call(null,'POST','auth/google',{credential:await jwt('g1','luis@x.com')}); const ADM=r.token;
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'fuerza2026',nombre:'Ana'}); const A=r.token;
const pose=Buffer.from('hola mundo comprimido').toString('base64');
[s,r]=await call(null,'POST','fallos',{ejercicio:'sentadilla',repsApp:5,repsReal:3,pose}); ok(s===401,'sin sesión no se puede reportar');
[s,r]=await call(A,'POST','fallos',{ejercicio:'sentadilla',nombre:'Sentadilla con barra',repsApp:5,repsReal:3,excluidas:[1.2,'x',3.4],comentario:'contó al acomodarme',version:'2.5.0',datos:{altura:1.68},pose}); ok(s===200&&r.id,'reporte guardado');
const id=r.id;
[s,r]=await call(A,'POST','fallos',{ejercicio:'x',pose:'<script>'}); ok(s===400,'pose no base64 rechazada');
[s,r]=await call(A,'GET','mod/fallos'); ok(s===404,'usuario normal no ve los fallos');
[s,r]=await call(ADM,'GET','mod/fallos'); ok(s===200&&r.fallos.length===1&&r.fallos[0].reps_app===5&&r.fallos[0].reps_real===3&&!('pose' in r.fallos[0])&&r.fallos[0].pose_bytes>0,'admin ve la lista sin los puntos');
[s,r]=await call(ADM,'GET','mod/fallos/'+id); ok(s===200&&r.fallo.pose===pose&&JSON.stringify(r.fallo.excluidas)==='[1.2,3.4]'&&r.fallo.datos.altura===1.68,'admin ve el detalle con los puntos');
[s,r]=await call(ADM,'POST','mod/fallos/'+id,{estado:'corregido'}); ok(s===200,'marcar corregido');
[s,r]=await call(ADM,'GET','mod/fallos'); ok(r.fallos[0].estado==='corregido','estado guardado');
for(let i=0;i<30;i++) await call(A,'POST','fallos',{ejercicio:'s',repsApp:1,repsReal:2});
[s,r]=await call(A,'POST','fallos',{ejercicio:'s',repsApp:1,repsReal:2}); ok(s===429,'límite diario');
[s,r]=await call(A,'DELETE','cuenta'); ok(s===200&&db.prepare('select count(*) n from fallos').get().n===0,'borrar cuenta borra sus reportes');
