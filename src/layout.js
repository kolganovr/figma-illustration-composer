// Раскладка иллюстрации. Чистые функции без Figma API.
//
// Как это работает:
//  1. Объекты получают роли (tall: лампа и ваза, flat: книга и папка, medium: наушники и кошелёк,
//     rider: телефон и пазл, tiny: монета и ручка). Для новых объектов роль по форме и размеру.
//  2. По сигнатуре ролей и формату кадра выбираются шаблоны из 18 композиций дизайнера (TEMPLATES_DATA),
//     объекты раскладываются по слотам с сохранением видимой доли и края обреза. Масштаб 1.0.
//  3. Вокруг шаблона 15-30 сдвигов вдоль изометрических осей, плюс зеркало позиций.
//  4. Запасной процедурный генератор (если шаблонов мало или все кандидаты шаблонов бракованы).
//  5. Жёсткий фильтр по порогам раскладки (пороги по 18 кадрам дизайнера), по физике P1, P2 (см. PHYS) и функция стоимости; лучшие 4 различных варианта.
//     Один вызов возвращает один из них: seeds 0..3 дают 4 разных варианта (лучший и три отличных от него),
//     seeds 4..7 следующие по списку различных вариантов и так далее до 16.
//
// Стили layout: cluster - плотная группа около центра; offset - группа смещена к одной стороне,
// минимум один крупный объект уходит за край; title - левые 40% кадра свободны от основных
// (не фоновых) объектов под заголовок; в вертикальном кадре (W/H < 0.85) свободны верхние 40%.
// Область под текст возвращается в titleZone.

const ROLE_BY_KEY = {
  lamp: 'tall', vase: 'tall', book: 'flat', folder: 'flat',
  headphones: 'medium', wallet: 'medium', phone: 'rider', puzzle: 'rider',
  coin: 'tiny', pen: 'tiny',
};

// Пороги раскладки. Внутри держатся строго, с небольшим запасом на округление и растр.
const K3C = {
  cov: [0.70, 0.97], covSmall: [0.45, 0.70],
  vis: { tiny: 0.95, rider: 0.74, medium: 0.66, flat: 0.29, tall: 0.29 }, visAny: 0.29,
  overlap: 0.40, comX: [0.23, 0.65], comY: [0.12, 0.55],
};

