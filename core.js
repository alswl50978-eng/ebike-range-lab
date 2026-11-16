(function (root) {
  'use strict';
  const SCHEMA = 1;
  const fields = ['motivation', 'hypothesis', 'principles', 'equipment', 'design', 'results', 'limitations', 'reflection'];
  const blank = () => ({schema: SCHEMA, kind: 'ebike-backup', updatedAt: null, title: '배터리가 이만큼 남았다면, 얼마나 더 갈 수 있을까?', team: '', checks: [], notes: [], rides: [], report: Object.fromEntries(fields.map(k => [k, '']))});
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  function rideProblem(r) {
    if (!r || !finite(r.start) || !finite(r.end) || !finite(r.distance)) return '잔량과 주행 거리를 모두 숫자로 입력하세요.';
    if (r.start < 0 || r.start > 100 || r.end < 0 || r.end > 100) return '잔량은 0~100% 범위여야 합니다.';
    if (r.distance <= 0 || r.distance > 10000) return '주행 거리는 0보다 크고 10,000km 이하여야 합니다.';
    if (!['calibration', 'validation'].includes(r.purpose)) return '기록 용도를 선택하세요.';
    if (!r.condition || !r.condition.trim()) return '같은 조건을 묶을 조건 이름을 입력하세요.';
    if (r.purpose === 'validation' && (!finite(r.rateAtTest) || r.rateAtTest <= 0)) return '검증 전에 같은 조건의 보정 기록이 필요합니다.';
    return '';
  }
  function calibration(rides, condition) {
    const selected = rides.filter(r => r.purpose === 'calibration' && r.condition === condition);
    const valid = selected.filter(r => !rideProblem(r) && r.start > r.end);
    const distance = valid.reduce((n, r) => n + r.distance, 0);
    const drop = valid.reduce((n, r) => n + r.start - r.end, 0);
    return {rate: drop > 0 ? distance / drop : null, count: valid.length, excluded: selected.length - valid.length, distance, drop};
  }
  function estimate(soc, rate) {
    return finite(soc) && soc >= 0 && soc <= 100 && finite(rate) && rate > 0 ? soc * rate : null;
  }
  function validation(r) {
    if (rideProblem(r) || r.purpose !== 'validation' || r.start <= r.end) return null;
    const predicted = (r.start - r.end) * r.rateAtTest;
    return {predicted, error: predicted - r.distance, absolute: Math.abs(predicted - r.distance), percent: Math.abs(predicted - r.distance) / r.distance * 100};
  }
  function cleanText(value, limit = 20000) {
    if (typeof value !== 'string' || value.length > limit) throw Error('텍스트 형식 또는 길이가 올바르지 않습니다.');
    return value;
  }
  function normalize(data) {
    if (!data || data.schema !== SCHEMA || !['ebike-backup', 'ebike-public'].includes(data.kind)) throw Error('이 사이트의 백업 또는 공개 파일이 아닙니다.');
    const out = blank();
    out.kind = data.kind;
    out.title = cleanText(data.title, 200); out.team = cleanText(data.team, 200);
    out.updatedAt = data.updatedAt == null ? null : cleanText(data.updatedAt, 60);
    if (!Array.isArray(data.checks) || data.checks.length > 8 || data.checks.some(x => !Number.isInteger(x) || x < 0 || x > 7)) throw Error('단계 정보가 올바르지 않습니다.');
    out.checks = [...new Set(data.checks)];
    if (!Array.isArray(data.notes) || data.notes.length > 500 || !Array.isArray(data.rides) || data.rides.length > 5000) throw Error('기록 목록이 올바르지 않습니다.');
    out.notes = data.notes.map(n => {
      if (!Number.isInteger(n.step) || n.step < 0 || n.step > 7 || !Array.isArray(n.photos) || n.photos.length > 6) throw Error('활동 기록 형식이 올바르지 않습니다.');
      return {id: cleanText(n.id, 100), date: cleanText(n.date, 20), step: n.step, title: cleanText(n.title, 200), body: cleanText(n.body), learning: cleanText(n.learning), next: cleanText(n.next), photos: n.photos.map(p => {
        if (typeof p.data !== 'string' || p.data.length > 3000000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data)) throw Error('사진 형식이 올바르지 않습니다.');
        return {name: cleanText(p.name, 200), caption: cleanText(p.caption, 500), data: p.data};
      })};
    });
    out.rides = data.rides.map(r => {
      const item = {id: cleanText(r.id, 100), date: cleanText(r.date, 20), condition: cleanText(r.condition, 200), purpose: r.purpose, start: r.start, end: r.end, distance: r.distance, detail: cleanText(r.detail, 2000), rateAtTest: r.rateAtTest ?? null};
      const error = rideProblem(item); if (error) throw Error(error); return item;
    });
    const ids = [...out.notes, ...out.rides].map(x => x.id);
    if (new Set(ids).size !== ids.length) throw Error('중복된 기록 ID가 있습니다.');
    if (!data.report || typeof data.report !== 'object') throw Error('보고서 형식이 올바르지 않습니다.');
    for (const f of fields) out.report[f] = cleanText(data.report[f] ?? '');
    return out;
  }
  function csv(rides) {
    const quote = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const rows = [['날짜', '조건', '용도', '시작 잔량(%)', '종료 잔량(%)', '거리(km)', '검증 당시 계수(km/%)', '예상 구간 거리(km)', '절대 오차(km)', '메모'], ...rides.map(r => {const v = validation(r); return [r.date, r.condition, r.purpose === 'calibration' ? '보정' : '검증', r.start, r.end, r.distance, r.rateAtTest, v?.predicted, v?.absolute, r.detail];})];
    return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n');
  }
  const api = {SCHEMA, fields, blank, rideProblem, calibration, estimate, validation, normalize, csv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ebike = api;
})(typeof window === 'undefined' ? globalThis : window);
