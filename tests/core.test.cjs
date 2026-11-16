const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('../core.js');
const ride = (changes={}) => ({id:'r1',date:'2026-11-16',condition:'평지',purpose:'calibration',start:90,end:80,distance:4,detail:'',rateAtTest:null,...changes});
test('보정은 단순 계수 평균이 아닌 총 거리 / 총 잔량 감소량',()=>{
  const result=E.calibration([ride(),ride({id:'r2',start:80,end:60,distance:12}),ride({id:'r3',condition:'언덕',distance:100})],'평지');
  assert.equal(result.rate,16/30);assert.equal(result.count,2);assert.equal(result.drop,30);
});
test('잔량 무변화·증가와 검증 자료는 계수에서 제외',()=>{
  const result=E.calibration([ride(),ride({id:'r2',end:90}),ride({id:'r3',end:95}),ride({id:'r4',purpose:'validation',rateAtTest:1})],'평지');
  assert.equal(result.rate,.4);assert.equal(result.excluded,2);assert.equal(result.count,1);
});
test('잔량 0·100 경계와 자료 없는 상태',()=>{
  assert.equal(E.estimate(0,.4),0);assert.equal(E.estimate(100,.4),40);assert.equal(E.estimate(65,.4),26);
  for(const v of [NaN,-1,101,Infinity,'50'])assert.equal(E.estimate(v,.4),null);
  assert.equal(E.estimate(50,null),null);assert.equal(E.calibration([],'평지').rate,null);
});
test('기록 검증은 잘못된 입력과 보정계수 없는 검증을 거부',()=>{
  for(const change of [{distance:-2},{start:101},{end:NaN},{condition:' '},{purpose:'unknown'},{purpose:'validation'}])assert.ok(E.rideProblem(ride(change)));
  assert.equal(E.rideProblem(ride()),'');
});
test('검증 오차는 기록 당시 고정 계수 사용',()=>{
  const r=ride({purpose:'validation',rateAtTest:.5});const v=E.validation(r);
  assert.equal(v.predicted,5);assert.equal(v.absolute,1);assert.equal(v.percent,25);
  E.calibration([ride({distance:20})],'평지');assert.deepEqual(E.validation(r),v);
  assert.equal(E.validation(ride({purpose:'validation',rateAtTest:.5,end:90})),null);
});
test('사진·보고서·검증계수 포함 백업 round trip',()=>{
  const data=E.blank();data.notes=[{id:'n1',date:'2026-11-16',step:1,title:'라벨 확인',body:'실제 기록',learning:'단위',next:'실험',photos:[{name:'test.jpg',caption:'참고',data:'data:image/jpeg;base64,AA=='}]}];data.rides=[ride({purpose:'validation',rateAtTest:.5})];data.report.results='아직 검증 중';
  assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(data))),data);
});
test('잘못된 백업·실행 가능한 이미지·중복 ID 거부',()=>{
  assert.throws(()=>E.normalize({schema:999}));
  const d=E.blank();d.rides=[ride(),ride()];assert.throws(()=>E.normalize(d));
  d.rides=[];d.notes=[{id:'n1',date:'',step:0,title:'',body:'',learning:'',next:'',photos:[{name:'x',caption:'',data:'data:image/svg+xml;base64,AA=='}]}];assert.throws(()=>E.normalize(d));
});
test('CSV 한글 BOM·따옴표 처리·수식 주입 방지',()=>{
  const csv=E.csv([ride({detail:'=SUM(1,2)',condition:'a"b'})]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('a""b'));assert.ok(csv.includes("'=SUM(1,2)"));
});
test('초기 공개 보고서는 실험·활동·완료 표시가 없는 상태',()=>{
  const d=E.normalize(JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../public-report.json'),'utf8')));
  assert.equal(d.kind,'ebike-public');assert.equal(d.rides.length,0);assert.equal(d.notes.length,0);assert.equal(d.checks.length,0);assert.ok(Object.values(d.report).every(v=>v===''));
});