// TEMPLATES-BEGIN (сгенерировано по кадрам дизайнера, руками не править)
const TEMPLATES_DATA = {"templates":[{"id":"24:2437","scene":"s01","W":1000,"H":1000,"n":2,"slots":[{"key":"book","role":"flat","state":"main","x":-639.7,"y":11.7,"w":1445.9,"h":976.7,"cx":0.0833,"cy":0.5,"visx":0.5576,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"phone","role":"rider","state":"main","x":144.4,"y":208.2,"w":796.5,"h":461.7,"cx":0.5426,"cy":0.439,"visx":1.0,"visy":1.0,"z":1,"ride":0,"rel":[0.8177,0.4375]}]},{"id":"24:2654","scene":"s02","W":1000,"H":1000,"n":3,"slots":[{"key":"lamp","role":"tall","state":"bg","x":-87.9,"y":-605.7,"w":945.9,"h":1129,"cx":0.385,"cy":-0.0412,"visx":0.9071,"visy":0.4635,"z":0,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":134.8,"y":544,"w":630.4,"h":396.3,"cx":0.45,"cy":0.7421,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":607.5,"y":437.4,"w":286.7,"h":188.5,"cx":0.7509,"cy":0.5316,"visx":1.0,"visy":1.0,"z":2,"ride":null,"rel":null}]},{"id":"24:2914","scene":"s03","W":1000,"H":1000,"n":3,"slots":[{"key":"pen","role":"tiny","state":"main","x":93.8,"y":654.9,"w":508.4,"h":285.4,"cx":0.348,"cy":0.7976,"visx":1.0,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"book","role":"flat","state":"bg","x":-120.7,"y":-232.1,"w":1445.9,"h":976.7,"cx":0.6022,"cy":0.2562,"visx":0.6916,"visy":0.7624,"z":1,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":67.3,"y":112.3,"w":544.2,"h":313.5,"cx":0.3394,"cy":0.2691,"visx":1.0,"visy":1.0,"z":2,"ride":1,"rel":[0.3182,0.5131]}]},{"id":"24:3057","scene":"s04","W":1000,"H":1000,"n":3,"slots":[{"key":"folder","role":"flat","state":"main","x":30.6,"y":0,"w":1240.6,"h":658.6,"cx":0.6509,"cy":0.3293,"visx":0.7814,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":-179.6,"y":517,"w":630.4,"h":396.3,"cx":0.1356,"cy":0.7151,"visx":0.7151,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":486.5,"y":725,"w":286.7,"h":188.5,"cx":0.6299,"cy":0.8193,"visx":1.0,"visy":1.0,"z":2,"ride":null,"rel":null}]},{"id":"24:3312","scene":"s05","W":1000,"H":1000,"n":2,"slots":[{"key":"phone","role":"rider","state":"main","x":73.1,"y":384.4,"w":796.5,"h":461.7,"cx":0.4714,"cy":0.6152,"visx":1.0,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":331.2,"y":161,"w":544.2,"h":313.5,"cx":0.6033,"cy":0.3177,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null}]},{"id":"24:7656","scene":"s05","W":1200,"H":630,"n":2,"slots":[{"key":"phone","role":"rider","state":"main","x":104.8,"y":152.8,"w":796.5,"h":461.7,"cx":0.4192,"cy":0.609,"visx":1.0,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":628.9,"y":68.6,"w":544.2,"h":313.5,"cx":0.7508,"cy":0.3577,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null}]},{"id":"24:8127","scene":"s06","W":1200,"H":630,"n":2,"slots":[{"key":"vase","role":"tall","state":"main","x":-97.8,"y":-378.9,"w":590.6,"h":747.1,"cx":0.1646,"cy":-0.0085,"visx":0.8344,"visy":0.4928,"z":0,"ride":null,"rel":null},{"key":"headphones","role":"medium","state":"main","x":321.2,"y":77.3,"w":888.1,"h":691.5,"cx":0.6377,"cy":0.6715,"visx":0.9895,"visy":0.7993,"z":1,"ride":null,"rel":null}]},{"id":"24:8002","scene":"s01","W":1200,"H":630,"n":2,"slots":[{"key":"book","role":"flat","state":"main","x":-380.6,"y":-321,"w":1445.9,"h":976.7,"cx":0.2853,"cy":0.2656,"visx":0.7368,"visy":0.645,"z":0,"ride":null,"rel":null},{"key":"phone","role":"rider","state":"main","x":510.3,"y":-18.9,"w":796.5,"h":461.7,"cx":0.7571,"cy":0.3364,"visx":0.8659,"visy":0.9591,"z":1,"ride":0,"rel":[0.8916,0.5457]}]},{"id":"24:8191","scene":"s02","W":1200,"H":630,"n":3,"slots":[{"key":"lamp","role":"tall","state":"bg","x":-19.4,"y":-791.8,"w":945.9,"h":1129,"cx":0.378,"cy":-0.3608,"visx":0.9795,"visy":0.2987,"z":0,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":898.9,"y":128.9,"w":286.7,"h":188.5,"cx":0.8685,"cy":0.3542,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":299.7,"y":290.8,"w":630.4,"h":396.3,"cx":0.5124,"cy":0.7761,"visx":1.0,"visy":0.8559,"z":2,"ride":null,"rel":null}]},{"id":"24:8070","scene":"s04","W":1200,"H":630,"n":3,"slots":[{"key":"folder","role":"flat","state":"main","x":198.1,"y":-201.7,"w":1240.6,"h":658.6,"cx":0.682,"cy":0.2025,"visx":0.8076,"visy":0.6937,"z":0,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":416.5,"y":431.6,"w":286.7,"h":188.5,"cx":0.4665,"cy":0.8347,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":-213.9,"y":204.4,"w":630.4,"h":396.3,"cx":0.0844,"cy":0.639,"visx":0.6607,"visy":1.0,"z":2,"ride":null,"rel":null}]},{"id":"24:8248","scene":"s03","W":1200,"H":630,"n":3,"slots":[{"key":"pen","role":"tiny","state":"main","x":36.6,"y":287.5,"w":508.4,"h":285.4,"cx":0.2423,"cy":0.6829,"visx":1.0,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"book","role":"flat","state":"bg","x":204.7,"y":-390.2,"w":1445.9,"h":976.7,"cx":0.773,"cy":0.1558,"visx":0.6884,"visy":0.6005,"z":1,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":398.6,"y":-63.3,"w":544.2,"h":313.5,"cx":0.5589,"cy":0.1483,"visx":1.0,"visy":0.7981,"z":2,"ride":1,"rel":[0.3223,0.4952]}]},{"id":"24:9802","scene":"s05","W":800,"H":1200,"n":2,"slots":[{"key":"phone","role":"rider","state":"main","x":-55.2,"y":472.8,"w":796.5,"h":461.7,"cx":0.4288,"cy":0.5864,"visx":0.9307,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":197.2,"y":183.1,"w":544.2,"h":313.5,"cx":0.5866,"cy":0.2832,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null}]},{"id":"24:9813","scene":"s01","W":800,"H":1200,"n":2,"slots":[{"key":"book","role":"flat","state":"main","x":-678.7,"y":111.7,"w":1445.9,"h":976.7,"cx":0.0553,"cy":0.5,"visx":0.5306,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"phone","role":"rider","state":"main","x":212.3,"y":413.7,"w":796.5,"h":461.7,"cx":0.7632,"cy":0.5371,"visx":0.7379,"visy":1.0,"z":1,"ride":0,"rel":[0.8917,0.5456]}]},{"id":"24:9829","scene":"s04","W":800,"H":1200,"n":3,"slots":[{"key":"folder","role":"flat","state":"main","x":-43.7,"y":-3.8,"w":1240.6,"h":658.6,"cx":0.7207,"cy":0.2712,"visx":0.6448,"visy":0.9942,"z":0,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":437.1,"y":874.3,"w":286.7,"h":188.5,"cx":0.7256,"cy":0.8071,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":-179.1,"y":585,"w":630.4,"h":396.3,"cx":0.1701,"cy":0.6526,"visx":0.7159,"visy":1.0,"z":2,"ride":null,"rel":null}]},{"id":"24:9833","scene":"s06","W":800,"H":1200,"n":2,"slots":[{"key":"vase","role":"tall","state":"main","x":303.9,"y":-190.5,"w":590.6,"h":747.1,"cx":0.749,"cy":0.1525,"visx":0.84,"visy":0.745,"z":0,"ride":null,"rel":null},{"key":"headphones","role":"medium","state":"main","x":0,"y":487.3,"w":888.1,"h":691.5,"cx":0.5551,"cy":0.6942,"visx":0.9008,"visy":1.0,"z":1,"ride":null,"rel":null}]},{"id":"24:9844","scene":"s02","W":800,"H":1200,"n":3,"slots":[{"key":"lamp","role":"tall","state":"bg","x":-140.4,"y":-588.4,"w":945.9,"h":1129,"cx":0.4157,"cy":-0.0199,"visx":0.8458,"visy":0.4788,"z":0,"ride":null,"rel":null},{"key":"coin","role":"tiny","state":"main","x":435.5,"y":562.6,"w":286.7,"h":188.5,"cx":0.7236,"cy":0.5474,"visx":1.0,"visy":1.0,"z":1,"ride":null,"rel":null},{"key":"wallet","role":"medium","state":"main","x":35.1,"y":709,"w":630.4,"h":396.3,"cx":0.4379,"cy":0.756,"visx":1.0,"visy":1.0,"z":2,"ride":null,"rel":null}]},{"id":"24:9848","scene":"s03","W":800,"H":1200,"n":3,"slots":[{"key":"pen","role":"tiny","state":"main","x":21.5,"y":827.9,"w":508.4,"h":285.4,"cx":0.3446,"cy":0.8088,"visx":1.0,"visy":1.0,"z":0,"ride":null,"rel":null},{"key":"book","role":"flat","state":"bg","x":-251.2,"y":-128.9,"w":1445.9,"h":976.7,"cx":0.5897,"cy":0.2995,"visx":0.5533,"visy":0.868,"z":1,"ride":null,"rel":null},{"key":"puzzle","role":"rider","state":"main","x":-23.4,"y":196.3,"w":544.2,"h":313.5,"cx":0.3109,"cy":0.2942,"visx":0.957,"visy":1.0,"z":2,"ride":1,"rel":[0.3457,0.4934]}]},{"id":"24:3592","scene":"s06","W":1000,"H":1000,"n":2,"slots":[{"key":"vase","role":"tall","state":"main","x":-32.9,"y":-373.6,"w":590.6,"h":747.1,"cx":0.2624,"cy":-0.0001,"visx":0.9443,"visy":0.4999,"z":0,"ride":null,"rel":null},{"key":"headphones","role":"medium","state":"main","x":192.4,"y":282.3,"w":888.1,"h":691.5,"cx":0.6365,"cy":0.628,"visx":0.9094,"visy":1.0,"z":1,"ride":null,"rel":null}]}],"surface":{"phone_on_book":[0.867,0.51],"puzzle_on_book(bg)":[0.329,0.501]},"phys":{"phone":{"points":[[0.8177,0.4375],[0.8916,0.5457],[0.8917,0.5456]],"over":{"l":0.0,"r":0.3033,"t":0.0,"b":0.0}},"puzzle":{"points":[[0.3182,0.5131],[0.3223,0.4952],[0.3457,0.4934]],"over":{"l":0.0,"r":0.0,"t":0.0,"b":0.0}}}};
// TEMPLATES-END

// Точки "кладём сверху" (центр седока в долях рамки подставки), пересчитаны по кадрам дизайнера:
// телефон на книге (24:2437, 24:8002, 24:9813), пазл на книге(bg) (24:2914, 24:8248, 24:9848).
const RIDER_REL = {
  phone: TEMPLATES_DATA.surface.phone_on_book || [0.867, 0.51],
  puzzle: TEMPLATES_DATA.surface['puzzle_on_book(bg)'] || [0.329, 0.501],
};
// Физика: жёсткие фильтры P1, P2. Параметры подобраны по 18 кадрам дизайнера (0 нарушений).
//  P1: седок (телефон, пазл) на верхней грани подставки: центр в области кадров дизайнера +-margin
//      (в долях рамки подставки), вылет рамки за подставку не больше дизайнерского + overMargin (в долях размера седока).
//  P2: основания объектов на одном полу не пересекаются. Основание = параллелограмм по осям изометрии (tan 30 = 0.577):
//      лежачие предметы (книга, папка, телефон, пазл, кошелёк, монета, ручка) на всю ширину рамки в нижней полосе высотой
//      min(h, 0.577 w), стоячие (лампа, ваза, наушники) шириной 0.8 рамки по центру. Вершины: слева на высоте t полосы, сверху на
//      доле t ширины (телефон t = 0.33, остальные 0.5). Стопка (седок и подставка) исключена, фоновый объект стоит на полу как все.
const PHYS = { tanIso: 0.577, upW: 0.8, tPhone: 0.33, baseTol: 0.01, margin: 0.06, overMargin: 0.05 };
const PHYS_UPRIGHT_KEYS = new Set(['lamp', 'vase', 'headphones']);
const FLATLIKE_KEYS = new Set(['book', 'folder', 'phone', 'puzzle', 'wallet', 'coin', 'pen']);
const PHYS_DATA = TEMPLATES_DATA.phys || {};
function physOf(key) { return PHYS_DATA[key] || PHYS_DATA.phone; }
// область центра седока: [x0, x1, y0, y1] в долях рамки подставки (shrink сужает на запас растра)
function riderBox(key, shrink) {
  const d = physOf(key), xs = d.points.map((p) => p[0]), ys = d.points.map((p) => p[1]), m = PHYS.margin - (shrink || 0);
  return [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...ys) - m, Math.max(...ys) + m];
}
// flat: лежачий предмет (по ключу, для новых объектов по роли)
function baseShape(r, key, flat) {
  const t = key === 'phone' ? PHYS.tPhone : 0.5;
  const w = flat ? r.w : r.w * PHYS.upW, x = flat ? r.x : r.x + (r.w - w) / 2;
  const hb = flat ? Math.min(r.h, PHYS.tanIso * r.w) : PHYS.tanIso * w, y0 = r.y + r.h - hb;
  return [[x, y0 + t * hb], [x + t * w, y0], [x + w, y0 + (1 - t) * hb], [x + (1 - t) * w, y0 + hb]];
}
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; }
function polyClip(subj, clip) {
  let out = subj;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inp = out; out = [];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
  }
  return out;
}
const ccw = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a < 0 ? p.slice().reverse() : p; };
// доля пересечения оснований от площади меньшего
function baseOverlap(pa0, pb0) {
  let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity, bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const p of pa0) { ax0 = Math.min(ax0, p[0]); ax1 = Math.max(ax1, p[0]); ay0 = Math.min(ay0, p[1]); ay1 = Math.max(ay1, p[1]); }
  for (const p of pb0) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }
  if (Math.min(ax1, bx1) <= Math.max(ax0, bx0) || Math.min(ay1, by1) <= Math.max(ay0, by0)) return 0;
  const pa = ccw(pa0), pb = ccw(pb0), i = polyClip(pa, pb);
  return i.length >= 3 ? polyArea(i) / Math.min(polyArea(pa), polyArea(pb)) : 0;
}
// стопки по рамкам (как в измерителе): седок и подставка, рамки пересекаются больше чем на 0.4 меньшей
function stacksOf(rs, ctx) {
  const out = [];
  for (let i = 0; i < ctx.n; i++) {
    if (ctx.roles[i] !== 'rider') continue;
    for (let j = 0; j < ctx.n; j++) {
      if (i === j || ctx.roles[j] !== 'flat') continue;
      if (rinter(rs[i], rs[j]) / Math.min(rs[i].w * rs[i].h, rs[j].w * rs[j].h) > 0.4) out.push([i, j]);
    }
  }
  return out;
}
// Нарушение P1 + P2 в условных единицах (0 = физика цела). margin: запас на растр и округление.
function physViol(rs, ctx, margin) {
  const stacks = stacksOf(rs, ctx), st = new Set(stacks.map(([i, j]) => `${Math.min(i, j)}_${Math.max(i, j)}`));
  let v = 0;
  for (const [i, j] of stacks) {
    const r = rs[i], h = rs[j], d = physOf(ctx.keys[i]);
    const [bx0, bx1, by0, by1] = riderBox(ctx.keys[i], margin ? 0.01 : 0);
    const cx = (r.x + r.w / 2 - h.x) / h.w, cy = (r.y + r.h / 2 - h.y) / h.h;
    v += Math.max(0, bx0 - cx) + Math.max(0, cx - bx1) + Math.max(0, by0 - cy) + Math.max(0, cy - by1);
    const om = PHYS.overMargin - (margin ? 0.01 : 0);
    v += Math.max(0, (h.x - r.x) / r.w - d.over.l - om) + Math.max(0, (r.x + r.w - h.x - h.w) / r.w - d.over.r - om)
      + Math.max(0, (h.y - r.y) / r.h - d.over.t - om) + Math.max(0, (r.y + r.h - h.y - h.h) / r.h - d.over.b - om);
  }
  const tol = margin ? 0 : PHYS.baseTol * 0.5;
  const bs = rs.map((r, i) => baseShape(r, ctx.keys[i], FLATLIKE_KEYS.has(ctx.keys[i]) || ['tiny', 'rider', 'flat'].includes(ctx.roles[i]) && !PHYS_UPRIGHT_KEYS.has(ctx.keys[i])));
  for (let i = 0; i < ctx.n; i++) {
    for (let j = i + 1; j < ctx.n; j++) {
      if (st.has(`${i}_${j}`)) continue;
      const f = baseOverlap(bs[i], bs[j]);
      if (f > tol) v += f;
    }
  }
  return v;
}

