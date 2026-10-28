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
let [s,r]=await call(null,'POST','auth/google',{credential:await jwt('g1','luis@x.com')});
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'LUIS@x.com',clave:'abc12345',nombre:'Falso'}); ok(s===409&&/Google/.test(r.error),'no se puede registrar un correo de Google: '+r.error);
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x',clave:'abc12345',nombre:'Ana'}); ok(s===400,'correo inválido');
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'abc',nombre:'Ana'}); ok(s===400,'clave corta');
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'abcdefgh',nombre:'Ana'}); ok(s===400,'clave sin números');
let t0=Date.now();[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:' Ana@X.com ',clave:'fuerza2026',nombre:'Ana Torres'}); ok(s===200&&r.token&&r.usuario.id.startsWith('c_')&&r.usuario.proveedor==='correo','registro ('+(Date.now()-t0)+' ms)');
const A=r.token;
const fila=db.prepare('select * from credenciales').get(); ok(fila.hash.length===64&&!JSON.stringify(fila).includes('fuerza2026'),'contraseña no guardada en claro');
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'otra12345',nombre:'X'}); ok(s===409,'correo duplicado');
[s,r]=await call(A,'GET','yo'); ok(r.usuario.email==='ana@x.com','sesión de registro funciona');
[s,r]=await call(A,'POST','sync',{desde:0,cambios:[{tipo:'entreno',id:'e1',data:{a:1}}]}); ok(s===200,'sincroniza');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'fuerza2026'}); ok(s===200,'ingreso correcto'); const A2=r.token;
[s,r]=await call(A2,'POST','sync',{desde:0,cambios:[]}); ok(r.cambios.length===1,'otro dispositivo recibe datos');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'luis@x.com',clave:'x'}); ok(s===401&&/Google/.test(r.error),'correo de Google pide entrar con Google');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'nadie@x.com',clave:'x'}); ok(s===401&&r.error==='Correo o contraseña incorrectos.','cuenta inexistente: mensaje genérico');
for(let i=0;i<4;i++){[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'mala'+i});} ok(s===401,'4 fallos');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'mala5'}); ok(s===429,'5.º fallo bloquea');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'fuerza2026'}); ok(s===429,'bloqueada aunque la clave sea correcta: '+r.error);
db.exec("update credenciales set bloqueado_hasta=0");
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'fuerza2026'}); ok(s===200,'tras el bloqueo entra'); const A3=r.token;
[s,r]=await call(A3,'POST','auth/clave',{actual:'mala',nueva:'nueva2026'}); ok(s===401,'cambio con clave actual mala');
[s,r]=await call(A3,'POST','auth/clave',{actual:'fuerza2026',nueva:'nueva2026'}); ok(s===200,'cambio de contraseña');
[s,r]=await call(A,'GET','yo'); ok(s===401,'otras sesiones cerradas');
[s,r]=await call(A3,'GET','yo'); ok(s===200,'sesión actual sigue');
[s,r]=await call(null,'POST','auth/correo',{modo:'ingreso',email:'ana@x.com',clave:'nueva2026'}); ok(s===200,'entra con la nueva');
// un usuario de correo con correo de admin no es admin
[s,r]=await call(null,'POST','auth/correo',{modo:'registro',email:'falso@x.com',clave:'fuerza2026',nombre:'F'}); const F=r.token;
[s,r]=await call(F,'GET','comunidad/yo'); ok(r.admin===false,'cuenta de correo nunca es moderadora');
[s,r]=await call(A3,'DELETE','cuenta'); ok(db.prepare("select count(*) n from credenciales where email='ana@x.com'").get().n===0,'eliminar cuenta borra credenciales');
