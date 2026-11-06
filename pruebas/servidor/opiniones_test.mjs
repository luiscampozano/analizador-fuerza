// Comentarios de los usuarios (v2.38.0): enviar con y sin captura, validaciones, limite diario, moderacion y borrar cuenta
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { createHash } from 'node:crypto';
const require_sha=(t)=>createHash('sha256').update(t).digest('hex');
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,GOOGLE_CLIENT_ID:'cid',ADMIN_EMAILS:'luis@x.com'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const reg=async(e,n)=>(await call(null,'POST','auth/correo',{modo:'registro',email:e,clave:'fuerza2026',nombre:n}))[1].token;
const A=await reg('ana@x.com','Ana'), L='token-admin-prueba';
// el administrador entra con Google (las cuentas de correo no pueden ser administradoras)
db.prepare("insert into usuarios (id, email, nombre, creado) values ('g_luis','luis@x.com','Luis',0)").run();
db.prepare('insert into sesiones (token_hash, usuario, creado, expira) values (?,?,0,?)').run(require_sha(L),'g_luis',Date.now()+864e5);
let [s,r]=await call(null,'POST','opiniones',{tipo:'sugerencia',texto:'hola'}); ok(s===401,'sin sesión: no se puede enviar');
[s,r]=await call(A,'POST','opiniones',{tipo:'sugerencia',texto:'  '}); ok(s===400,'comentario vacío: rechazado');
[s,r]=await call(A,'POST','opiniones',{tipo:'sugerencia',texto:'Me encanta, agreguen dominadas lastradas',version:'2.38.0',plataforma:'play'}); ok(s===200&&r.ok,'sugerencia sin captura: guardada');
[s,r]=await call(A,'POST','opiniones',{tipo:'error',texto:'Falla el botón',captura:'<script>'}); ok(s===400,'captura que no es JPEG: rechazada');
[s,r]=await call(A,'POST','opiniones',{tipo:'error',texto:'Falla el botón',captura:'/9j/'+'A'.repeat(800)}); ok(s===200,'error con captura JPEG: guardado');
[s,r]=await call(A,'GET','mod/opiniones'); ok(s===404,'un usuario normal no ve la moderación');
[s,r]=await call(L,'GET','mod/opiniones'); ok(s===200&&r.opiniones.length===2&&r.opiniones.every(x=>x.estado==='nuevo')&&r.opiniones.some(x=>x.cap>0&&x.tipo==='error')&&!('captura' in r.opiniones[0]),'el administrador ve la lista (sin cargar las capturas)');
const id=r.opiniones.find(x=>x.cap).id;
[s,r]=await call(L,'GET','mod/opiniones/'+id); ok(s===200&&r.captura.startsWith('/9j/'),'ver la captura de un comentario');
[s,r]=await call(L,'POST','mod/opiniones/'+id,{estado:'resuelto'}); ok(s===200,'marcar como resuelto');
[s,r]=await call(L,'GET','mod/opiniones'); ok(r.opiniones.find(x=>x.id===id).estado==='resuelto','queda resuelto');
for(let i=0;i<18;i++) await call(A,'POST','opiniones',{tipo:'otro',texto:'comentario '+i});
[s,r]=await call(A,'POST','opiniones',{tipo:'otro',texto:'uno más'}); ok(s===429,'más de 20 al día: límite');
[s,r]=await call(A,'DELETE','cuenta'); ok(s===200&&db.prepare('select count(*) n from opiniones').get().n===0,'borrar la cuenta borra sus comentarios');