const OBJ_META = {
  book: { kind: 'host', surface: RIDER_REL.phone },
  folder: { kind: 'host', surface: RIDER_REL.phone },
  phone: { kind: 'small', rider: true },
  puzzle: { kind: 'small', rider: true },
  coin: { kind: 'small' }, pen: { kind: 'small' },
  wallet: { kind: 'medium' }, headphones: { kind: 'medium' },
  lamp: { kind: 'tall' }, vase: { kind: 'tall' },
};

// Точки "кладём сверху" из переданных шаблонов.
function riderRelFrom(templates) {
  const acc = {}, all = [];
  for (const t of templates) {
    for (const sl of t.slots) {
      if (sl.ride === null || sl.ride === undefined || !sl.rel) continue;
      (acc[sl.key] = acc[sl.key] || []).push(sl.rel);
      all.push(sl.rel);
    }
  }
  const mean = (a) => [a.reduce((x, r) => x + r[0], 0) / a.length, a.reduce((x, r) => x + r[1], 0) / a.length];
  if (!all.length) return RIDER_REL;
  const out = {};
  const bc = (k) => { const b = riderBox(k, 0); return [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]; }; // нет данных по седоку в этих шаблонах: центр области укладки (P1)
  for (const k of Object.keys(RIDER_REL)) out[k] = acc[k] ? mean(acc[k]) : bc(k);
  for (const k of Object.keys(acc)) out[k] = mean(acc[k]);
  return out;
}

function roleOf(it, u) {
  const r = ROLE_BY_KEY[it.key];
  if (r) return r;
  // Неизвестный объект (добавили в библиотеку позже): роль по форме, площадь приводится к размеру L.
  const w = it.w * u, h = it.h * u, a = w * h;
  if (a < 150000) return 'tiny';
  if (a < 400000 && h <= w * 1.15) return 'rider';
  if (h > w * 1.15 && a > 300000) return 'tall';
  if (w > h * 1.4 && a > 700000) return 'flat';
  return 'medium';
}

