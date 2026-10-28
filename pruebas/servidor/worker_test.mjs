import { DatabaseSync } from 'node:sqlite';
import { webcrypto as C } from 'node:crypto';
const W = (await import(new URL('../../_worker.js', import.meta.url).href)).default;
const db = new DatabaseSync(':memory:');
db.exec((await import('node:fs')).readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
// shim D1
class St { constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}
  bind(...a){this.a=a;return this;} args(){return this.ord.map(i=>this.a[i-1]);}
  all(){const s=db.prepare(this.sql);return {results:/^\s*(SELECT|.*RETURNING)/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}
  async first(){return this.all().results[0]||null;} async run(){return this.all();} }
const DB={prepare:(s)=>new St(s),batch:async(l)=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await C.subtle.exportKey('jwk',kp.publicKey)),kid:'k1'};
const CID='839266600135-40anun54d7qkappj2kv3oq7b6nf6vm9e.apps.googleusercontent.com';
const env={DB,GOOGLE_CLIENT_ID:CID,JWKS_PRUEBA:JSON.stringify({keys:[jwk]}),ASSETS:{fetch:()=>new Response('static')}};
const b64=(b)=>Buffer.from(b).toString('base64url');
async function jwt(p,{kid='k1',key=kp.privateKey}={}){const h=b64(JSON.stringify({alg:'RS256',kid}));const d=b64(JSON.stringify(p));
 const s=await C.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(h+'.'+d));return h+'.'+d+'.'+b64(new Uint8Array(s));}
const now=Math.floor(Date.now()/1000);
const base={iss:'https://accounts.google.com',aud:CID,sub:'123',email:'a@b.c',email_verified:true,name:'Luis',picture:'http://p',exp:now+3600};
const call=async(m,p,body,tok,hdr={})=>{const r=await W.fetch(new Request('https://fuerzapro.pages.dev'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{}),...hdr},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json().catch(()=>null)];};
const ok=(c,msg)=>console.log(c?'OK  ':'FAIL',msg);
let [s,r]=await call('GET','/index.html'); ok(s===200,'estatico');
[s,r]=await call('POST','/api/auth/google',{credential:await jwt({...base,aud:'otro'})}); ok(s===401,'aud incorrecto '+r.error);
[s,r]=await call('POST','/api/auth/google',{credential:await jwt({...base,exp:now-3600})}); ok(s===401,'expirado');
const otra=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
[s,r]=await call('POST','/api/auth/google',{credential:await jwt(base,{key:otra.privateKey})}); ok(s===401,'firma falsa');
[s,r]=await call('POST','/api/auth/google',{credential:await jwt(base)},null,{origin:'https://malo.com'}); ok(s===403,'origen ajeno');
[s,r]=await call('POST','/api/auth/google',{credential:await jwt(base)}); ok(s===200&&r.token,'login'); const A=r.token;
[s,r]=await call('POST','/api/auth/google',{credential:await jwt(base)}); const B=r.token; ok(A!==B,'segundo dispositivo');
[s,r]=await call('GET','/api/yo',null,A); ok(s===200&&r.usuario.nombre==='Luis','yo');
[s,r]=await call('GET','/api/yo',null,'xx'); ok(s===401,'token falso');
[s,r]=await call('POST','/api/sync',{desde:0,cambios:[{tipo:'entreno',id:'e1',data:{kg:100}},{tipo:'ajuste',id:'af_perfil',data:{n:'L'}}]},A); ok(s===200&&r.cambios.length===0&&r.cursor===2,'A sube 2 '+JSON.stringify(r));
const cA=r.cursor;
[s,r]=await call('POST','/api/sync',{desde:0,cambios:[{tipo:'comida',id:'c1',data:{kcal:500}}]},B); ok(r.cambios.length===2&&r.cursor===3,'B baja 2 y sube 1');
[s,r]=await call('POST','/api/sync',{desde:cA,cambios:[{tipo:'entreno',id:'e1',borrado:true}]},A); ok(r.cambios.length===1&&r.cambios[0].id==='c1'&&r.cursor===4,'A baja comida, borra e1');
[s,r]=await call('POST','/api/sync',{desde:3,cambios:[]},B); ok(r.cambios.length===1&&r.cambios[0].borrado,'B ve borrado');
// lote grande y paginacion
const muchos=Array.from({length:200},(_, i)=>({tipo:'serie',id:'s'+i,data:{i}}));
for(let k=0;k<4;k++){[s,r]=await call('POST','/api/sync',{desde:0,cambios:muchos.map(x=>({...x,id:x.id+'_'+k}))},A);} ok(s===200,'800 series');
let cur=0,tot=0,vueltas=0;do{[s,r]=await call('POST','/api/sync',{desde:cur,cambios:[]},B);tot+=r.cambios.length;cur=r.cursor;vueltas++;}while(r.mas);
ok(tot===803&&vueltas===2,'paginacion '+tot+' en '+vueltas);
[s,r]=await call('POST','/api/sync',{desde:0,cambios:[{tipo:'malo',id:'x'}]},A); ok(s===400,'tipo invalido');
[s,r]=await call('POST','/api/sync',{desde:0,cambios:Array(201).fill({tipo:'serie',id:'x'})},A); ok(s===400,'demasiados');
[s,r]=await call('POST','/api/salir',null,B); [s,r]=await call('GET','/api/yo',null,B); ok(s===401,'salir');
[s,r]=await call('DELETE','/api/cuenta',null,A); ok(s===200,'borrar cuenta');
ok(db.prepare('select count(*) n from items').get().n===0 && db.prepare('select count(*) n from usuarios').get().n===0,'todo borrado');
