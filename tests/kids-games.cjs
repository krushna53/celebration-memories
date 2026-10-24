/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, Date, Error, Number, Set, Math, require: name => mocks[name] ?? (name.startsWith('@/') || name === 'server-only' ? {} : require(name)) });
  return exports;
}
test('kids game settings accept defaults and reject invalid limits', () => {
  const schemas = load('types/games.ts');
  assert.equal(schemas.createBubblePopFormSchema.parse({title:'Party',target:'6',seconds:'45'}).target, 6);
  for (const target of [0,10,1.5]) assert.equal(schemas.createBubblePopFormSchema.safeParse({title:'Party',target,seconds:45}).success,false);
  assert.equal(schemas.createAnimalSoundsFormSchema.safeParse({title:'Party',rounds:8}).success,true);
  assert.equal(schemas.createAnimalSoundsFormSchema.safeParse({title:'Party',rounds:99}).success,false);
  assert.equal(schemas.createMemoryMatchFormSchema.safeParse({title:'Party',pairs:2}).success,false);
});
test('public scoreboard restricts fields, game and completed results with correct ordering', async () => {
  for (const type of ['bubble_pop','animal_sounds','memory_match']) {
    const calls=[];
    const query={};
    for (const method of ['select','eq','not','order']) query[method]=(...args)=>{calls.push([method,...args]);return query;};
    query.limit=async count=>{assert.equal(count,10);return {data:[{player_name:'A',score:5,duration_seconds:30,player_phone:'private'}],error:null};};
    const service=load('services/games.ts',{'@/lib/supabase/admin':{supabaseAdmin:()=>({from:()=>query})}});
    const rows=await service.getSoloLeaderboard({id:'game-1',type});
    assert.equal(JSON.stringify(rows),JSON.stringify([{name:'A',score:5,seconds:30}]));
    assert.deepEqual(calls[0],['select','player_name,score,duration_seconds']);
    assert.deepEqual(calls[1],['eq','game_id','game-1']);
    assert.deepEqual(calls[2],['not','completed_at','is',null]);
    const orders=calls.filter(c=>c[0]==='order');
    assert.equal(orders[0][1],type==='memory_match'?'duration_seconds':'score');
    assert.equal(orders[0][2].ascending,type==='memory_match');
  }
});
test('scoreboard action rejects inactive links without querying results', async () => {
  const actions=load('features/games/actions.ts',{'@/services/games':{getGameByShareToken:async()=>null,getSoloLeaderboard:()=>{throw Error('must not run');}}});
  assert.equal((await actions.getSoloLeaderboardAction('inactive')).success,false);
});