// Детерминированный генератор (xorshift).
function rng(seed) {
  let s = ((seed * 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ---------- геометрия и метрики ----------
function rinter(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

// Точная площадь объединения прямоугольников внутри кадра (для поиска).
function unionExact(rs, W, H) {
  const xs = [0, W], cl = [];
  for (const r of rs) {
    const x1 = Math.max(0, r.x), y1 = Math.max(0, r.y), x2 = Math.min(W, r.x + r.w), y2 = Math.min(H, r.y + r.h);
    if (x2 > x1 && y2 > y1) { cl.push([x1, y1, x2, y2]); xs.push(x1, x2); }
  }
  xs.sort((a, b) => a - b);
  let area = 0;
  for (let k = 0; k < xs.length - 1; k++) {
    const xa = xs[k], xb = xs[k + 1];
    if (xb <= xa) continue;
    const iv = [];
    for (const c of cl) if (c[0] <= xa && c[2] >= xb) iv.push([c[1], c[3]]);
    iv.sort((p, q) => p[0] - q[0]);
    let len = 0, cur = -Infinity;
    for (const [a, b] of iv) { const s = Math.max(a, cur); if (b > s) { len += b - s; cur = b; } }
    area += len * (xb - xa);
  }
  return area / (W * H);
}

// Растровая оценка (шаг 10), для финальной проверки в реальных координатах.
function unionRaster(rs, W, H) {
  let n = 0;
  for (let yy = 0; yy < Math.floor(H); yy += 10) {
    for (let xx = 0; xx < Math.floor(W); xx += 10) {
      for (const r of rs) {
        if (r.x <= xx && xx < r.x + r.w && r.y <= yy && yy < r.y + r.h) { n++; break; }
      }
    }
  }
  return n * 100 / (W * H);
}

// Область под заголовок (title): в горизонтальном и квадратном кадре левые 40%, в вертикальном (W/H < 0.85) верхние 40%.
// Покрытие и центр масс считаются в оставшейся области (r), правило видимости по всему кадру.
function titleGeom(W, H) {
  if (W / H < 0.85) return { zone: { x: 0, y: 0, w: W, h: H * 0.4 }, x0: 0, y0: H * 0.4 };
  return { zone: { x: 0, y: 0, w: W * 0.4, h: H }, x0: W * 0.4, y0: 0 };
}

// Оценка кандидата: жёсткие ограничения раскладки (viol > 0 = брак) и стоимость для ранжирования.
// rs[i] - рамка предмета i; ctx.keys/roles/states выровнены по тому же индексу.
function scoreRects(rs, ctx, margin, cov) {
  const { W, H, n, roles, states } = ctx;
  const vis = [], va = [];
  let viol = 0;
  for (let i = 0; i < n; i++) {
    const r = rs[i];
    const a = Math.max(0, Math.min(r.x + r.w, W) - Math.max(r.x, 0)) * Math.max(0, Math.min(r.y + r.h, H) - Math.max(r.y, 0));
    va.push(a); vis.push(a / (r.w * r.h));
  }
  const m = margin ? 0.004 : 0;
  for (let i = 0; i < n; i++) {
    const need = Math.max(K3C.vis[roles[i]] || K3C.visAny, K3C.visAny) + m;
    if (vis[i] < need) viol += need - vis[i];
  }
  // title: покрытие и центр масс считаются в правых 60% кадра (левые 40% отданы под заголовок)
  const tg = ctx.layout === 'title' ? titleGeom(W, H) : null;
  const x0 = tg ? tg.x0 : 0, y0 = tg ? tg.y0 : 0, RW = W - x0, RH = H - y0;
  const vr = tg ? rs.map((r) => rinter(r, { x: x0, y: y0, w: RW, h: RH })) : va;
  let sumA = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) sumA += vr[i];
  sumA = Math.max(1, sumA);
  for (let i = 0; i < n; i++) { cx += (rs[i].x + rs[i].w / 2 - x0) * vr[i]; cy += (rs[i].y + rs[i].h / 2 - y0) * vr[i]; }
  cx /= sumA * RW; cy /= sumA * RH;
  if (cx < K3C.comX[0] + m) viol += K3C.comX[0] + m - cx;
  if (cx > K3C.comX[1] - m) viol += cx - (K3C.comX[1] - m);
  if (cy < K3C.comY[0] + m) viol += K3C.comY[0] + m - cy;
  if (cy > K3C.comY[1] - m) viol += cy - (K3C.comY[1] - m);
  const ov = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const o = rinter(rs[i], rs[j]) / Math.min(rs[i].w * rs[i].h, rs[j].w * rs[j].h);
      const stack = (roles[i] === 'flat' && roles[j] === 'rider') || (roles[j] === 'flat' && roles[i] === 'rider')
        || (states[i] === 'bg' && roles[j] === 'tiny') || (states[j] === 'bg' && roles[i] === 'tiny');
      if (!stack && o > K3C.overlap - m) viol += o - (K3C.overlap - m);
      ov.push([i, j, o, stack]);
    }
  }
  const covv = cov !== undefined ? cov : unionExact(tg ? rs.map((r) => ({ ...r, x: r.x - x0, y: r.y - y0 })) : rs, RW, RH);
  const mc = margin ? 0.012 : 0;
  let [clo, chi] = ctx.small ? K3C.covSmall : K3C.cov;
  // масштаб всегда 1.0: если порог недостижим, требуем 90% от достижимого
  if (ctx.covBound !== undefined && ctx.covBound < clo) clo = 0.9 * ctx.covBound;
  if (covv < clo + mc) viol += (clo + mc - covv) * 2;
  if (covv > chi - mc) viol += (covv - (chi - mc)) * 2;
  // Заголовок: левые 40% кадра без основных объектов.
  if (ctx.layout === 'title') {
    const zone = tg.zone;
    for (let i = 0; i < n; i++) {
      if (states[i] === 'bg') continue;
      const inz = rinter(rs[i], zone) / Math.max(1, va[i]);
      if (inz > 0.12) viol += (inz - 0.12);
    }
  }
  viol += physViol(rs, ctx, margin); // P1, P2: физика, жёсткий фильтр
  return { viol, vis, cov: covv, com: [cx, cy], ov };
}

function costOf(sc, c, ctx) {
  const { W, H, n, states } = ctx;
  const rs = c.r;
  const [cx, cy] = sc.com;
  let cost = 0;
  cost += (c.meta.tplCost || 0) * 0.8 + (c.meta.src === 'proc' ? ctx.procPenalty : 0) + (c.meta.mirrored ? 0.15 : 0);
  cost += (c.meta.shift || 0) * 1.2;
  cost += Math.abs(sc.cov - (ctx.small ? 0.56 : 0.82)) * 2.5;
  const minVis = Math.min(...sc.vis.filter((_, i) => ctx.roles[i] !== 'tiny'), 1);
  if (!ctx.small && n >= 2 && minVis > 0.999) cost += 0.5; // у дизайнера обрез краем в 16 из 18 кадров
  const style = ctx.layout;
  if (style === 'offset') {
    cost += 1.2 * Math.min(Math.abs(cx - 0.30), Math.abs(cx - 0.62)) + 0.6 * Math.abs(cy - 0.38);
    if (minVis > 0.7) cost += 0.6;
  } else if (style === 'title') {
    cost += 1.2 * Math.abs(cx - 0.58) + 0.6 * Math.abs(cy - 0.40);
  } else {
    cost += 1.2 * (Math.abs(cx - 0.5) + Math.abs(cy - (ctx.small ? 0.5 : 0.38)));
  }
  // у дизайнера соседи перекрываются умеренно (0.08-0.37), кроме стопок
  for (const [, , o, stack] of sc.ov) if (!stack && o > 0) cost += 0.8 * Math.abs(o - 0.2);
  // связность: рамки соседей касаются или перекрываются (у дизайнера max_overlap >= 0.08 везде)
  const par = rs.map((_, i) => i);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const gap = 0.02 * Math.min(W, H);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = rs[i], b = rs[j];
      if (a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap) par[find(i)] = find(j);
    }
  }
  const comps = new Set(rs.map((_, i) => find(i))).size;
  cost += (comps - 1) * 1.0;
  return cost;
}

// ---------- кандидаты ----------
// Кандидат: r[i] - рамка предмета i, host[i] - предмет-подставка или -1, z[i] - порядок слоёв, meta.
function cloneCand(c) {
  return { r: c.r.map((x) => ({ ...x })), host: c.host.slice(), z: c.z.slice(), meta: { ...c.meta }, rel: c.rel ? c.rel.map((x) => x && x.slice()) : null };
}

