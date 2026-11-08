// Nutricionista IA (v2.45.0): menú del día con metas, límites y limpieza de la respuesta (Claude simulado)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,GOOGLE_CLIENT_ID:'cid',ANTHROPIC_API_KEY:'sk-ant-prueba'};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>{console.log(c?'OK  ':'FAIL',m); if(!c) process.exitCode=1;};
const A=(await call(null,'POST','auth/correo',{modo:'registro',email:'ana@x.com',clave:'fuerza2026',nombre:'Ana'}))[1].token;
let llamadas=0, ultimo=null, respuesta=null;
globalThis.fetch=async(url,op)=>{ llamadas++; ultimo={url,op,body:JSON.parse(op.body)}; return respuesta(); };
const claude=(texto)=>()=>new Response(JSON.stringify({content:[{type:'text',text:texto}]}),{status:200});
const metas={kcal:2070,p:155,c:219,g:64};
let [s,r]=await call(null,'POST','ia/menu',{metas}); ok(s===401,'sin sesión no se puede');
[s,r]=await call(A,'POST','ia/menu',{metas:{kcal:0}}); ok(s===400&&/metas/.test(r.error)&&llamadas===0,'sin metas: pide configurarlas y no llama a la IA');
respuesta=claude('Listo: {"comidas":[{"comida":"desayuno","titulo":"Bolón <b>con huevo","alimentos":[{"nombre":"verde","gramos":150,"kcal":183,"p":2,"c":48,"g":0.5},{"nombre":"huevo","gramos":100,"kcal":143,"p":13,"c":1,"g":10},{"nombre":"nada","gramos":0}]},{"comida":"merienda rara","titulo":"Yogur","alimentos":[{"nombre":"yogur","gramos":200,"kcal":120,"p":10,"c":14,"g":3}]},{"comida":"cena","titulo":"vacía","alimentos":[]}],"consejos":["Toma agua","<i>Cocina al vapor</i>","x","y"]}');
[s,r]=await call(A,'POST','ia/menu',{metas,objetivo:'perder',comidas:9,gustos:'pescado',evitar:'cerdo',entrena:'tarde',entrenoHoy:'Pierna <b>',diasEntreno:'3 a 5',metas1RM:[{ejercicio:'Sentadilla',kg:160},{ejercicio:'',kg:5},null]}).catch(e=>[0,{}]);
ok(s===200&&r.comidas.length===2&&r.comidas[0].titulo==='Bolón bcon huevo'&&r.comidas[0].alimentos.length===2&&r.comidas[1].comida==='snack','limpia títulos, quita porciones en 0, comidas vacías y tipos raros');
ok(r.total.kcal===446&&r.total.p===25&&r.quedan===4&&r.consejos.length===3&&r.consejos[1]==='iCocina al vapor/i','suma totales en el servidor y limpia consejos');
const pedido=JSON.parse(ultimo.body.messages[0].content[0].text);
ok(pedido.comidas===5&&pedido.noCome==='cerdo'&&pedido.metas.kcal===2070&&ultimo.body.thinking.type==='adaptive','manda metas y preferencias, comidas entre 3 y 5, con pensamiento');
ok(pedido.entrena==='tarde'&&pedido.entrenoHoy==='Pierna b'&&pedido.metas1RM.length===1&&pedido.metas1RM[0].kg===160,'manda el contexto del gimnasio limpio (hora, entreno, metas de 1RM)');
respuesta=claude('{"comidas":[]}');
[s,r]=await call(A,'POST','ia/menu',{metas}); ok(s===502,'menú vacío: error claro');
const usados=db.prepare("SELECT n FROM uso_ia WHERE dia LIKE '%:m'").get(); ok(usados.n===1,'el menú vacío no gasta crédito');
respuesta=claude('{"comidas":[{"comida":"almuerzo","titulo":"Seco","alimentos":[{"nombre":"arroz","gramos":150,"kcal":195,"p":4,"c":42,"g":0.4}]}]}');
for(let i=0;i<4;i++) await call(A,'POST','ia/menu',{metas});
[s,r]=await call(A,'POST','ia/menu',{metas}); ok(s===429&&/5 menús/.test(r.error),'límite de 5 menús por día');
