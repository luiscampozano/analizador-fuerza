import json,itertools,random
T=json.load(open('exp/tabla_app.json'))
def regla(r,acm,cvm,tol,cvz):
    a=r['actual']; c=r['c']
    if r['alterno'] or not c or c['n']==a or c['n']<1: return a
    cv=c['cv'] if c['cv'] is not None else 0.5
    if cvz is not None and c['n']==c['zig'] and cv<cvz: return c['n']
    if c['ac']>acm and c['nT'] is not None and abs(c['nT']+1-c['n'])<=tol and (c['cv'] if c['cv'] is not None else 1)<cvm: return c['n']
    return a
GRID=list(itertools.product([0.2,0.25,0.3,0.35,0.4,0.5,9],[0.2,0.3,0.35,0.45,0.6],[0.5,1.0,1.5,2.0],[None,0.25,0.35,0.45,0.55]))
tot=[]
for semilla in range(40):
    random.seed(semilla); idx=list(range(len(T))); random.shuffle(idx); ok=0
    for k in range(5):
        prueba=set(idx[k::5]); ent=[T[i] for i in idx if i not in prueba]
        best=max(GRID,key=lambda g:(sum(regla(r,*g)==r['real'] for r in ent), -(g[3] or 0)))
        ok+=sum(regla(T[i],*best)==T[i]['real'] for i in prueba)
    tot.append(ok)
print('base',sum(r['actual']==r['real'] for r in T),'CV media',round(sum(tot)/len(tot),2),'min',min(tot),'max',max(tot))
sc=sorted(GRID,key=lambda g:-sum(regla(r,*g)==r['real'] for r in T))[:8]
for g in sc: print(g,sum(regla(r,*g)==r['real'] for r in T),'err',sum(abs(regla(r,*g)-r['real']) for r in T))
print('actual err',sum(abs(r['actual']-r['real']) for r in T))