// Порядок слоёв: из пары пересекающихся рамок выше стоит тот, чей нижний край ниже. Исключения:
// стопка (седок выше подставки, пазл выше телефона), bg ниже main,
// мелкий акцент и bg-задник не проверяются, касание углами (<= 0.05 меньшей рамки) не проверяется,
// мелкий акцент выше соседа допустим всегда. Возвращает рёбра [нижний, верхний, сила]: сила 2 стопка и bg,
// 1 правило нижнего края, 0.5 мягкое "мелкий акцент сверху".
function zEdges(rs, ctx, host) {
  const E = [];
  const { keys, roles, states, n } = ctx;
  const tiny = (i) => roles[i] === 'tiny';
  for (let i = 0; i < n; i++) if (host && host[i] >= 0) E.push([host[i], i, 2]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ov = rinter(rs[i], rs[j]);
      if (ov <= 0) continue;
      const small = ov / Math.min(rs[i].w * rs[i].h, rs[j].w * rs[j].h) <= 0.05;
      const stack = (roles[i] === 'flat' && roles[j] === 'rider') || (roles[j] === 'flat' && roles[i] === 'rider');
      let up = -1, str = 1;
      if (small && !stack) { if (tiny(i) !== tiny(j)) E.push(tiny(i) ? [j, i, 0.5] : [i, j, 0.5]); continue; }
      if (stack) { up = roles[i] === 'rider' ? i : j; str = 2; }
      else if (keys[i] === 'puzzle' && keys[j] === 'phone') { up = i; str = 2; }
      else if (keys[j] === 'puzzle' && keys[i] === 'phone') { up = j; str = 2; }
      else if ((states[i] === 'bg' && tiny(j)) || (states[j] === 'bg' && tiny(i))) { up = tiny(i) ? i : j; str = 0.5; }
      else if ((states[i] === 'bg') !== (states[j] === 'bg')) { up = states[i] === 'bg' ? j : i; str = 2; }
      else if (Math.abs((rs[i].y + rs[i].h) - (rs[j].y + rs[j].h)) < 1e-6) continue;
      else up = (rs[i].y + rs[i].h) > (rs[j].y + rs[j].h) ? i : j;
      const lo = up === i ? j : i;
      if (tiny(lo) && !tiny(up) && str === 1) { E.push([up, lo, 0.2]); continue; } // порядок свободен, по умолчанию как в правиле
      E.push([lo, up, str]);
    }
  }
  return E;
}

// Топологическая сортировка слоёв; при цикле отбрасывается самое слабое ребро. Тай-брейк: нижний край выше = ниже слоем.
function zOrder(rs, ctx, host) {
  let E = zEdges(rs, ctx, host);
  const n = ctx.n;
  for (let guard = 0; guard < 50; guard++) {
    const done = new Array(n).fill(false), out = [];
    for (let k = 0; k < n; k++) {
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        if (E.some((e) => e[1] === i && !done[e[0]])) continue;
        const bi = rs[i].y + rs[i].h;
        if (pick < 0 || bi < rs[pick].y + rs[pick].h) pick = i;
      }
      if (pick < 0) break;
      done[pick] = true; out.push(pick);
    }
    if (out.length === n) { const z = new Array(n); out.forEach((i, k) => { z[i] = k; }); return z; }
    const rest = E.filter((e) => !done[e[0]] && !done[e[1]]);
    const weakest = rest.reduce((m, e) => (e[2] < m[2] ? e : m), rest[0]);
    E = E.filter((e) => e !== weakest);
  }
  return [...Array(n).keys()];
}

// Число нарушений порядка слоёв для готовых z (только ребра силы >= 1).
function zViolations(rs, z, ctx) {
  return zEdges(rs, ctx, null).filter((e) => e[2] >= 1 && !(z[e[1]] > z[e[0]])).length;
}

// сдвиг предмета и его седоков
function moveUnit(c, i, dx, dy) {
  c.r[i].x += dx; c.r[i].y += dy;
  for (let j = 0; j < c.host.length; j++) if (c.host[j] === i) { c.r[j].x += dx; c.r[j].y += dy; }
}

function perturb(base, rand, ctx) {
  const c = cloneCand(base);
  const free = [];
  for (let i = 0; i < ctx.n; i++) if (c.host[i] < 0) free.push(i);
  const mn = Math.min(ctx.W, ctx.H);
  const moves = 1 + (rand() < 0.35 ? 1 : 0);
  let shift = 0;
  for (let m = 0; m < moves; m++) {
    const all = rand() < 0.2;
    const u = free[Math.floor(rand() * free.length)];
    const ang = (rand() < 0.5 ? 30 : -30) * Math.PI / 180;
    const sgn = rand() < 0.5 ? 1 : -1;
    const step = [0.03, 0.06, 0.09, 0.13, 0.18][Math.floor(rand() * 5)] * mn;
    const dx = Math.cos(ang) * step * sgn, dy = -Math.sin(ang) * step * sgn;
    if (all) for (const f of free) moveUnit(c, f, dx, dy); else moveUnit(c, u, dx, dy);
    shift += step / mn * (all ? 0.5 : 1);
  }
  c.meta.shift = (base.meta.shift || 0) + shift;
  c.meta.perturbed = true;
  return c;
}

// ---------- шаблоны ----------
function mirrorTpl(t) {
  return {
    ...t, mirrored: true,
    slots: t.slots.map((s) => ({ ...s, x: t.W - s.x - s.w, cx: 1 - s.cx, rel: s.rel })),
  };
}

function roleCompat(a, b) {
  if (a === b) return 0;
  const k = [a, b].sort().join('+');
  const t = {
    'medium+rider': 0.5, 'flat+medium': 0.6, 'medium+tall': 0.7, 'rider+tiny': 0.6, 'flat+tall': 0.8,
    'flat+rider': 1.2, 'rider+tall': 1.2, 'medium+tiny': 1.3, 'flat+tiny': 1.8, 'tall+tiny': 1.8,
  };
  return t[k] !== undefined ? t[k] : 1.5;
}

function slotCost(ctx, i, s) {
  let c = roleCompat(ctx.roles[i], s.role);
  c += 0.35 * Math.abs(Math.log((ctx.dims[i].w * ctx.dims[i].h) / (s.w * s.h)));
  if (ctx.keys[i] === s.key) c -= 0.4;
  if ((ctx.states[i] === 'bg') !== (s.state === 'bg')) c += STATE_PEN;
  return c;
}

function axisPos(start, size, tLen, vis, itemSize, F, centerFrac) {
  const cutLo = start < -0.5, cutHi = start + size > tLen + 0.5;
  if (cutLo && !cutHi) return -(1 - vis) * itemSize;
  if (cutHi && !cutLo) return F - vis * itemSize;
  let p = centerFrac * F - itemSize / 2;
  if (!cutLo && !cutHi && itemSize <= F) p = Math.min(Math.max(p, 0), F - itemSize);
  return p;
}

// Перенос шаблона: assign[i] = индекс слота для предмета i.
function retarget(tpl, assign, ctx, cost) {
  const { W, H, n, dims, roles } = ctx;
  const itemOfSlot = {};
  assign.forEach((s, i) => { itemOfSlot[s] = i; });
  const r = new Array(n), host = new Array(n).fill(-1), z = new Array(n), rel = new Array(n).fill(null);
  const pending = [];
  for (let i = 0; i < n; i++) {
    const s = tpl.slots[assign[i]];
    z[i] = s.z;
    const hi = s.ride !== null && s.ride !== undefined ? itemOfSlot[s.ride] : undefined;
    if (hi !== undefined && roles[i] === 'rider' && roles[hi] === 'flat') { pending.push([i, hi, s.rel]); continue; }
    const d = dims[i];
    r[i] = {
      x: axisPos(s.x, s.w, tpl.W, s.visx, d.w, W, s.cx),
      y: axisPos(s.y, s.h, tpl.H, s.visy, d.h, H, s.cy),
      w: d.w, h: d.h,
    };
  }
  for (const [i, hi, rl0] of pending) {
    const d = dims[i], h = r[hi];
    const bb = riderBox(ctx.keys[i], 0.01), rl = [Math.min(Math.max(rl0[0], bb[0]), bb[1]), Math.min(Math.max(rl0[1], bb[2]), bb[3])]; // точка укладки внутри области P1
    r[i] = { x: h.x + rl[0] * h.w - d.w / 2, y: h.y + rl[1] * h.h - d.h / 2, w: d.w, h: d.h };
    host[i] = hi; rel[i] = rl;
  }
  return { r, host, z, rel, meta: { src: 'tpl', tplId: tpl.id, tplCost: cost, mirrored: !!tpl.mirrored, shift: 0 } };
}

