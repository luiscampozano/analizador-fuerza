// Panel de uso (v2.40.0): conteo anonimo diario y estadisticas para el administrador
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { createHash } from 'node:crypto';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,GOOGLE_CLIENT_ID:'cid',ADMIN_EMAILS:'luis@x.com'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const A=(await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'fuerza2026',nombre:'Ana'}))[1].token, L='token-admin-prueba';
db.prepare("insert into usuarios (id, email, nombre, creado, visto) values ('g_luis','luis@x.com','Luis',0,?)").run(Date.now());
db.prepare('insert into sesiones (token_hash, usuario, creado, expira) values (?,?,0,?)').run(createHash('sha256').update(L).digest('hex'),'g_luis',Date.now()+864e5);
const id=(k)=>'a1b2c3d4-0000-4000-8000-'+String(k).padStart(12,'0');
let [s,r]=await call(null,'POST','visita',{anon:id(1),plataforma:'play',cuenta:true}); ok(s===200&&r.ok,'visita sin iniciar sesión: se cuenta');
await call(null,'POST','visita',{anon:id(1),plataforma:'play'}); ok(db.prepare('select count(*) n from visitas').get().n===1,'la misma persona el mismo día cuenta una vez');
await call(null,'POST','visita',{anon:id(2),plataforma:'ios'}); await call(null,'POST','visita',{anon:id(3)});
[s,r]=await call(null,'POST','visita',{anon:'<script>'}); ok(s===400,'identificador raro: rechazado');
db.prepare("insert into visitas (dia, anon, plataforma, cuenta) values ('2000-01-01','viejo-0000000000000000','web',0)").run();
[s,r]=await call(A,'GET','mod/uso'); ok(s===404,'un usuario normal no ve el panel');
[s,r]=await call(L,'GET','mod/uso'); ok(s===200&&r.visitas.hoy===3&&r.visitas.d30===3&&r.visitas.plataformas.play===1&&r.visitas.plataformas.ios===1&&r.visitas.sinCuenta30===2,'panel: personas hoy/30 días y por plataforma (sin contar lo viejo)');
ok(r.cuentas.total===2&&r.cuentas.nuevas7>=1&&r.cuentas.activas7>=1,'panel: cuentas totales, nuevas y activas');
