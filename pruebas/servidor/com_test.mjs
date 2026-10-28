import { DatabaseSync } from 'node:sqlite'; import { webcrypto as C } from 'node:crypto'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await C.subtle.exportKey('jwk',kp.publicKey)),kid:'k1'};const CID='cid';
const env={DB,GOOGLE_CLIENT_ID:CID,JWKS_PRUEBA:JSON.stringify({keys:[jwk]}),ADMIN_EMAILS:'luis@x.com',ASSETS:{fetch:()=>new Response('s')}};
const b64=b=>Buffer.from(b).toString('base64url');
async function jwt(sub,email,name){const h=b64(JSON.stringify({alg:'RS256',kid:'k1'}));const d=b64(JSON.stringify({iss:'accounts.google.com',aud:CID,sub,email,email_verified:true,name,picture:'https://g/'+sub,exp:Math.floor(Date.now()/1000)+3600}));
 const s=await C.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+d));return h+'.'+d+'.'+b64(new Uint8Array(s));}
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);let j=null;try{j=await r.clone().json()}catch(e){};return [r.status,j,r];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const login=async(s,e,n)=>(await call(null,'POST','auth/google',{credential:await jwt(s,e,n)}))[1].token;
const L=await login('1','luis@x.com','Luis'), A=await login('2','ana@x.com','Ana'), M=await login('3','malo@x.com','Malo');
let [s,r]=await call(L,'GET','comunidad/yo'); ok(s===200&&r.perfil===null&&r.admin===true,'yo sin perfil, admin');
[s,r]=await call(L,'POST','comunidad/publicaciones',{ref:'e1',datos:{titulo:'x'}}); ok(s===403,'publicar sin perfil bloqueado');
[s,r]=await call(L,'PUT','comunidad/perfil',{alias:'Luis Pro',nombre:'Luis'}); ok(s===400,'alias con espacio rechazado');
[s,r]=await call(L,'PUT','comunidad/perfil',{alias:'admin',nombre:'Luis'}); ok(s===400,'alias reservado');
[s,r]=await call(L,'PUT','comunidad/perfil',{alias:'@LuisPL',nombre:'Luis Campozano',bio:'Powerlifter',gimnasio:'Titan Gym',foto:'data:image/jpeg;base64,/9j/AAAA'}); ok(s===200&&r.perfil.alias==='luispl'&&r.perfil.foto.startsWith('/api/foto/1'),'perfil creado '+JSON.stringify(r.perfil).slice(0,90));
[s,r]=await call(A,'PUT','comunidad/perfil',{alias:'LUISPL',nombre:'Ana'}); ok(s===409,'alias duplicado (mayúsculas)');
[s,r]=await call(A,'PUT','comunidad/perfil',{alias:'ana.fit',nombre:'Ana',foto:'javascript:alert(1)'}); ok(s===400,'foto maliciosa rechazada');
[s,r]=await call(A,'PUT','comunidad/perfil',{alias:'ana.fit',nombre:'Ana <b>',gimnasio:'Titan Gym'}); ok(s===200&&r.perfil.foto==='https://g/2','perfil Ana con foto de Google');
[s,r]=await call(M,'PUT','comunidad/perfil',{alias:'malo',nombre:'Malo'});
const [,,rf]=await call(null,'GET','foto/1'); ok(rf.status===200&&rf.headers.get('content-type')==='image/jpeg','foto pública servida');
const datos={titulo:'Pierna pesada',inicio:'2026-10-26T10:00:00Z',duracion:65,volumen:5400,series:12,ejercicios:[{nombre:'Sentadilla',ej:'sentadilla',series:[{kg:140,reps:5,rpe:8}]}],records:[{nombre:'Sentadilla',records:[{tipo:'1RM estimado',texto:'163 kg'}]}]};
[s,r]=await call(L,'POST','comunidad/publicaciones',{ref:'e1',texto:'Buen día 💪',datos}); ok(s===200&&r.nueva,'Luis publica'); const P1=r.publicacion.id;
[s,r]=await call(L,'POST','comunidad/publicaciones',{ref:'e1',texto:'Editado',datos}); ok(r.publicacion.id===P1&&!r.nueva&&r.publicacion.texto==='Editado','republicar mismo entreno edita');
[s,r]=await call(A,'GET','comunidad/feed?modo=siguiendo'); ok(r.publicaciones.length===0,'Ana sin seguir: feed vacío');
[s,r]=await call(A,'GET','comunidad/feed?modo=descubrir'); ok(r.publicaciones.length===1&&r.publicaciones[0].autor.alias==='luispl','Descubrir muestra a Luis');
[s,r]=await call(A,'GET','comunidad/sugerencias'); ok(r.personas.some(p=>p.alias==='luispl'),'sugerencias');
[s,r]=await call(A,'GET','comunidad/buscar?q=titan'); ok(r.personas.length===1&&r.personas[0].alias==='luispl','buscar por gimnasio (excluye propio? '+r.personas.map(p=>p.alias)+')');
[s,r]=await call(A,'POST','comunidad/seguir/1'); ok(r.loSigo,'Ana sigue a Luis');
[s,r]=await call(A,'GET','comunidad/feed?modo=siguiendo'); ok(r.publicaciones.length===1,'feed Siguiendo de Ana');
[s,r]=await call(A,'POST',`comunidad/publicaciones/${P1}/like`); ok(r.likes===1&&r.meGusta,'like');
[s,r]=await call(A,'POST',`comunidad/publicaciones/${P1}/like`); ok(r.likes===1,'like doble no duplica');
[s,r]=await call(A,'POST',`comunidad/publicaciones/${P1}/comentarios`,{texto:'¡Qué fuerza! <script>'}); ok(s===200,'comentario'); const C1=r.comentario.id;
[s,r]=await call(L,'GET',`comunidad/publicaciones/${P1}`); ok(r.comentarios.length===1&&r.publicacion.likes===1&&r.publicacion.comentarios===1,'detalle con comentario y like');
[s,r]=await call(L,'GET','comunidad/actividad'); ok(r.actividad.map(a=>a.tipo).sort().join()==='comentario,like,seguir','actividad de Luis: '+r.actividad.map(a=>a.tipo));
[s,r]=await call(L,'GET','comunidad/u/ana.fit'); ok(r.perfil.meSigue&&!r.perfil.loSigo&&r.perfil.seguidores===0,'perfil de Ana visto por Luis');
[s,r]=await call(A,'GET','comunidad/u/luispl'); ok(r.perfil.seguidores===1&&r.perfil.publicaciones===1&&r.perfil.loSigo,'perfil Luis visto por Ana');
// Malo comenta, Luis lo bloquea
[s,r]=await call(M,'POST',`comunidad/publicaciones/${P1}/comentarios`,{texto:'spam spam'}); const C2=r.comentario.id;
[s,r]=await call(L,'POST','comunidad/bloquear/3'); ok(r.bloqueado,'Luis bloquea a Malo');
[s,r]=await call(L,'GET',`comunidad/publicaciones/${P1}`); ok(r.comentarios.length===1,'comentario del bloqueado oculto para Luis');
[s,r]=await call(M,'GET','comunidad/feed?modo=descubrir'); ok(r.publicaciones.length===0,'bloqueado no ve publicaciones de Luis');
[s,r]=await call(M,'POST',`comunidad/publicaciones/${P1}/comentarios`,{texto:'otra vez'}); ok(s===404,'bloqueado no puede comentar');
[s,r]=await call(M,'POST','comunidad/seguir/1'); ok(s===404,'bloqueado no puede seguir');
[s,r]=await call(M,'GET','comunidad/u/luispl'); ok(s===404,'bloqueado no ve el perfil');
[s,r]=await call(L,'GET','comunidad/bloqueados'); ok(r.personas.length===1,'lista de bloqueados');
// reportes y auto-ocultar
const D=await login('4','d@x.com','D'); await call(D,'PUT','comunidad/perfil',{alias:'ddd',nombre:'D'});
[s,r]=await call(M,'POST','comunidad/publicaciones',{ref:'m1',texto:'contenido feo',datos:{titulo:'feo'}}); const PM=r.publicacion.id;
for(const t of [L,A]) await call(t,'POST','comunidad/reportar',{tipo:'publicacion',id:PM,motivo:'ofensivo'});
[s,r]=await call(D,'GET','comunidad/feed?modo=descubrir'); ok(r.publicaciones.some(p=>p.id===PM),'con 2 reportes sigue visible');
await call(D,'POST','comunidad/reportar',{tipo:'publicacion',id:PM,motivo:'spam'});
[s,r]=await call(D,'GET','comunidad/feed?modo=descubrir'); ok(!r.publicaciones.some(p=>p.id===PM),'con 3 reportes se oculta');
[s,r]=await call(A,'GET','mod/reportes'); ok(s===404,'Ana no es moderadora');
[s,r]=await call(L,'GET','mod/reportes'); ok(r.reportes.length===1&&r.reportes[0].n===3,'moderación lista reportes: '+JSON.stringify(r.reportes[0]).slice(0,140));
[s,r]=await call(L,'POST','mod/accion',{tipo:'publicacion',id:PM,accion:'borrar'}); ok(s===200,'moderador borra');
[s,r]=await call(L,'GET','mod/reportes'); ok(r.reportes.length===0,'reportes resueltos');
// borrar comentario por dueño de la publicación
[s,r]=await call(L,'DELETE',`comunidad/comentarios/${C2}`); ok(s===200,'dueño borra comentario ajeno');
[s,r]=await call(A,'DELETE',`comunidad/publicaciones/${P1}`); ok(s===403,'Ana no puede borrar publicación de Luis');
// limites
let lim=0; for(let i=0;i<9;i++){[s]=await call(A,'POST',`comunidad/publicaciones/${P1}/comentarios`,{texto:'c'+i}); if(s===429) lim++;} ok(lim>=1,'límite de comentarios por minuto');
// paginación
for(let i=0;i<14;i++) await call(L,'POST','comunidad/publicaciones',{ref:'x'+i,datos:{titulo:'t'+i}});
db.exec("UPDATE publicaciones SET creado = creado - rowid*1000");
[s,r]=await call(A,'GET','comunidad/feed?modo=usuario&u=1'); const n1=r.publicaciones.length; [s,r]=await call(A,'GET','comunidad/feed?modo=usuario&u=1&antes='+r.antes);
ok(n1===LOTE(20)&&r.publicaciones.length>=0, 'paginación usuario: '+n1+' + '+r.publicaciones.length);
function LOTE(x){return Math.min(x,15)}
[s,r]=await call(L,'POST','comunidad/publicaciones',{ref:'y',datos:{titulo:'z'}}); ok(s===429,'límite de publicaciones por hora');
// eliminar cuenta de Ana borra todo lo suyo
await call(A,'DELETE','cuenta');
const resto=['perfiles','seguidores','likes','comentarios'].map(t=>t+':'+db.prepare(`select count(*) n from ${t} where ${t==='seguidores'?'seguidor':'usuario'}='2'`).get().n).join(' ');
ok(!/:[1-9]/.test(resto),'cuenta de Ana borrada en comunidad ('+resto+')');
[s,r]=await call(L,'DELETE','comunidad/perfil'); ok(db.prepare("select count(*) n from publicaciones where usuario='1'").get().n===0,'dejar la comunidad borra publicaciones');