function templateBases(ctx, templates) {
  const { n, W, H } = ctx;
  const asp = Math.log(W / H);
  const out = [];
  for (const t0 of templates) {
    if (t0.slots.length < n) continue;
    for (const t of [t0, mirrorTpl(t0)]) {
      const fmt = 1.5 * Math.abs(Math.log(t.W / t.H) - asp) + (t.mirrored ? 0.15 : 0);
      const m = t.slots.length;
      const assigns = [];
      const cur = new Array(n), used = new Array(m).fill(false);
      const rec = (i, acc) => {
        if (i === n) { assigns.push([cur.slice(), acc + UNUSED_PEN * (m - n)]); return; }
        for (let s = 0; s < m; s++) {
          if (used[s]) continue;
          used[s] = true; cur[i] = s;
          rec(i + 1, acc + slotCost(ctx, i, t.slots[s]));
          used[s] = false;
        }
      };
      rec(0, 0);
      assigns.sort((a, b) => a[1] - b[1]);
      for (const [as, ac] of assigns.slice(0, 2)) out.push({ t, as, cost: ac + fmt });
    }
  }
  out.sort((a, b) => a.cost - b.cost);
  // не больше 2 баз на один шаблон (оригинал и зеркало), всего 8 баз
  const seen = {}, picked = [];
  for (const o of out) {
    const k = o.t.id + (o.t.mirrored ? 'm' : '');
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] > 1) continue;
    picked.push(o);
    if (picked.length >= 8) break;
  }
  return picked.map((o) => retarget(o.t, o.as, ctx, o.cost));
}

// ---------- запасной процедурный генератор ----------
function placeNear(anchor, d, theta, tOv) {
  const dx = Math.cos(theta), dy = -Math.sin(theta);
  const ac = { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 };
  const mk = (t) => ({ x: ac.x + dx * t - d.w / 2, y: ac.y + dy * t - d.h / 2, w: d.w, h: d.h });
  let lo = 0, hi = anchor.w + anchor.h + d.w + d.h;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    const q = mk(mid);
    const ov = rinter(anchor, q) / Math.min(anchor.w * anchor.h, d.w * d.h);
    if (ov > tOv) lo = mid; else hi = mid;
  }
  return mk(hi);
}

function procedural(ctx, rand, count) {
  const { n, dims, roles } = ctx;
  const out = [];
  const D = Math.PI / 180;
  for (let t = 0; t < count; t++) {
    const host = new Array(n).fill(-1);
    const flats = [], riders = [];
    for (let i = 0; i < n; i++) { if (roles[i] === 'flat') flats.push(i); if (roles[i] === 'rider') riders.push(i); }
    const usedHost = new Set();
    for (const r of riders.sort(() => rand() - 0.5)) {
      const h = flats.find((f) => !usedHost.has(f));
      if (h !== undefined && rand() < 0.7) { host[r] = h; usedHost.add(h); }
    }
    const units = [];
    for (let i = 0; i < n; i++) if (host[i] < 0) units.push(i);
    units.sort((a, b) => dims[b].w * dims[b].h - dims[a].w * dims[a].h);
    if (rand() < 0.4 && units.length > 2) { const k = 1 + Math.floor(rand() * (units.length - 1)); [units[1], units[k]] = [units[k], units[1]]; }
    const r = new Array(n);
    r[units[0]] = { x: 0, y: 0, w: dims[units[0]].w, h: dims[units[0]].h };
    const placed = [units[0]];
    for (const u of units.slice(1)) {
      const anchor = r[placed[Math.floor(rand() * placed.length)]];
      const tiny = roles[u] === 'tiny';
      const angs = tiny ? [-30, -150, -90, -60, -120] : [30, 150, -30, -150, 90, -90, 60, 120];
      const th = (angs[Math.floor(rand() * angs.length)] + (rand() - 0.5) * 16) * D;
      r[u] = placeNear(anchor, dims[u], th, 0.03 + rand() * 0.3);
      placed.push(u);
    }
    const rel = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (host[i] < 0) continue;
      const base = ctx.riderRel[ctx.keys[i]] || ctx.riderRel.phone || [0.5, 0.5];
      const wide = rand() < 0.5; // половина кандидатов: седок в любой точке области укладки (P1), не только в точке дизайнера
      const bb = riderBox(ctx.keys[i], 0.015);
      const rl = wide ? [bb[0] + rand() * (bb[1] - bb[0]), bb[2] + rand() * (bb[3] - bb[2])] : [base[0] + (rand() - 0.5) * 0.08, base[1] + (rand() - 0.5) * 0.08];
      const h = r[host[i]];
      r[i] = { x: h.x + rl[0] * h.w - dims[i].w / 2, y: h.y + rl[1] * h.h - dims[i].h / 2, w: dims[i].w, h: dims[i].h };
      rel[i] = rl;
    }
    // слои: крупные внизу
    const order = [...Array(n).keys()].sort((a, b) => dims[b].w * dims[b].h - dims[a].w * dims[a].h);
    const z = new Array(n);
    order.forEach((i, k) => { z[i] = k; });
    out.push(bestTranslate({ r, host, z, rel, meta: { src: 'proc', tplCost: 0, shift: 0 } }, ctx));
  }
  return out.filter(Boolean);
}

// Перебор положения готовой группы в кадре (сетка), берём лучшее по стоимости среди проходящих пороги.
function bestTranslate(arr, ctx) {
  const { W, H, n } = ctx;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of arr.r) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h); }
  const gw = x1 - x0, gh = y1 - y0;
  let best = null, bestCost = Infinity, bestViol = null, bestViolV = Infinity;
  const NX = 17, NY = 17;
  for (let a = 0; a < NX; a++) {
    const px = -0.65 * gw + (W - 0.35 * gw + 0.65 * gw) * a / (NX - 1) - (W * 0); // левый край группы
    for (let b = 0; b < NY; b++) {
      const py = -0.65 * gh + (H + 0.3 * gh) * b / (NY - 1);
      const dx = px - x0, dy = py - y0;
      const c = cloneCand(arr);
      for (const q of c.r) { q.x += dx; q.y += dy; }
      const sc = scoreRects(c.r, ctx, true);
      if (sc.viol > 0) { if (sc.viol < bestViolV) { bestViolV = sc.viol; bestViol = c; } continue; }
      const cost = costOf(sc, c, ctx);
      if (cost < bestCost) { bestCost = cost; best = c; }
    }
  }
  return best || bestViol;
}

// ---------- пул кандидатов и выбор ----------
function buildCtx(items, opts, u, f, templates) {
  const W = opts.W * u, H = opts.H * u;
  const roles = items.map((it) => roleOf(it, u));
  const states = items.map((it) => it.state || 'main');
  const n = items.length;
  // 4-5 объектов: один-два крупных уходят в фоновое состояние
  const overrides = {};
  if (n >= 4) {
    const big = items.map((it, i) => i).filter((i) => (roles[i] === 'flat' || roles[i] === 'tall') && states[i] === 'main')
      .sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h).slice(0, 2);
    for (const i of big) { states[i] = 'bg'; overrides[i] = 'bg'; }
  }
  return {
    W, H, n, u, f, layout: opts.layout || 'cluster', procPenalty: 0.5, riderRel: riderRelFrom(templates),
    keys: items.map((it) => it.key), roles, states, overrides,
    dims: items.map((it) => ({ w: it.w * u * f, h: it.h * u * f })),
    small: roles.every((r) => r === 'tiny' || r === 'rider'),
    // верхняя граница покрытия при 1:1 (сумма площадей рамок / кадр): для сцен из мелких она ниже порога покрытия
    covBound: !opts.relaxCov ? undefined : items.reduce((a, it) => a + it.w * it.h * u * u * f * f, 0) / (W * H),
  };
}

