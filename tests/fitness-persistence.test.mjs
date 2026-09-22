import test from 'node:test';
import assert from 'node:assert/strict';
import { FitnessSync } from '../src/lib/fitness/sync.ts';
import { emptyFitness, startWorkout } from '../src/lib/fitness/model.ts';
import { mergeLegacy } from '../src/lib/fitness/legacy.ts';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const initial=()=>({data:emptyFitness(),revision:0});
const weight=(id='w')=>({id,date:'2026-09-21',weight:56.2,note:'QA'});
test('optimistic UI is immediate but save success waits for server acknowledgement',async()=>{
 const gate=deferred();let state;const sync=new FitnessSync({save:()=>gate.promise},initial(),s=>state=s);
 let done=false;const save=sync.update(d=>({...d,weights:[weight()]})).then(ok=>{done=true;return ok});
 assert.equal(state.data.weights.length,1);assert.equal(state.pending,1);await Promise.resolve();assert.equal(done,false);
 gate.resolve({data:state.data,revision:1});assert.equal(await save,true);assert.equal(state.pending,0);
});
test('failed write rolls back and rejects every queued dependent update',async()=>{
 const gate=deferred();let state,calls=0;const sync=new FitnessSync({save:()=>{calls++;return gate.promise}},initial(),s=>state=s);
 const one=sync.update(d=>({...d,weights:[weight()]}));const two=sync.update(d=>({...d,goal:{...d.goal,targetWeight:65}}));
 gate.reject(new Error('network unavailable'));assert.deepEqual(await Promise.all([one,two]),[false,false]);
 assert.equal(calls,1);assert.equal(state.data.weights.length,0);assert.equal(state.ready,false);assert.match(state.error,/network/);
 assert.equal(await sync.update(d=>d),false);
});
test('queued writes use acknowledged revisions in order without dropping fast set edits',async()=>{
 const gates=[deferred(),deferred()];const calls=[];let state;
 const sync=new FitnessSync({save:(data,revision)=>{calls.push({data,revision});return gates[calls.length-1].promise}},initial(),s=>state=s);
 const first=sync.update(d=>({...d,draft:startWorkout(d.templates[0])}));
 const second=sync.update(d=>({...d,draft:{...d.draft,name:'Edited draft'}}));
 gates[0].resolve({...calls[0],revision:1});await first;assert.equal(calls[1].revision,1);assert.equal(state.data.draft.name,'Edited draft');
 gates[1].resolve({...calls[1],revision:2});assert.equal(await second,true);assert.equal(state.pending,0);
});
test('account unmount cancels queued writes and ignores late responses',async()=>{
 const gate=deferred();let events=0,calls=0;const sync=new FitnessSync({save:()=>{calls++;return gate.promise}},initial(),()=>events++);
 const a=sync.update(d=>({...d,weights:[weight()]}));const b=sync.update(d=>({...d,goal:{...d.goal,targetWeight:70}}));
 sync.stop();assert.deepEqual(await Promise.all([a,b]),[false,false]);const before=events;gate.resolve(initial());await Promise.resolve();
 assert.equal(events,before);assert.equal(calls,1);assert.equal(await sync.update(d=>d),false);
});
test('revision conflict does not silently overwrite newer remote data',async()=>{
 let state;const sync=new FitnessSync({save:async()=>{throw new Error('revision conflict')}},initial(),s=>state=s);
 assert.equal(await sync.update(d=>({...d,weights:[weight()]})),false);assert.match(state.error,/revision conflict/);assert.equal(state.ready,false);
});
test('fresh repository load restores complete persisted workout snapshots and custom templates',async()=>{
 let database=initial();const repo={load:async()=>structuredClone(database),save:async(data,revision)=>{assert.equal(revision,database.revision);database={data:structuredClone(data),revision:revision+1};return structuredClone(database)}};
 const sync=new FitnessSync(repo,await repo.load(),()=>{});
 await sync.update(d=>{d.weights=[weight()];d.templates[0].name='My template';d.exerciseLibrary.push({id:'custom',name:'Custom',minReps:8,maxReps:12,restSeconds:90,notes:''});const s=startWorkout(d.templates[0]);s.exercises[0].sets[0]={...s.exercises[0].sets[0],weight:40,reps:8,completed:true};s.finishedAt=Date.now();d.sessions=[s];return d});
 const restored=await repo.load();assert.equal(restored.data.weights.length,1);assert.equal(restored.data.templates[0].name,'My template');assert.equal(restored.data.exerciseLibrary.at(-1).id,'custom');assert.equal(restored.data.sessions[0].exercises[0].sets[0].completed,true);
});
test('legacy import preserves cloud collisions, restores edited defaults and is idempotent',()=>{
 const cloud=emptyFitness(),local=emptyFitness();cloud.weights=[weight('cloud')];local.weights=[{...weight('local'),weight:60}];local.templates[0].name='Old edited legs';local.sessions=[{...startWorkout(local.templates[0]),finishedAt:Date.now()}];
 const merged=mergeLegacy(cloud,local);assert.equal(merged.weights.length,1);assert.equal(merged.weights[0].weight,56.2);assert.equal(merged.templates[0].name,'Old edited legs');assert.equal(merged.sessions.length,1);assert.deepEqual(mergeLegacy(merged,local),merged);
});

