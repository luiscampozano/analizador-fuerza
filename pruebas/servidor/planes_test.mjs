// Planes de suscripcion (v2.33.0): modos apagado / prueba / activo, cupos de video, bolsa de IA, entrenador, video en
// la comunidad y planes regalados desde Moderacion
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { webcrypto as C } from 'node:crypto';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await C.subtle.exportKey('jwk',kp.publicKey)),kid:'k1'};
const env={DB,GOOGLE_CLIENT_ID:'cid',JWKS_PRUEBA:JSON.stringify({keys:[jwk]}),ADMIN_EMAILS:'luis@x.com',ANTHROPIC_API_KEY:'k'};
const b64=b=>Buffer.from(b).toString('base64url');
async function jwt(sub,email,name){const h=b64(JSON.stringify({alg:'RS256',kid:'k1'}));const d=b64(JSON.stringify({iss:'accounts.google.com',aud:'cid',sub,email,email_verified:true,name,picture:'https://g/'+sub,exp:Math.floor(Date.now()/1000)+3600}));
 const s=await C.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+d));return h+'.'+d+'.'+b64(new Uint8Array(s));}
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const reg=async(e,n)=>(await call(null,'POST','auth/correo',{modo:'registro',email:e,clave:'fuerza2026',nombre:n}))[1].token;
const L=(await call(null,'POST','auth/google',{credential:await jwt('1','luis@x.com','Luis')}))[1].token, A=await reg('ana@x.com','Ana');
globalThis.fetch=async()=>new Response(JSON.stringify({content:[{type:'text',text:'{"alimentos":[{"nombre":"Arroz","gramos":100,"kcal":130,"p":3,"c":28,"g":0.3}]}'}]}),{status:200});
let [s,r]=await call(A,'GET','plan'); ok(s===200&&r.modo==='apagado'&&!r.aplica&&r.permisos.pdf,'apagado: sin límites para nadie');
[s,r]=await call(A,'POST','plan/usar',{tipo:'video'}); ok(s===200&&r.ok,'apagado: analizar video no cuenta');
[s,r]=await call(A,'POST','mod/planes',{modo:'activo'}); ok(s===404,'solo el administrador cambia el modo');
[s,r]=await call(L,'POST','mod/planes',{modo:'prueba'}); ok(s===200&&r.modo==='prueba','Luis pone el modo prueba');
[s,r]=await call(A,'GET','plan'); ok(!r.aplica,'modo prueba: Ana (no admin) sigue sin límites');
[s,r]=await call(L,'GET','plan'); ok(r.aplica&&r.plan==='gratis'&&r.limites.video.lim===3&&r.limites.ia.lim===10&&r.limites.coach.lim===1&&!r.permisos.pdf&&r.permisos.historialDias===30,'modo prueba: Luis ve el plan Gratis');
for(let i=0;i<3;i++) await call(L,'POST','plan/usar',{tipo:'video'});
[s,r]=await call(L,'POST','plan/usar',{tipo:'video'}); ok(s===429&&/3 análisis de video/.test(r.error)&&/Plus/.test(r.error)&&r.limite==='video','Gratis: 3 videos al mes y luego invita a Plus');
for(let i=0;i<10;i++) await call(L,'POST',['ia/texto','ia/texto','ia/texto'][0],{texto:'arroz con pollo'});
[s,r]=await call(L,'POST','ia/texto',{texto:'arroz con pollo'}); ok(s===429&&/10 créditos IA de nutrición/.test(r.error),'Gratis: bolsa de 10 créditos IA de nutrición al mes');
[s,r]=await call(L,'POST','mod/plan_usuario',{quien:'yo',plan:'plus',reiniciarUso:true}); ok(s===200&&r.plan==='plus','Luis se pone Plus para probar');
[s,r]=await call(L,'GET','plan'); ok(r.plan==='plus'&&r.limites.video.lim===20&&r.usos.video===0&&r.limites.coach.por==='semana'&&r.permisos.pdf,'Plus: 20 videos, entrenador semanal, PDF');
[s,r]=await call(L,'POST','mod/plan_usuario',{quien:'ana@x.com',plan:'promax',dias:30}); ok(s===200&&r.hasta>Date.now(),'regalar Pro Max a Ana por 30 días (por correo)');
[s,r]=await call(L,'POST','mod/plan_usuario',{quien:'nadie',plan:'pro'}); ok(s===404,'persona inexistente');
[s,r]=await call(L,'GET','mod/planes'); ok(s===200&&r.modo==='prueba'&&r.usuarios.length===2,'Moderación lista los planes vigentes');
[s,r]=await call(L,'POST','mod/planes',{modo:'activo'});
[s,r]=await call(A,'GET','plan'); ok(r.aplica&&r.plan==='promax'&&r.limites.video.lim===null,'activo: Ana con Pro Max tiene video ilimitado');
for(let i=0;i<45;i++) await call(A,'POST','plan/usar',{tipo:'video'});
[s,r]=await call(A,'POST','plan/usar',{tipo:'video'}); ok(s===200,'Pro Max: sin tope de videos');
db.prepare("update planes set hasta=? where usuario=(select id from usuarios where email='ana@x.com')").run(Date.now()-1000);
[s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis','al vencer el regalo vuelve a Gratis');
[s,r]=await call(L,'POST','mod/planes',{modo:'apagado'}); [s,r]=await call(L,'GET','plan'); ok(!r.aplica,'apagar los límites');
[s,r]=await call(A,'DELETE','cuenta'); ok(s===200&&db.prepare("select count(*) n from uso_plan where usuario not in (select id from usuarios)").get().n===0&&db.prepare("select count(*) n from planes where usuario not in (select id from usuarios)").get().n===0,'borrar la cuenta borra su plan y su uso');
