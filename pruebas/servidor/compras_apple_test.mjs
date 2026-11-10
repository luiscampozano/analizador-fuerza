// Cobro con Apple (v2.49.0): JWT ES256 para la App Store Server API, produccion → sandbox, validaciones de la compra,
// appAccountToken de la cuenta, una compra por cuenta, renovacion al vencer, borrar la cuenta y sin secretos (503)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import { webcrypto as C } from 'node:crypto';
const MOD=await import(new URL('../../_worker.js', import.meta.url).href+'?'+Date.now()); const W=MOD.default;
const db=new DatabaseSync(':memory:'); db.exec(fs.readFileSync(new URL('../../sql/esquema.sql', import.meta.url),'utf8'));
class St{constructor(sql){this.sql=sql.replace(/\?(\d+)/g,'?');this.ord=[...sql.matchAll(/\?(\d+)/g)].map(m=>+m[1]);this.a=[];}bind(...a){this.a=a;return this;}args(){return this.ord.map(i=>this.a[i-1]);}
 all(){const s=db.prepare(this.sql);return{results:/^\s*SELECT/is.test(this.sql)?s.all(...this.args()):(s.run(...this.args()),[])};}async first(){return this.all().results[0]||null;}async run(){return this.all();}}
const DB={prepare:s=>new St(s),batch:async l=>{db.exec('BEGIN');try{const r=l.map(x=>x.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const kp=await C.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await C.subtle.exportKey('pkcs8',kp.privateKey)).toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----\n';
const env={DB,GOOGLE_CLIENT_ID:'cid',ADMIN_EMAILS:'luis@x.com',APPLE_IAP_CLAVE:pem,APPLE_IAP_KEY_ID:'KID123',APPLE_ISSUER_ID:'iss-uuid'};
const call=async(tok,m,p,body,e=env)=>{const r=await W.fetch(new Request('https://x.dev/api/'+p,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}),e);return [r.status,await r.json()];};
const ok=(c,m)=>{console.log(c?'OK  ':'FAIL',m); if(!c) process.exitCode=1;};
const b64=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jws=(o)=>b64({alg:'ES256',x5c:['x']})+'.'+b64(o)+'.firma'; // la firma de Apple no se revisa (llega por TLS de Apple)
// Apple simulado: transacciones y suscripciones por entorno
const PROD='https://api.storekit.itunes.apple.com', SAND='https://api.storekit-sandbox.itunes.apple.com';
const tx={[PROD]:{},[SAND]:{}}, subs={[PROD]:{},[SAND]:{}}; let jwtOk=false, pedidos=[], prod401=false;
globalThis.fetch=async(url,o={})=>{url=String(url); const base=url.startsWith(PROD)?PROD:url.startsWith(SAND)?SAND:null; if(!base) return new Response('{}',{status:500});
  const a=String(o.headers?.authorization||'').replace('Bearer ','').split('.');
  const cab=JSON.parse(Buffer.from(a[0],'base64url')), pl=JSON.parse(Buffer.from(a[1],'base64url'));
  const firma=await C.subtle.verify({name:'ECDSA',hash:'SHA-256'},kp.publicKey,Buffer.from(a[2],'base64url'),new TextEncoder().encode(a[0]+'.'+a[1]));
  jwtOk=firma&&cab.alg==='ES256'&&cab.kid==='KID123'&&cab.typ==='JWT'&&pl.iss==='iss-uuid'&&pl.aud==='appstoreconnect-v1'&&pl.bid==='com.fuerzapro.app'&&pl.exp-pl.iat<=3600;
  if(!jwtOk) return new Response('{}',{status:401});
  if(base===PROD&&prod401) return new Response('{}',{status:401}); // app sin versión publicada: Apple cierra producción
  pedidos.push(url.slice(base.length)+(base===SAND?' (sandbox)':''));
  let m=url.match(/\/inApps\/v1\/transactions\/(\d+)$/); if(m){const t=tx[base][m[1]]; return t?new Response(JSON.stringify({signedTransactionInfo:jws(t)})):new Response(JSON.stringify({errorCode:4040010,errorMessage:'Transaction id not found.'}),{status:404});}
  m=url.match(/\/inApps\/v1\/subscriptions\/(\d+)$/); if(m){const s=subs[base][m[1]]; return s?new Response(JSON.stringify({environment:base===SAND?'Sandbox':'Production',bundleId:'com.fuerzapro.app',data:[{subscriptionGroupIdentifier:'g1',lastTransactions:[s]}]})):new Response(JSON.stringify({errorCode:4040005}),{status:404});}
  return new Response('{}',{status:500});};
const T=(id,orig,prod,dias,extra={})=>({transactionId:id,originalTransactionId:orig,bundleId:'com.fuerzapro.app',productId:prod,purchaseDate:Date.now()-864e5,expiresDate:Date.now()+dias*864e5,type:'Auto-Renewable Subscription',...extra});
const ponerSub=(base,t,status=1,ren={autoRenewStatus:1})=>{subs[base][t.originalTransactionId]={originalTransactionId:t.originalTransactionId,status,signedTransactionInfo:jws(t),signedRenewalInfo:jws(ren)};};
const reg=async(e,n)=>(await call(null,'POST','auth/correo',{modo:'registro',email:e,clave:'fuerza2026',nombre:n}))[1];
const RA=await reg('ana@x.com','Ana'), RB=await reg('beto@x.com','Beto'), RL=await reg('luis@x.com','Luis');
const A=RA.token, B=RB.token, L=RL.token, cuentaA=await MOD.cuentaApple(RA.usuario.id), cuentaB=await MOD.cuentaApple(RB.usuario.id);
db.prepare("update ajustes_app set valor='activo' where clave='limites'").run();
// appAccountToken: UUID fijo por cuenta (igual que en js/plan.js)
ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cuentaA)&&cuentaA===await MOD.cuentaApple(RA.usuario.id)&&cuentaA!==cuentaB,'appAccountToken: UUID v4 fijo y distinto por cuenta');
{ const h=new Uint8Array(await C.subtle.digest('SHA-256',new TextEncoder().encode('fuerzapro:'+RA.usuario.id))).slice(0,16); h[6]=(h[6]&15)|64; h[8]=(h[8]&63)|128;
  const x=Buffer.from(h).toString('hex'); ok(cuentaA===`${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`,'appAccountToken: misma receta que el cliente'); }