function runPool(ctx, round, templates) {
  const rand = rng(round * 7919 + 13);
  const pool = [];
  for (const b of templateBases(ctx, templates)) {
    pool.push(b);
    for (let k = 0; k < 24; k++) pool.push(perturb(b, rand, ctx));
  }
  const tplCount = pool.length;
  const procs = procedural(ctx, rand, (tplCount === 0 ? 120 : 50) * (ctx.layout === 'title' ? 5 : 1));
  for (const p of procs) {
    pool.push(p);
    if (rand() < 0.3) for (let k = 0; k < 4; k++) pool.push(perturb(p, rand, ctx));
  }
  const scored = [];
  // шаблон идёт первым, процедурный запас только если подходящего шаблона нет (tplCost <= 2.5 и кандидат прошёл пороги)
  ctx.procPenalty = 0.5;
  for (const c of pool) {
    const sc = scoreRects(c.r, ctx, true);
    if (sc.viol <= 0 && c.meta.src === 'tpl' && c.meta.tplCost <= ADEQ) ctx.procPenalty = 2.5;
  }
  for (const c of pool) {
    const sc = scoreRects(c.r, ctx, true);
    scored.push({ c, sc, cost: sc.viol > 0 ? Infinity : costOf(sc, c, ctx) });
  }
  return scored;
}

const CONSENSUS = 3;
const STATE_PEN = 0.5, UNUSED_PEN = 0.9, ADEQ = 1.0; // штраф за несовпадение состояния слота, за неиспользованный слот, порог "подходящего" шаблона

function meanIou(a, b, ctx) {
  let t = 0;
  for (let i = 0; i < ctx.n; i++) {
    const p = a.r[i], q = b.r[i];
    const x1 = Math.max(p.x, q.x), y1 = Math.max(p.y, q.y), x2 = Math.min(p.x + p.w, q.x + q.w), y2 = Math.min(p.y + p.h, q.y + q.h);
    const it = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    t += it / (p.w * p.h + q.w * q.h - it);
  }
  return t / ctx.n;
}

function distCand(a, b, ctx) {
  let m = 0;
  const s = 0.5 * Math.min(ctx.W, ctx.H);
  for (let i = 0; i < ctx.n; i++) {
    const dx = (a.r[i].x + a.r[i].w / 2) - (b.r[i].x + b.r[i].w / 2);
    const dy = (a.r[i].y + a.r[i].h / 2) - (b.r[i].y + b.r[i].h / 2);
    m = Math.max(m, Math.hypot(dx, dy) / s);
  }
  return m;
}

function pickDiverse(valid, ctx, k) {
  const picked = [];
  for (const th of [0.4, 0.25, 0.12, 0.05, 0]) {
    for (const v of valid) {
      if (picked.length >= k) break;
      if (picked.includes(v)) continue;
      if (th > 0 && picked.some((p) => (p.c.meta.tplId === v.c.meta.tplId && p.c.meta.src === 'tpl' && distCand(p.c, v.c, ctx) < th) || distCand(p.c, v.c, ctx) < th * 0.6)) continue;
      picked.push(v);
    }
    if (picked.length >= k) break;
  }
  return picked;
}

// Финальная проверка в реальных координатах (как у измерителя): растр шага 10, округление позиций до 0.1.
function finalize(scoredItem, ctx, realW, realH) {
  const { c } = scoredItem;
  const u = ctx.u;
  const rr = (v) => Math.round(v / u * 10) / 10;
  const real = c.r.map((q) => ({ x: rr(q.x), y: rr(q.y), w: Math.round(q.w / u * 100) / 100, h: Math.round(q.h / u * 100) / 100 }));
  const z = zOrder(real, ctx, c.host);
  const rctx = { ...ctx, W: realW, H: realH };
  const tg = ctx.layout === 'title' ? titleGeom(realW, realH) : null;
  const sc = scoreRects(real, rctx, false, tg ? unionRaster(real.map((r) => ({ ...r, x: r.x - tg.x0, y: r.y - tg.y0 })), realW - tg.x0, realH - tg.y0) : unionRaster(real, realW, realH));
  sc.viol += zViolations(real, z, ctx); // Порядок слоёв: жёсткий фильтр
  return { real, z, sc };
}

// Последний шанс перед масштабом: случайные положения каждого объекта (стопки как в генераторе), только проходящие пороги.
function rescue(ctx, rand, count) {
  const { n, dims, roles, W, H } = ctx;
  const out = [];
  for (let t = 0; t < count; t++) {
    const host = new Array(n).fill(-1), r = new Array(n);
    const flats = [];
    for (let i = 0; i < n; i++) if (roles[i] === 'flat') flats.push(i);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      if (roles[i] === 'rider' && rand() < 0.5) { const h = flats.find((f) => !used.has(f)); if (h !== undefined) { host[i] = h; used.add(h); } }
    }
    for (let i = 0; i < n; i++) {
      if (host[i] >= 0) continue;
      const d = dims[i];
      r[i] = { x: -0.6 * d.w + rand() * (W + 0.2 * d.w), y: -0.6 * d.h + rand() * (H + 0.2 * d.h), w: d.w, h: d.h };
    }
    for (let i = 0; i < n; i++) {
      if (host[i] < 0) continue;
      const h = r[host[i]], d = dims[i];
      const bb = riderBox(ctx.keys[i], 0.015);
      r[i] = { x: h.x + (bb[0] + rand() * (bb[1] - bb[0])) * h.w - d.w / 2, y: h.y + (bb[2] + rand() * (bb[3] - bb[2])) * h.h - d.h / 2, w: d.w, h: d.h };
    }
    const order = [...Array(n).keys()].sort((a, b) => dims[b].w * dims[b].h - dims[a].w * dims[a].h);
    const z = new Array(n);
    order.forEach((i, k) => { z[i] = k; });
    out.push({ r, host, z, rel: null, meta: { src: 'proc', tplCost: 0, shift: 0 } });
  }
  return out;
}

// Случайные положения + спуск по нарушению; возвращает прошедшие пороги кандидаты (scored).
function rescueDescent(ctx, seedNum, count, top) {
  const rr = rng(seedNum);
  const all = rescue(ctx, rr, count).map((c) => ({ c, sc: scoreRects(c.r, ctx, true) }));
  all.sort((a, b) => a.sc.viol - b.sc.viol);
  const mn = Math.min(ctx.W, ctx.H);
  const out = [];
  for (const e0 of all.slice(0, top)) {
    // спуск по нарушению: случайные сдвиги одного свободного объекта (со стопкой), принимаем не хуже
    let cur = e0.c, cs = e0.sc;
    for (let it = 0; it < 500 && cs.viol > 0; it++) {
      const free = [];
      for (let i = 0; i < ctx.n; i++) if (cur.host[i] < 0) free.push(i);
      const c2 = cloneCand(cur);
      const i = free[Math.floor(rr() * free.length)];
      moveUnit(c2, i, (rr() - 0.5) * 0.12 * mn, (rr() - 0.5) * 0.12 * mn);
      const s2 = scoreRects(c2.r, ctx, true);
      if (s2.viol <= cs.viol) { cur = c2; cs = s2; }
    }
    if (cs.viol <= 0) out.push({ c: cur, sc: cs, cost: costOf(cs, cur, ctx) });
  }
  return out;
}

function solve(items, opts, u, f, templates, kVar) {
  const ctx = buildCtx(items, opts, u, f, templates);
  let scored = runPool(ctx, 0, templates);
  if (!scored.some((e) => e.cost < Infinity)) scored.push(...rescueDescent(ctx, 4242, 6000, 20));
  let res = rankAndPick(scored, ctx, opts, kVar);
  // Мало различных вариантов (тесный стиль, например title в узком кадре давал четыре одинаковых варианта):
  // добираем пул тем же поиском, что и при полном провале, иначе 4 превью в UI совпадают.
  if (res.variants.length && res.variants.length < Math.min(4, kVar)) {
    scored.push(...rescueDescent(ctx, 777, 6000, 40));
    res = rankAndPick(scored, ctx, opts, kVar);
  }
  if (opts.debug) opts.debug.pool = res.ok;
  let nearest = null;
  if (!res.variants.length) {
    // ничего не прошло: берём наименьшее нарушение (для предупреждения)
    nearest = scored.slice().sort((a, b) => a.sc.viol - b.sc.viol)[0];
  }
  return { ctx, variants: res.variants, nearest };
}

