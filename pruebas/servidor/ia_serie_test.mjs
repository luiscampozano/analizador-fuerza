// Explicar una serie con IA (v2.39.0): numeros + hasta 4 fotos, validaciones, creditos y saltos de linea
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,GOOGLE_CLIENT_ID:'cid',ANTHROPIC_API_KEY:'k'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
let enviado=null;
globalThis.fetch=async(url,o)=>{ if(String(url).includes('anthropic')){enviado=JSON.parse(o.body);return new Response(JSON.stringify({content:[{type:'text',text:'**Lo que dicen tus numeros**\nHiciste 8 reps.\n**Para la proxima**\n- Sube 2,5 kg'}]}));} return new Response('{}',{status:500}); };
const A=(await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'fuerza2026',nombre:'Ana'}))[1].token;
const datos={tipo:'pesas',ejercicio:'Sentadilla',reps:8,rir:'2'}, foto='/9j/'+'B'.repeat(500);
let [s,r]=await call(null,'POST','ia/serie',{datos}); ok(s===401,'sin sesión: no se puede');
[s,r]=await call(A,'POST','ia/serie',{datos,fotos:['no-es-jpeg']}); ok(s===400,'foto que no es JPEG: rechazada');
[s,r]=await call(A,'POST','ia/serie',{datos,fotos:[foto,foto,foto,foto,foto,foto]}); ok(s===200&&enviado.messages[0].content.filter(c=>c.type==='image').length===4,'con fotos: se envían como mucho 4 a la IA');
ok(enviado.messages[0].content.some(c=>c.type==='text'&&c.text.includes('Sentadilla'))&&/palabras simples|persona comun/.test(enviado.system),'manda los números y pide lenguaje sencillo');
ok(r.texto.includes('\n')&&r.texto.includes('**Para la proxima**'),'la respuesta conserva los saltos de línea');
[s,r]=await call(A,'POST','ia/serie',{datos}); ok(s===200&&enviado.messages[0].content.length===1,'sin video: solo los números');
ok(db.prepare("select n from uso_ia where dia like '%:s'").get().n===2,'cuenta en el uso de IA');
for(let i=0;i<8;i++) await call(A,'POST','ia/serie',{datos});
[s,r]=await call(A,'POST','ia/serie',{datos}); ok(s===429,'límite diario sin planes (10)');
