const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const E=require('../core.js');
const root=path.resolve(__dirname,'..');
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI wait timed out');}
async function boot(factory=new IDBFactory()){
  const errors=[],downloads=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost:4173/ebike-range-lab/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;Object.defineProperty(w,'indexedDB',{value:factory});w.structuredClone=structuredClone;w.Blob=Blob;
  w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'public-report.json'),'utf8'))});
  w.confirm=()=>true;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.print=()=>{w.printCalled=true;};
  w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:test';};w.URL.revokeObjectURL=()=>{};
  w.document.addEventListener('click',e=>{if(e.target.closest('a[download]'))e.preventDefault();});
  for(const file of ['content.js','core.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  await until(()=>w.document.querySelector('.hero'));
  const q=s=>w.document.querySelector(s);
  const click=s=>{assert.ok(q(s),`Missing ${s}`);q(s).click();};
  const input=(s,value)=>{assert.ok(q(s),`Missing ${s}`);q(s).value=value;q(s).dispatchEvent(new w.Event('input',{bubbles:true}));};
  const route=async hash=>{w.location.hash=hash;await until(()=>q('#page-label').textContent===({'home':'프로젝트 홈','guide':'따라 만드는 가이드','lab':'거리 추정 실험실','journal':'나의 탐구 기록','report':'결과보고서','sources':'자료와 출처','storage':'백업 · 공개 방법'}[hash.split('/')[0]]));await new Promise(r=>setTimeout(r,10));};
  const submit=s=>q(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  const saved=async()=>until(()=>q('#save-state').textContent==='이 기기에 저장됨');
  const restore=async data=>{Object.defineProperty(q('#restore-input'),'files',{value:[{size:100,text:async()=>JSON.stringify(data)}],configurable:true});q('#restore-input').dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>q('#toast').textContent.includes('복원'));};
  return {dom,w,q,click,input,route,submit,saved,restore,downloads,errors,factory};
}
test('모든 화면과 8개 가이드, 기본 빈 상태 및 접근성 라벨 렌더링',async()=>{
  const ui=await boot();try{
    assert.match(ui.q('.hero').textContent,/제작 전/);
    for(const page of ['guide','lab','journal','report','sources','storage','home']){await ui.route(page);assert.ok(ui.q('h1'));}
    for(let i=0;i<8;i++){await ui.route('guide/'+i);assert.match(ui.q('.guide-detail').textContent,/성공 확인/);assert.ok(ui.q('#step-check'));}
    await ui.route('report');assert.match(ui.q('#report-paper').textContent,/아직 활동 기록이 없습니다/);
    assert.equal(ui.errors.length,0,ui.errors.join('\n'));
  }finally{ui.dom.window.close();}
});
test('가상 모드 26km, 잔량 경계, 실측 자료 없으면 계산 보류',async()=>{
  const ui=await boot();try{await ui.route('lab');assert.equal(ui.q('#lcd-range').textContent,'26.0');ui.input('#soc-number','0');assert.equal(ui.q('#lcd-range').textContent,'0.0');ui.input('#soc-number','101');assert.equal(ui.q('#lcd-range').textContent,'—');ui.click('[data-mode="actual"]');assert.equal(ui.q('#lcd-range').textContent,'—');assert.match(ui.q('#formula-output').textContent,/계산 대기/);assert.equal(ui.q('#ride-table').querySelectorAll('tbody tr').length,0);}finally{ui.dom.window.close();}
});
test('활동 입력·수정·재접속, HTML은 실행하지 않고 텍스트 표시',async()=>{
  let ui=await boot();const factory=ui.factory;try{await ui.route('journal');ui.input('[name=title]','<img src=x onerror=alert(1)>');ui.input('[name=body]','제작 준비를 기록했습니다.');ui.submit('#note-form');await ui.saved();assert.equal(ui.q('.record h3').textContent,'<img src=x onerror=alert(1)>');assert.equal(ui.q('.record h3 img'),null);ui.click('[data-edit-note]');ui.input('[name=title]','수정한 탐구 기록');ui.submit('#note-form');await ui.saved();ui.dom.window.close();ui=await boot(factory);await ui.route('journal');assert.equal(ui.q('.record h3').textContent,'수정한 탐구 기록');await ui.route('report');assert.match(ui.q('#report-paper').textContent,/아직 활동 기록이 없습니다/);ui.click('[data-report-mode=draft]');await until(()=>ui.q('#report-paper').textContent.includes('수정한 탐구 기록'));assert.equal(ui.errors.length,0);}finally{ui.dom.window.close();}
});
test('실측 저장·보정·검증, 기존 검증 계수 고정과 기록 편집',async()=>{
  const ui=await boot();try{await ui.route('lab');
    function add(purpose,start,end,distance){ui.input('[name=purpose]',purpose);ui.input('[name=start]',start);ui.input('[name=end]',end);ui.input('[name=distance]',distance);ui.input('[name=condition]','평지');ui.submit('#ride-form');}
    add('validation','90','80','4');assert.match(ui.q('#ride-error').textContent,/보정 기록/);
    add('calibration','90','80','4');await ui.saved();ui.click('[data-mode=actual]');assert.equal(ui.q('#lcd-range').textContent,'26.0');
    add('validation','80','70','5');await ui.saved();assert.match(ui.q('#main').textContent,/절대 상대 오차 20.0%/);
    ui.click('[data-edit-ride]');ui.input('[name=distance]','8');ui.submit('#ride-form');await ui.saved();assert.equal(ui.q('#lcd-range').textContent,'52.0');assert.match(ui.q('#main').textContent,/절대 상대 오차 20.0%/);
    ui.click('[data-action=csv]');assert.match(await ui.downloads.at(-1).text(),/평지/);assert.equal(ui.errors.length,0);
  }finally{ui.dom.window.close();}
});
test('사진 포함 복원·내보내기 round trip, 손상 파일은 기존 기록 보존',async()=>{
  const ui=await boot();try{const data=E.blank();data.notes=[{id:'photo-note',date:'2026-11-16',step:0,title:'사진 기록',body:'보드 참고',learning:'',next:'',photos:[{name:'arduino.jpg',caption:'참고 보드',data:'data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/arduino-uno.jpg')).toString('base64')}]}];await ui.route('storage');await ui.restore(data);await ui.saved();await ui.route('journal');assert.equal(ui.q('.record img').alt,'참고 보드');await ui.route('storage');ui.click('[data-action=backup]');await until(()=>ui.downloads.length>=2);const exported=E.normalize(JSON.parse(await ui.downloads.at(-1).text()));assert.equal(exported.notes[0].photos[0].data,data.notes[0].photos[0].data);
    ui.q('#toast').textContent='';await ui.restore({schema:999});assert.match(ui.q('#toast').textContent,/복원하지 않았습니다/);await ui.route('journal');assert.equal(ui.q('.record h3').textContent,'사진 기록');
    await ui.route('storage');const count=ui.downloads.length;ui.click('[data-action=export-public]');await until(()=>ui.downloads.length>count);assert.equal(JSON.parse(await ui.downloads.at(-1).text()).kind,'ebike-public');
  }finally{ui.dom.window.close();}
});
test('보고서 자동 저장·인쇄 텍스트·가이드 완료 표시 유지',async()=>{
  let ui=await boot();const factory=ui.factory;try{await ui.route('guide');ui.click('#step-check');await ui.saved();await ui.route('report');ui.click('[data-report-mode=draft]');await until(()=>ui.q('[data-action=edit-report]'));ui.click('[data-action=edit-report]');await until(()=>ui.q('[data-report-field=motivation]'));ui.input('[data-report-field=motivation]','배터리 잔량의 의미가 궁금했습니다.');ui.input('[data-report-meta=title]','우리 동아리 탐구');await ui.saved();assert.equal(ui.q('[data-print-field=motivation]').textContent,'배터리 잔량의 의미가 궁금했습니다.');ui.click('[data-action=print]');await until(()=>ui.w.printCalled);ui.dom.window.close();ui=await boot(factory);await ui.route('guide');assert.ok(ui.q('#step-check').checked);await ui.route('report');ui.click('[data-report-mode=draft]');await until(()=>ui.q('#report-title-text').textContent==='우리 동아리 탐구');assert.match(ui.q('#report-paper').textContent,/배터리 잔량의 의미/);}finally{ui.dom.window.close();}
});
