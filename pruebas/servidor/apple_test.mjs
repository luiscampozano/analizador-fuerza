// Iniciar sesión con Apple (v2.47.0): verificación del identityToken con claves de prueba, cuentas "a_", nombre y admin
import { DatabaseSync } from 'node:sqlite'; import { webcrypto as C } from 'node:crypto'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const otra=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await C.subtle.exportKey('jwk',kp.publicKey)),kid:'ka',alg:'RS256',use:'sig'};
const env={DB,GOOGLE_CLIENT_ID:'cid',JWKS_APPLE_PRUEBA:JSON.stringify({keys:[jwk]}),ADMIN_EMAILS:'luis@x.com'};
const b64=(o)=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
async function firmar(datos,{kid='ka',clave=kp.privateKey}={}){const h=b64({alg:'RS256',kid}),p=b64(datos);const f=await C.subtle.sign('RSASSA-PKCS1-v1_5',clave,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(f).toString('base64url');}
const ahora=Math.floor(Date.now()/1000);
const base={iss:'https://appleid.apple.com',aud:'com.fuerzapro.app',sub:'001234.abcd.0101',exp:ahora+600,iat:ahora,email:'luis@x.com',email_verified:'true'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>{console.log(c?'OK  ':'FAIL',m); if(!c) process.exitCode=1;};
let [s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar(base),nombre:'Luis <b>Campozano'});
ok(s===200&&r.token&&r.usuario.id==='a_001234.abcd.0101'&&r.usuario.proveedor==='apple'&&r.usuario.nombre==='Luis bCampozano','entra con Apple, cuenta "a_" y nombre limpio');
const T=r.token;
[s,r]=await call(T,'GET','yo'); ok(s===200,'la sesión de Apple sirve para la nube');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar({...base,email:undefined})});
ok(s===200&&r.usuario.nombre==='Luis bCampozano'&&r.usuario.email==='luis@x.com','la segunda vez (sin nombre ni correo) conserva los datos');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar({...base,aud:'otra.app'})}); ok(s===401&&/otra aplicación/.test(r.error),'rechaza token de otra app');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar({...base,iss:'https://evil.com'})}); ok(s===401,'rechaza otro emisor');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar({...base,exp:ahora-600})}); ok(s===401&&/expiró/.test(r.error),'rechaza token vencido');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar(base,{clave:otra.privateKey})}); ok(s===401,'rechaza firma falsa');
[s,r]=await call(null,'POST','auth/apple',{identityToken:await firmar(base,{kid:'zz'})}); ok(s===401,'rechaza clave desconocida');
[s,r]=await call(null,'POST','auth/apple',{identityToken:'basura'}); ok(s===401,'rechaza basura');
[s,r]=await call(T,'GET','mod/uso'); ok(s===404,'una cuenta de Apple no es administradora aunque su correo esté en la lista');
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'luis@x.com',clave:'fuerza2026',nombre:'X'}); ok(s===409&&/Apple/.test(r.error),'registro con correo de una cuenta de Apple: avisa usar Apple');
