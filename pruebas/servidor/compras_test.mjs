// Cobro con Google Play (v2.37.0): verificar el token con Google (simulado), confirmar, activar el plan, token de una
// sola cuenta, regalo mejor no se pisa, renovacion al vencer, borrar la cuenta libera la compra
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { webcrypto as C } from 'node:crypto';
const W=(await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now())).default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await C.subtle.exportKey('pkcs8',kp.privateKey)).toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
const env={DB,GOOGLE_CLIENT_ID:'cid',ADMIN_EMAILS:'luis@x.com',PLAY_CUENTA_SERVICIO:JSON.stringify({client_email:'fp@proy.iam.gserviceaccount.com',private_key:pem})};
const call=async(tok,m,p,body)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),env);return [r.status,await r.json()];};
const ok=(c,m)=>console.log(c?'OK  ':'FAIL',m);
// Google simulado
const subs={}; let acks=[], jwtOk=false;
globalThis.fetch=async(url,o={})=>{url=String(url);
  if(url.startsWith('https://oauth2.googleapis.com/token')){const a=decodeURIComponent(o.body.split('assertion=')[1]).split('.');
    jwtOk=await C.subtle.verify('RSASSA-PKCS1-v1_5',kp.publicKey,Buffer.from(a[2],'base64url'),new TextEncoder().encode(a[0]+'.'+a[1]))&&JSON.parse(Buffer.from(a[1],'base64url')).scope.includes('androidpublisher');
    return new Response(JSON.stringify({access_token:'AT',expires_in:3600}));}
  if(o.headers?.authorization!=='Bearer AT') return new Response('{}',{status:401});
  let m=url.match(/subscriptionsv2\/tokens\/([^/?]+)$/); if(m){const s=subs[decodeURIComponent(m[1])];return s?new Response(JSON.stringify(s)):new Response('{}',{status:404});}
  m=url.match(/subscriptions\/([^/]+)\/tokens\/([^/:]+):acknowledge$/); if(m){acks.push(decodeURIComponent(m[2]));subs[decodeURIComponent(m[2])].acknowledgementState='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';return new Response('{}');}
  return new Response('{}',{status:500});};
const sub=(prod,dias,estado='SUBSCRIPTION_STATE_ACTIVE',extra={})=>({subscriptionState:estado,acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:prod,expiryTime:new Date(Date.now()+dias*864e5).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...extra});
const reg=async(e,n)=>(await call(null,'POST','auth/correo',{modo:'registro',email:e,clave:'fuerza2026',nombre:n}))[1].token;
const A=await reg('ana@x.com','Ana'), B=await reg('beto@x.com','Beto'), L=await reg('luis@x.com','Luis');
db.prepare("update ajustes_app set valor='activo' where clave='limites'").run();
let [s,r]=await call(A,'POST','plan/compra',{token:'nohay-token-123'}); ok(s===400,'token que Google no conoce: rechazado');
subs['token-play-ana-1']=sub('pro_mensual',30);
[s,r]=await call(A,'POST','plan/compra',{token:'token-play-ana-1'}); ok(s===200&&r.ok&&r.comprado==='pro'&&r.plan==='pro'&&r.aplica&&r.limites.video.lim===40,'compra Pro mensual: plan Pro activo');
ok(jwtOk,'la cuenta de servicio firma el acceso a Google correctamente');
ok(acks.includes('token-play-ana-1'),'la compra se confirma (acknowledge) en Google');
[s,r]=await call(A,'POST','plan/compra',{token:'token-play-ana-1'}); ok(s===200&&r.ok&&acks.length===1,'restaurar la misma compra: no duplica ni reconfirma');
[s,r]=await call(B,'POST','plan/compra',{token:'token-play-ana-1'}); ok(s===409,'el mismo token no sirve para otra cuenta');
// regalo mejor vigente no se pisa
db.prepare("insert into planes (usuario,plan,hasta,origen,actualizado) values ((select id from usuarios where email='beto@x.com'),'promax',?,'regalo',0)").run(Date.now()+60*864e5);
subs['token-play-beto']=sub('plus_anual',365);
[s,r]=await call(B,'POST','plan/compra',{token:'token-play-beto'}); ok(s===200&&r.comprado==='plus'&&r.plan==='promax'&&(await call(B,'GET','plan'))[1].plan==='promax','compra Plus con regalo Pro Max vigente: se mantiene Pro Max');
// cambio de plan (Play enlaza el token viejo)
subs['token-play-ana-2']=sub('promax_mensual',30,'SUBSCRIPTION_STATE_ACTIVE',{linkedPurchaseToken:'token-play-ana-1'});
[s,r]=await call(A,'POST','plan/compra',{token:'token-play-ana-2'}); ok(r.plan==='promax'&&db.prepare("select estado from compras where token='token-play-ana-1'").get().estado==='REEMPLAZADA','subir a Pro Max: la compra anterior queda reemplazada');
// renovacion: vence en la base, Google dice que renovo
db.prepare("update planes set hasta=? where usuario=(select id from usuarios where email='ana@x.com')").run(Date.now()-1000);
db.prepare("update compras set hasta=?, actualizado=0 where token='token-play-ana-2'").run(Date.now()-1000);
subs['token-play-ana-2']=sub('promax_mensual',31,'SUBSCRIPTION_STATE_ACTIVE',{acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'});
[s,r]=await call(A,'GET','plan'); ok(r.plan==='promax'&&r.hasta>Date.now()+29*864e5,'al vencer pregunta a Google y se renueva solo');
// cancelada: vale hasta el vencimiento; vencida: vuelve a Gratis
db.prepare("update planes set hasta=? where usuario=(select id from usuarios where email='ana@x.com')").run(Date.now()-1000);
db.prepare("update compras set hasta=?, actualizado=0 where token='token-play-ana-2'").run(Date.now()-1000);
subs['token-play-ana-2']=sub('promax_mensual',-1,'SUBSCRIPTION_STATE_EXPIRED');
[s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis','suscripción vencida (no renovó): vuelve a Gratis');
[s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis'&&db.prepare("select estado from compras where token='token-play-ana-2'").get().estado==='SUBSCRIPTION_STATE_EXPIRED','no vuelve a preguntar a Google por una vencida');
subs['token-play-pend']=sub('pro_mensual',30,'SUBSCRIPTION_STATE_PENDING');
[s,r]=await call(L,'POST','plan/compra',{token:'token-play-pend'}); ok(s===200&&r.pendiente&&!acks.includes('token-play-pend'),'pago pendiente: no activa ni confirma');
[s,r]=await call(B,'DELETE','cuenta'); ok(s===200&&db.prepare("select count(*) n from compras where token='token-play-beto'").get().n===0,'borrar la cuenta libera la compra para otra cuenta');
subs['token-play-beto'].acknowledgementState='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
[s,r]=await call(L,'POST','plan/compra',{token:'token-play-beto'}); ok(s===200&&r.plan==='plus','… y otra cuenta puede restaurarla');
const sinCfg={...env}; delete sinCfg.PLAY_CUENTA_SERVICIO;
r=await W.fetch(new Request('https://x.dev/api/plan/compra',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+A},body:JSON.stringify({token:'token-play-otro-999'})}),sinCfg);
ok(r.status===503,'sin la cuenta de servicio configurada: aviso claro (503)');
