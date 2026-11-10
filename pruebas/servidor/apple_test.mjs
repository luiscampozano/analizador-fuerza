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
// v2.50.0 revocar el permiso de Apple al borrar la cuenta (guía 5.1.1(v)): Apple simulado
{
  const ec=await C.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await C.subtle.exportKey('pkcs8',ec.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
  const llamadas=[]; const fetchReal=globalThis.fetch;
  globalThis.fetch=async(url,o={})=>{const u=String(url); if(!u.startsWith('https://appleid.apple.com/auth/')) return fetchReal(url,o);
    const f=Object.fromEntries(new URLSearchParams(String(o.body))); llamadas.push({u,f});
    if(u.endsWith('/token')) return new Response(JSON.stringify(f.code==='malo'?{error:'invalid_grant'}:{refresh_token:'rt_'+f.code,access_token:'at'}),{status:f.code==='malo'?400:200});
    return new Response('',{status:200});};
  const base2={...base,sub:'009999.siwa'};
  let [s1,r1]=await call(null,'POST','auth/apple',{identityToken:await firmar(base2),authorizationCode:'c1'});
  ok(s1===200&&llamadas.length===0,'sin la llave en el servidor: entra igual y no llama a Apple');
  env.APPLE_SIWA_CLAVE=pem; env.APPLE_SIWA_KEY_ID='KEY1234567';
  [s1,r1]=await call(null,'POST','auth/apple',{identityToken:await firmar(base2),authorizationCode:'c2'});
  const t=llamadas.find(x=>x.u.endsWith('/token'));
  ok(s1===200&&t&&t.f.grant_type==='authorization_code'&&t.f.code==='c2'&&t.f.client_id==='com.fuerzapro.app','con la llave: cambia el código por un refresh_token');
  const [h,p,sig]=t.f.client_secret.split('.'); const cab=JSON.parse(Buffer.from(h,'base64url')),cu=JSON.parse(Buffer.from(p,'base64url'));
  const valida=await C.subtle.verify({name:'ECDSA',hash:'SHA-256'},ec.publicKey,Buffer.from(sig,'base64url'),new TextEncoder().encode(h+'.'+p));
  ok(valida&&cab.alg==='ES256'&&cab.kid==='KEY1234567'&&cu.iss==='N742H5M572'&&cu.aud==='https://appleid.apple.com'&&cu.sub==='com.fuerzapro.app'&&cu.exp>cu.iat,'client_secret firmado ES256 con los datos que pide Apple');
  ok(db.prepare("SELECT refresh FROM apple_tokens WHERE usuario='a_009999.siwa'").get()?.refresh==='rt_c2','guarda el refresh_token');
  const [s3]=await call(null,'POST','auth/apple',{identityToken:await firmar(base2),authorizationCode:'malo'});
  ok(s3===200&&db.prepare("SELECT refresh FROM apple_tokens WHERE usuario='a_009999.siwa'").get()?.refresh==='rt_c2','si Apple rechaza el código: entra igual y conserva el anterior');
  llamadas.length=0;
  const [sb]=await call(r1.token,'DELETE','cuenta');
  const rv=llamadas.find(x=>x.u.endsWith('/revoke'));
  ok(sb===200&&rv&&rv.f.token==='rt_c2'&&rv.f.token_type_hint==='refresh_token','al borrar la cuenta revoca el permiso en Apple');
  ok(!db.prepare("SELECT 1 FROM apple_tokens WHERE usuario='a_009999.siwa'").get()&&!db.prepare("SELECT 1 FROM usuarios WHERE id='a_009999.siwa'").get(),'borra el token y la cuenta');
  globalThis.fetch=async(url,o)=>String(url).startsWith('https://appleid.apple.com/auth/')?(()=>{throw new Error('sin red');})():fetchReal(url,o);
  const [s4,r4]=await call(null,'POST','auth/apple',{identityToken:await firmar({...base,sub:'00777.x'}),authorizationCode:'c9'});
  const [s5]=await call(r4.token,'DELETE','cuenta');
  ok(s4===200&&s5===200,'sin conexión con Apple: igual entra y borra la cuenta');
  globalThis.fetch=fetchReal; delete env.APPLE_SIWA_CLAVE; delete env.APPLE_SIWA_KEY_ID;
}