let [s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'abc'}); ok(s===400,'transactionId que no es número: rechazado');
[s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'999999'}); ok(s===400&&/no reconoce/.test(r.error)&&pedidos.some(p=>p.includes('(sandbox)')),'transacción que Apple no conoce (ni en sandbox): rechazada');
// compra valida en produccion
let t1=T('2000000001','2000000001','pro_mensual',7,{appAccountToken:cuentaA}); tx[PROD][t1.transactionId]=t1; ponerSub(PROD,t1);
pedidos=[]; [s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'2000000001'});
ok(s===200&&r.ok&&r.comprado==='pro'&&r.plan==='pro'&&r.aplica&&r.limites.video.lim===40,'compra Pro mensual en producción: plan Pro activo');
ok(jwtOk,'el JWT ES256 para Apple está bien firmado (kid, iss, aud, bid, exp ≤ 60 min)');
ok(!pedidos.some(p=>p.includes('(sandbox)')),'compra de producción: no consulta sandbox');
let fila=db.prepare("select * from compras where token='apple:2000000001'").get();
ok(fila&&fila.usuario===RA.usuario.id&&fila.estado==='APPLE_ACTIVA'&&fila.renueva===1&&fila.producto==='pro_mensual'&&Math.abs(fila.hasta-t1.expiresDate)<5,'se guarda «apple:»+originalTransactionId con estado, vencimiento y renovación');
ok(db.prepare("select origen from planes where usuario=?").get(RA.usuario.id).origen==='apple','el plan queda con origen «apple»');
[s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'2000000001'}); ok(s===200&&r.ok&&db.prepare("select count(*) n from compras").get().n===1,'restaurar la misma compra: no duplica');
// TestFlight: la compra solo existe en sandbox
let t2=T('3000000001','3000000001','plus_anual',365,{appAccountToken:cuentaB,environment:'Sandbox'}); tx[SAND][t2.transactionId]=t2; ponerSub(SAND,t2);
pedidos=[]; [s,r]=await call(B,'POST','plan/compra-apple',{transactionId:'3000000001'});
ok(s===200&&r.ok&&r.plan==='plus'&&pedidos[0]==='/inApps/v1/transactions/3000000001'&&pedidos.includes('/inApps/v1/transactions/3000000001 (sandbox)')&&pedidos.includes('/inApps/v1/subscriptions/3000000001 (sandbox)'),'compra de TestFlight: si producción no la conoce (4040010) se busca en sandbox');
// validaciones
tx[PROD]['4000000001']=T('4000000001','4000000001','pro_mensual',30,{bundleId:'com.otra.app'});
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000001'}); ok(s===400&&/otra aplicación/.test(r.error),'compra de otra app (bundleId): rechazada');
tx[PROD]['4000000002']=T('4000000002','4000000002','monedas_100',30);
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000002'}); ok(s===400&&/no es un plan/.test(r.error),'producto que no es un plan: rechazado');
let t3=T('4000000003','4000000003','plus_mensual',-2); tx[PROD][t3.transactionId]=t3; ponerSub(PROD,t3,2,{autoRenewStatus:0});
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000003'}); ok(s===400&&/venció/.test(r.error)&&!db.prepare("select 1 from compras where token='apple:4000000003'").get(),'suscripción vencida: rechazada');
tx[PROD]['4000000004']=T('4000000004','4000000004','pro_anual',300,{revocationDate:Date.now()-1000,revocationReason:0});
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000004'}); ok(s===400&&/reembolsó/.test(r.error),'compra reembolsada (revocationDate): rechazada');
let t5=T('4000000005','4000000005','promax_mensual',30,{appAccountToken:cuentaA}); tx[PROD][t5.transactionId]=t5; ponerSub(PROD,t5);
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000005'}); ok(s===409&&/otra cuenta/.test(r.error)&&(await call(L,'GET','plan'))[1].plan==='gratis','appAccountToken de otra cuenta: rechazada (409)');
let t6=T('4000000006','4000000006','plus_mensual',30); tx[PROD][t6.transactionId]=t6; ponerSub(PROD,t6); // sin appAccountToken
[s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'4000000006'}); ok(s===200,'compra sin appAccountToken: la toma la primera cuenta');
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'4000000006'}); ok(s===409&&/ya está asociada/.test(r.error),'la misma suscripción (originalTransactionId) no sirve para otra cuenta (409)');
// regalo mejor vigente no se pisa
db.prepare("insert into planes (usuario,plan,hasta,origen,actualizado) values (?,'promax',?,'regalo',0) on conflict(usuario) do update set plan='promax',hasta=excluded.hasta,origen='regalo'").run(RL.usuario.id,Date.now()+60*864e5);
let t7=T('5000000001','5000000001','plus_mensual',30); tx[PROD][t7.transactionId]=t7; ponerSub(PROD,t7);
[s,r]=await call(L,'POST','plan/compra-apple',{transactionId:'5000000001'}); ok(s===200&&r.comprado==='plus'&&r.plan==='promax','compra Plus con regalo Pro Max vigente: se mantiene Pro Max');
// renovacion: vence en la base, Apple dice que renovo (nueva transaccion, mismo originalTransactionId, cambio a Pro Max)
db.prepare("update planes set plan='pro', hasta=?, origen='apple' where usuario=?").run(Date.now()-1000,RA.usuario.id);
db.prepare("update compras set hasta=?, actualizado=0 where usuario=?").run(Date.now()-1000,RA.usuario.id);
ponerSub(PROD,T('2000000099','2000000001','promax_mensual',31,{appAccountToken:cuentaA}));
pedidos=[]; [s,r]=await call(A,'GET','plan'); ok(r.plan==='promax'&&r.hasta>Date.now()+29*864e5&&pedidos.includes('/inApps/v1/subscriptions/2000000001'),'al vencer pregunta a Apple y se renueva solo (con el cambio de plan)');
// periodo de gracia: sigue con acceso hasta gracePeriodExpiresDate
db.prepare("update planes set hasta=? where usuario=?").run(Date.now()-1000,RA.usuario.id);
db.prepare("update compras set hasta=?, actualizado=0 where token='apple:2000000001'").run(Date.now()-1000);
db.prepare("update compras set estado='APPLE_VENCIDA' where token='apple:4000000006'").run();
ponerSub(PROD,T('2000000099','2000000001','promax_mensual',-1,{appAccountToken:cuentaA}),4,{autoRenewStatus:1,gracePeriodExpiresDate:Date.now()+6*864e5});
[s,r]=await call(A,'GET','plan'); ok(r.plan==='promax'&&r.hasta>Date.now()+5*864e5&&db.prepare("select estado from compras where token='apple:2000000001'").get().estado==='APPLE_GRACIA','periodo de gracia de Apple: mantiene el plan');
// vencida: vuelve a Gratis y no vuelve a preguntar
db.prepare("update planes set hasta=? where usuario=?").run(Date.now()-1000,RA.usuario.id);
db.prepare("update compras set hasta=?, actualizado=0 where token='apple:2000000001'").run(Date.now()-1000);
ponerSub(PROD,T('2000000099','2000000001','promax_mensual',-1,{appAccountToken:cuentaA}),2,{autoRenewStatus:0});
[s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis'&&db.prepare("select estado from compras where token='apple:2000000001'").get().estado==='APPLE_VENCIDA','suscripción vencida (no renovó): vuelve a Gratis');
pedidos=[]; [s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis'&&!pedidos.length,'no vuelve a preguntar a Apple por una vencida');
// reembolso en la renovacion: queda revocada
db.prepare("update compras set estado='APPLE_ACTIVA', hasta=?, actualizado=0 where token='apple:2000000001'").run(Date.now()-1000);
db.prepare("update planes set hasta=? where usuario=?").run(Date.now()-1000,RA.usuario.id);
ponerSub(PROD,T('2000000099','2000000001','promax_mensual',20,{appAccountToken:cuentaA,revocationDate:Date.now()-500}),5);
[s,r]=await call(A,'GET','plan'); ok(r.plan==='gratis'&&db.prepare("select estado from compras where token='apple:2000000001'").get().estado==='APPLE_REVOCADA','reembolso detectado al renovar: sin plan');
// borrar la cuenta
[s,r]=await call(B,'DELETE','cuenta'); ok(s===200&&db.prepare("select count(*) n from compras where token='apple:3000000001'").get().n===0,'borrar la cuenta borra sus compras de Apple');
// moderacion no se rompe con planes de Apple
const ADM='sesion-admin-prueba-123'; db.prepare("insert into usuarios (id,email,nombre,foto,creado,visto,seq) values ('g_admin','admin@x.com','Admin',null,0,0,0)").run();
db.prepare('insert into sesiones (token_hash,usuario,creado,expira) values (?,?,?,?)').run(Buffer.from(await C.subtle.digest('SHA-256',new TextEncoder().encode(ADM))).toString('hex'),'g_admin',Date.now(),Date.now()+864e5);
[s,r]=await call(ADM,'GET','mod/planes',undefined,{...env,ADMIN_EMAILS:'admin@x.com'}); ok(s===200&&r.usuarios.some(x=>x.origen==='apple'||x.usuario===RL.usuario.id),'moderación: lista de planes sigue funcionando');
// sin secretos
for (const k of ['APPLE_IAP_CLAVE','APPLE_IAP_KEY_ID','APPLE_ISSUER_ID']) { const e={...env}; delete e[k];
  [s,r]=await call(A,'POST','plan/compra-apple',{transactionId:'2000000001'},e); ok(s===503&&/Apple/.test(r.error),`sin ${k} configurado: aviso claro (503)`); }
{ const e={...env}; delete e.APPLE_IAP_CLAVE; db.prepare("update planes set plan='pro', hasta=?, origen='apple' where usuario=?").run(Date.now()-1000,RA.usuario.id);
  db.prepare("update compras set estado='APPLE_ACTIVA', hasta=?, actualizado=0 where token='apple:2000000001'").run(Date.now()-1000);
  [s,r]=await call(A,'GET','plan',undefined,e); ok(s===200&&r.plan==='gratis','sin secretos: /api/plan sigue funcionando (sin renovar)'); }

// v2.49.0 antes de la primera versión publicada Apple responde 401 en producción: se sigue con sandbox (App Review/TestFlight)
{ prod401=true; const tq=T('900001','900001','plus_mensual',30,{appAccountToken:cuentaA}); tx[SAND]['900001']=tq; ponerSub(SAND,tq);
  const [s9,r9]=await call(A,'POST','plan/compra-apple',{transactionId:'900001'}); ok(s9===200,'producción da 401 (app sin publicar): se verifica en sandbox');
  prod401=false; }
