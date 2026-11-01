// Foto del plato con IA (v2.22.0): limites, clave ausente y respuesta de Claude simulada (sin gastar créditos)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,GOOGLE_CLIENT_ID:'cid'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
const A=(await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'fuerza2026',nombre:'Ana'}))[1].token;
const foto=Buffer.from('jpeg falso').toString('base64');
let llamadas=0, ultimo=null, respuesta=null;
globalThis.fetch=async(url,op)=>{ llamadas++; ultimo={url,op,body:JSON.parse(op.body)}; return respuesta(); };
const claude=(texto)=>()=>new Response(JSON.stringify({content:[{type:'text',text:texto}]}),{status:200});
let [s,r]=await call(A,'POST','ia/plato',{imagen:foto}); ok(s===503&&/pronto/.test(r.error)&&llamadas===0,'sin clave: "disponible pronto" y no llama a la IA');
env.ANTHROPIC_API_KEY='sk-ant-prueba';
[s,r]=await call(null,'POST','ia/plato',{imagen:foto}); ok(s===401,'sin sesión no se puede');
[s,r]=await call(A,'POST','ia/plato',{imagen:'<script>'}); ok(s===400,'foto no base64 rechazada');
respuesta=claude('Aquí está: {"alimentos":[{"nombre":"Arroz blanco","gramos":150,"kcal":195,"p":4,"c":42,"g":0.4,"confianza":"alta"},{"nombre":"Pollo <b>","gramos":120,"kcal":198,"p":37,"c":0,"g":4.3,"confianza":"media"},{"nombre":"x","gramos":0}],"nota":"Plato típico"}');
[s,r]=await call(A,'POST','ia/plato',{imagen:foto});
ok(s===200&&r.alimentos.length===2&&r.alimentos[0].kcal===195&&r.alimentos[1].nombre==='Pollo b'&&r.quedan===9,'analiza, limpia nombres y descarta porciones en 0');
ok(ultimo.url==='https://api.anthropic.com/v1/messages'&&ultimo.op.headers['x-api-key']==='sk-ant-prueba'&&ultimo.body.model==='claude-haiku-5-5'&&ultimo.body.messages[0].content[0].source.data===foto,'llama a Claude Haiku con la clave del secreto y la foto');
respuesta=claude('no es json');
[s,r]=await call(A,'POST','ia/plato',{imagen:foto}); ok(s===502,'respuesta rara de la IA: error claro');
respuesta=()=>new Response('{"error":"overloaded"}',{status:529});
[s,r]=await call(A,'POST','ia/plato',{imagen:foto}); ok(s===502&&/ocupada/.test(r.error),'IA saturada: mensaje claro');
respuesta=claude('{"alimentos":[],"nota":"x"}');
for(let i=0;i<9;i++) await call(A,'POST','ia/plato',{imagen:foto});
[s,r]=await call(A,'POST','ia/plato',{imagen:foto}); ok(s===429&&/10 fotos/.test(r.error),'límite de 10 fotos por día');
[s,r]=await call(A,'DELETE','cuenta'); ok(s===200&&db.prepare('select count(*) n from uso_ia').get().n===0,'borrar la cuenta borra su uso');