function rankAndPick(scored, ctx, opts, kVar) {
  const valid = scored.filter((s) => s.cost < Infinity).sort((a, b) => a.cost - b.cost);
  // финальная проверка кандидатов растром; бракованные отбрасываем
  const ok = [];
  for (const s of valid) {
    const fin = finalize(s, ctx, opts.W, opts.H);
    if (fin.sc.viol <= 0) ok.push({ ...s, fin });
    if (ok.length >= (opts.poolLimit || 60)) break;
  }
  // Выбор "по консенсусу": кандидаты с малой стоимостью считаются выборкой из распределения хороших раскладок,
  // выше ставим тех, кто в среднем ближе по рамкам (IoU) к остальным; это снижает риск экзотического выброса.
  const top = ok.slice(0, 80);
  const cmin = top.length ? top[0].cost : 0;
  const wts = top.map((e) => Math.exp(-(e.cost - cmin) / 0.6));
  const wsum = wts.reduce((a, b) => a + b, 0) || 1;
  top.forEach((e, i) => {
    let eiou = 0;
    top.forEach((o, j) => { eiou += wts[j] * meanIou(e.c, o.c, ctx); });
    e.eiou = eiou / wsum;
    e.rank = e.cost - CONSENSUS * e.eiou;
  });
  ok.splice(0, top.length, ...top.sort((a, b) => a.rank - b.rank));
  const variants = pickDiverse(ok, ctx, kVar);
  // Порядок первых четырёх: первым вариант, ближайший по рамкам (IoU) к остальным трём (медоид), дальше как был.
  if (variants.length > 2) {
    const h = variants.slice(0, 4);
    const m = h.map((a) => h.reduce((t, b) => t + (a === b ? 0 : meanIou(a.c, b.c, ctx)), 0));
    const k = m.indexOf(Math.max(...m));
    if (k > 0) { const [x] = h.splice(k, 1); h.unshift(x); variants.splice(0, h.length, ...h); }
  }
  return { ok, variants };
}

// items: [{ id, key, state, w, h }] в порядке важности (первый - герой), w, h в единицах выбранного размера.
// opts: { W, H, layout: 'cluster' | 'offset' | 'title', seed, size: 'L' | 'S', templates? }
// Возвращает { scale, placed: [{ id, key, x, y, w, h, z, state? }], size, warnings }.
function computeLayout(items, opts) {
  const warnings = [];
  const seed = Math.max(0, Math.floor(opts.seed || 0));
  const round = Math.floor(seed / 4), kVar = Math.min(16, 4 * (round + 1)), variant = seed % kVar;
  const size = opts.size === 'S' ? 'S' : 'L';
  const templates = opts.templates || TEMPLATES_DATA.templates;
  if (items.length > 5) {
    warnings.push(`больше 5 объектов, оставил 5 (${items.slice(0, 5).map((i) => i.key).join(', ')})`);
    items = items.slice(0, 5);
  }
  if (!items.length) return { scale: 1, placed: [], size, warnings };
  const o = { ...opts, layout: opts.layout || 'cluster' };

  // 1. текущий размер, масштаб 1.0; 2. другой размер; 3. масштаб больше 1.0 как крайняя мера; 4. наименьшее нарушение
  const attempts = [];
  const other = size === 'L' ? 'S' : 'L';
  const conv = (sz) => (sz === size ? 1 : (sz === 'L' ? 2 : 0.5)); // S = ровно 0.5 от L
  const itemsFor = (sz) => items.map((it) => ({ ...it, w: it.w * conv(sz), h: it.h * conv(sz) }));
  attempts.push({ sz: size, f: 1 });
  attempts.push({ sz: other, f: 1 });
  // масштаб больше 1.0 убран: всегда 1:1, как у дизайнера.
  // Последняя попытка: порог покрытия снижен до 90% достижимого при 1:1 (сцены только из мелких объектов).
  const relaxAttempts = [{ sz: 'L', f: 1, relax: true }];
  if (size === 'S') relaxAttempts.push({ sz: 'S', f: 1, relax: true });
  let res = null, used = null, first = null;
  const tryAttempts = (list) => {
    for (const a of list) {
      const its = itemsFor(a.sz);
      const r = solve(its, { ...o, size: a.sz, relaxCov: !!a.relax }, a.sz === 'S' ? 2 : 1, a.f, templates, kVar);
      if (!first) first = { ...r, sz: a.sz, f: a.f, its };
      if (r.variants.length) { res = r; used = { ...a, its }; return; }
    }
  };
  tryAttempts(attempts);
  let offsetFb = null;
  if (!res && o.layout === 'title') {
    // title не сложился (например книга 1446 px в квадрате 1000 не помещается вне зоны заголовка, или телефон и пазл не умещаются
    // правее заголовка без пересечения оснований, P2): запасной путь offset. Берём его, если он собрался без ослабления покрытия.
    offsetFb = computeLayout(items, { ...opts, layout: 'offset' });
    offsetFb.warnings.unshift('для заголовка не нашлось раскладки без наложения на текст, собрал в стиле offset: заголовок придётся ставить поверх или сместить');
    if (!offsetFb.warnings.some((w) => w.includes('объектов мало') || w.includes('не удалось выдержать'))) return { ...offsetFb, warnings: warnings.concat(offsetFb.warnings) };
  }
  if (!res) tryAttempts(relaxAttempts);
  if (!res && offsetFb) return { ...offsetFb, warnings: warnings.concat(offsetFb.warnings) };
  if (!res) {
    // не нашлось раскладки, проходящей пороги: отдаём ближайшую с предупреждением
    const r = first;
    const cand = r.nearest;
    const ctx = r.ctx;
    const fin = finalize({ c: cand.c }, ctx, o.W, o.H);
    const why = fin.sc;
    warnings.push(`не удалось выдержать все правила композиции для этого набора и кадра (покрытие ${why.cov.toFixed(2)}, нарушение ${why.viol.toFixed(2)})`);
    return pack(items, fin.real, fin.z, ctx, 1, r.sz, warnings, o);
  }
  const v = res.variants[variant % res.variants.length];
  if (o.debug) o.debug.picked = res.variants.map((x) => ({ cost: +x.cost.toFixed(3), ...x.c.meta }));
  if (used.sz !== size) warnings.push(`для этого набора и кадра лучше размер ${used.sz}: в ${size} не удаётся набрать плотность кадра`);
  if (used.relax) warnings.push('объектов мало для такого кадра: при масштабе 1:1 кадр заполнен слабее, чем у дизайнера; добавьте объект или уменьшите кадр');
  if (used.f !== 1) warnings.push(`объекты малы для кадра ${o.W} x ${o.H}: масштаб ${used.f} вместо 1.0 (последняя мера)`);
  return pack(items, v.fin.real, v.fin.z, res.ctx, used.f, used.sz, warnings, o);
}

function pack(items, real, z, ctx, f, sz, warnings, o) {
  const placed = items.map((it, i) => {
    const p = { id: it.id, key: it.key, x: real[i].x, y: real[i].y, w: real[i].w, h: real[i].h, z: z[i] };
    if (ctx.overrides[i]) p.state = ctx.overrides[i];
    return p;
  }).sort((a, b) => a.z - b.z);
  const out = { scale: f, placed, size: sz, warnings };
  if (o.layout === 'title') out.titleZone = titleGeom(o.W, o.H).zone; // куда code.js ставит текст заголовка
  return out;
}

if (typeof module !== 'undefined') module.exports = { computeLayout, OBJ_META, roleOf, TEMPLATES_DATA };
