// Base comunitaria de alimentos por código de barras (v2.19.0)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { webcrypto as Cr } from 'node:crypto';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await Cr.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await Cr.subtle.exportKey('jwk',kp.publicKey)),kid:'k1'};
const env={DB,GOOGLE_CLIENT_ID:'cid',JWKS_PRUEBA:JSON.stringify({keys:[jwk]}),ADMIN_EMAILS:'luis@x.com'};
const b64=b=>Buffer.from(b).toString('base64url');
async function jwt(sub,email){const h=b64(JSON.stringify({alg:'RS256',kid:'k1'}));const d=b64(JSON.stringify({iss:'accounts.google.com',aud:'cid',sub,email,email_verified:true,name:'G',exp:Math.floor(Date.now()/1000)+3600}));
 const s=await Cr.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+d));return h+'.'+d+'.'+b64(new Uint8Array(s));}
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const usuario=async(e)=>(await call(null,'POST','auth/correo',{modo:'registro',email:e,clave:'fuerza2026',nombre:e.split('@')[0]}))[1].token;
const A=await usuario('ana@x.com'), B=await usuario('beto@x.com'), C=await usuario('caro@x.com'), D=await usuario('dani@x.com');
const yogur={codigo:'7861234567890',nombre:'Yogur natural',marca:'Toni',kcal:62,p:3.5,c:4.7,g:3.2,porcion:200};
let [s,r]=await call(null,'GET','alimentos/7861234567890'); ok(s===200&&r.alimento===null,'código que no existe: null');
[s,r]=await call(null,'POST','alimentos',yogur); ok(s===401,'sin sesión no se puede agregar');
[s,r]=await call(A,'POST','alimentos',{...yogur,codigo:'12ab'}); ok(s===400,'código inválido rechazado');
[s,r]=await call(A,'POST','alimentos',{...yogur,kcal:620}); ok(s===400&&/no cuadran/.test(r.error),'calorías que no cuadran con los macros');
[s,r]=await call(A,'POST','alimentos',{...yogur,p:60,c:50}); ok(s===400,'macros que pasan de 100 g');
[s,r]=await call(A,'POST','alimentos',{...yogur,nombre:'<b>x'}); ok(s===200,'acepta nombre (se guarda como texto)');
[s,r]=await call(A,'POST','alimentos',yogur); ok(s===200&&!r.existente,'el mismo usuario puede corregir su producto');
[s,r]=await call(null,'GET','alimentos/7861234567890'); ok(s===200&&r.alimento&&r.alimento.nombre==='Yogur natural'&&r.alimento.kcal===62&&r.alimento.marca==='Toni'&&!('usuario' in r.alimento),'cualquiera lo encuentra por código (sin datos del autor)');
[s,r]=await call(B,'POST','alimentos',{...yogur,nombre:'Otro nombre'}); ok(s===200&&r.existente,'otra persona no lo sobrescribe');
[s,r]=await call(null,'GET','alimentos?q=yogur toni'); ok(s===200&&r.alimentos.length===1,'búsqueda por nombre y marca');
[s,r]=await call(null,'GET','alimentos?q=x'); ok(s===400,'búsqueda muy corta rechazada');
for(const t of [B,C]) await call(t,'POST','alimentos/7861234567890/reportar');
[s,r]=await call(B,'POST','alimentos/7861234567890/reportar'); ok(s===200&&!r.oculto,'reportar dos veces la misma persona no suma');
[s,r]=await call(D,'POST','alimentos/7861234567890/reportar'); ok(s===200&&r.oculto,'con 3 reportes se oculta');
[s,r]=await call(null,'GET','alimentos/7861234567890'); ok(r.alimento===null,'oculto: ya no aparece');
[s,r]=await call(B,'POST','alimentos',{...yogur,kcal:63}); ok(s===200&&!r.existente,'otra persona puede reemplazar uno oculto');
[s,r]=await call(null,'GET','alimentos/7861234567890'); ok(r.alimento&&r.alimento.kcal===63,'datos nuevos visibles');
[s,r]=await call(B,'DELETE','cuenta'); ok(s===200&&db.prepare('select usuario from alimentos').get().usuario===null,'borrar la cuenta deja el producto sin autor');
const ADM=(await call(null,'POST','auth/google',{credential:await jwt('g1','luis@x.com')}))[1].token;
await call(C,'POST','alimentos',{codigo:'7860000000017',nombre:'Galleta',kcal:480,p:6,c:68,g:20});
for(const t of [A,D]) await call(t,'POST','alimentos/7860000000017/reportar');
[s,r]=await call(ADM,'GET','mod/reportes'); const rep=(r.reportes||[]).find(x=>x.tipo==='alimento'&&x.id==='7860000000017');
ok(s===200&&rep&&/Galleta/.test(rep.contenido),'el moderador ve el alimento reportado');
[s,r]=await call(ADM,'POST','mod/accion',{tipo:'alimento',id:'7860000000017',accion:'ocultar'}); ok(s===200,'moderador oculta un alimento');
[s,r]=await call(null,'GET','alimentos/7860000000017'); ok(r.alimento===null,'oculto por el moderador');
[s,r]=await call(ADM,'POST','mod/accion',{tipo:'alimento',id:'7860000000017',accion:'borrar'}); ok(s===200&&!db.prepare("select count(*) n from alimentos where codigo='7860000000017'").get().n,'moderador borra un alimento');
