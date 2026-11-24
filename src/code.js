// Сборщик иллюстраций: плагин Figma. Библиотека объектов читается прямо из файла,
// объекты клонируются (их векторы не меняются), перекраска идёт по слотам палитры.
// computeLayout подключается сборкой из layout.js.

figma.showUI(__html__, { width: 360, height: 680, themeColors: true });

// ---------- Цвета ----------
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};
const dist = (a, b) => {
  const x = rgb(a), y = rgb(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b) * 255;
};

// Слоты палитры: 3 цвета фона, тёмный, 3 цвета объектов, светлый.
// Порядок совпадает с образцами в файле (левая колонка - фон, правая - объекты).
const SLOTS = ['bg1', 'bg2', 'bg3', 'ink', 'obj1', 'obj2', 'obj3', 'paper'];
const BG_SLOTS = ['bg1', 'bg2', 'bg3', 'ink', 'paper'];

function paletteName(bg1) {
  const { r, g, b } = rgb(bg1);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
  }
  if (h >= 225 && h < 300) return 'Сиреневая';
  if (h >= 15 && h < 50) return 'Персиковая';
  if (h >= 140 && h < 200) return 'Мятная';
  if (h >= 300 || h < 15) return 'Розовая';
  if (h >= 50 && h < 140) return 'Зелёная';
  return 'Синяя';
}

// ---------- Индекс библиотеки ----------
// Известные имена слоёв. Объекты без понятного имени получают ключ obj_N,
// имя и смыслы для них даёт распознавание по картинке (Gemini).
const NAME_KEYS = {
  'книга': 'book', 'телефон': 'phone', 'пазлы': 'puzzle', 'пазл': 'puzzle', 'монета': 'coin',
  'наушники': 'headphones', 'лампа': 'lamp', 'кошелек': 'wallet', 'кошелёк': 'wallet',
  'ручка': 'pen', 'папка': 'folder', 'ваза': 'vase', 'цветы': 'vase',
};

const BUILTIN_TAGS = {
  book: { label: 'Книга', tags: ['знания', 'обучение', 'учёба', 'чтение', 'образование', 'курс', 'история', 'литература', 'опыт'] },
  phone: { label: 'Телефон', tags: ['смартфон', 'приложение', 'мобильный', 'связь', 'онлайн', 'соцсети', 'уведомления', 'сервис'] },
  puzzle: { label: 'Пазлы', tags: ['решение', 'задача', 'команда', 'сотрудничество', 'стратегия', 'логика', 'партнёрство', 'интеграция'] },
  coin: { label: 'Монета', tags: ['деньги', 'финансы', 'экономия', 'оплата', 'инвестиции', 'кэшбэк', 'цена', 'выгода'] },
  headphones: { label: 'Наушники', tags: ['музыка', 'подкаст', 'звук', 'аудио', 'поддержка', 'концентрация', 'слушать', 'отдых'] },
  lamp: { label: 'Лампа', tags: ['идея', 'свет', 'работа', 'рабочее место', 'вдохновение', 'озарение', 'ночь', 'продуктивность'] },
  vase: { label: 'Ваза с тюльпанами', tags: ['цветы', 'праздник', 'подарок', 'весна', '8 марта', 'забота', 'уют', 'поздравление'] },
  wallet: { label: 'Кошелёк', tags: ['деньги', 'бюджет', 'покупки', 'зарплата', 'накопления', 'расходы', 'оплата'] },
  pen: { label: 'Ручка', tags: ['подпись', 'договор', 'письмо', 'заметки', 'творчество', 'экзамен', 'запись'] },
  folder: { label: 'Папка', tags: ['документы', 'архив', 'офис', 'отчёт', 'бумаги', 'организация', 'дела'] },
};

let LIB = null; // { sizes: { L: {...}, S: {...} }, palettes: [...], objects: {key: {...}} }

const isSwatchGroup = (n) => n.type === 'GROUP' && n.children.length === 8 && n.children.every((c) => c.type === 'RECTANGLE');

function readSwatches(group) {
  const rects = group.children.map((r) => ({ x: r.x, y: r.y, c: hex(r.fills[0].color) }));
  const minX = Math.min(...rects.map((r) => r.x));
  const left = rects.filter((r) => Math.abs(r.x - minX) < 1).sort((a, b) => a.y - b.y);
  const right = rects.filter((r) => Math.abs(r.x - minX) >= 1).sort((a, b) => a.y - b.y);
  const cols = [...left, ...right].map((r) => r.c);
  const p = {};
  SLOTS.forEach((s, i) => { p[s] = cols[i]; });
  return p;
}

const box = (n) => n.absoluteBoundingBox || { x: n.x, y: n.y, width: n.width, height: n.height };

// Сопоставление объектов двух размеров.
// Шаги: имя слоя -> форма среди именованных (порог 0.3) -> пара безымянных между секциями ->
// ключ из каталога, если не найден ровно один. entry: { id, w, h, leaves, state, nameKey }.
// Возвращает { res: { id: { key, how } }, k }; key = '@<id объекта ref>' для пары безымянных, null если не нашли.
const MATCH_THRESHOLD = 0.3;
const CATALOG = [...new Set(Object.values(NAME_KEYS))];

function matchKeys(ref, cand) {
  const byKey = {};
  for (const r of ref) if (r.nameKey) byKey[r.nameKey + '|' + r.state] = r;
  const ratios = cand.filter((c) => c.nameKey && byKey[c.nameKey + '|' + c.state]).map((c) => c.w / byKey[c.nameKey + '|' + c.state].w).sort((a, b) => a - b);
  const k = ratios.length ? (ratios.length % 2 ? ratios[(ratios.length - 1) / 2] : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2) : 0.5;
  const res = {};
  for (const c of cand) {
    if (c.nameKey) { res[c.id] = { key: c.nameKey, how: 'name' }; continue; }
    const dist = (r) => {
      const dAspect = Math.abs(c.w / c.h - r.w / r.h) / (r.w / r.h);
      const dSize = Math.abs(c.w / (r.w * k) - 1);
      const dLeaves = Math.abs(c.leaves - r.leaves) / Math.max(c.leaves, r.leaves);
      return dAspect * 3 + dSize + dLeaves * 0.5;
    };
    const same = ref.filter((r) => r.state === c.state);
    const best = (list) => list.map((r) => ({ d: dist(r), r })).sort((a, b) => a.d - b.d)[0];
    const named = best(same.filter((r) => r.nameKey));
    if (named && named.d < MATCH_THRESHOLD) { res[c.id] = { key: named.r.nameKey, how: 'форма ' + named.d.toFixed(3) }; continue; }
    const unnamed = best(same.filter((r) => !r.nameKey));
    if (unnamed && unnamed.d < MATCH_THRESHOLD) res[c.id] = { key: '@' + unnamed.r.id, how: 'пара безымянных ' + unnamed.d.toFixed(3) };
    else res[c.id] = { key: null, how: 'нет совпадения' };
  }
  // Ключ из каталога, если ровно один ключ не найден ни по имени, ни по форме.
  const found = new Set([...ref.filter((r) => r.nameKey).map((r) => r.nameKey), ...Object.values(res).map((v) => v.key).filter((x) => x && !x.startsWith('@'))]);
  const left = CATALOG.filter((x) => !found.has(x));
  for (const id of Object.keys(res)) {
    const v = res[id];
    if ((v.key === null || v.key.startsWith('@')) && left.length === 1) res[id] = { key: left[0], how: v.how + ' + каталог' };
  }
  return { res, k };
}

async function indexLibrary() {
  await figma.loadAllPagesAsync();
  const stored = JSON.parse(figma.root.getPluginData('tags') || '{}');
  const lib = { sizes: {}, palettes: [], objects: {}, problems: [] };
  const paletteByBg = {};
  const entriesBySize = {};
  const keyOfName = (name) => NAME_KEYS[name.trim().toLowerCase()] || null;

  for (const page of figma.root.children) {
    for (const sec of page.children) {
      const m = sec.type === 'SECTION' && sec.name.match(/Размер\s*([LS])\b/i);
      if (!m) continue;
      const size = m[1].toUpperCase();
      const size_ = { section: sec.id, decor: {}, objects: {} };
      lib.sizes[size] = size_;

      // Палитры и фоны.
      for (const n of sec.children) {
        if (isSwatchGroup(n)) {
          const p = readSwatches(n);
          if (!paletteByBg[p.bg1]) {
            paletteByBg[p.bg1] = { id: 'p' + lib.palettes.length, name: paletteName(p.bg1), colors: p, builtin: true };
            lib.palettes.push(paletteByBg[p.bg1]);
          }
        }
      }
      for (const n of sec.children) {
        if (n.type === 'FRAME' && /фон/i.test(n.name) && n.fills && n.fills[0] && n.fills[0].type === 'SOLID') {
          size_.decor[hex(n.fills[0].color)] = n.id;
        }
      }

      // Граница "Главные / Фоновые" по заголовку.
      const bgTitle = sec.children.find((n) => n.type === 'TEXT' && /фонов/i.test(n.characters));
      const splitY = bgTitle ? bgTitle.y : Infinity;

      const groups = sec.children.filter((n) => n.type === 'GROUP' && !isSwatchGroup(n));
      const strays = sec.children.filter((n) => ['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'RECTANGLE', 'STAR', 'POLYGON', 'LINE'].includes(n.type));

      const entries = groups.map((g) => ({
        node: g, id: g.id, w: g.width, h: g.height, state: g.y > splitY ? 'bg' : 'main', extras: [],
        nameKey: keyOfName(g.name), leaves: g.findAll((x) => !('children' in x)).length, key: null,
      }));
      // Оторванные детали: приклеиваем к объекту, внутри которого они лежат.
      for (const st of strays) {
        const b = box(st), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const host = entries.find((e) => {
          const eb = box(e.node);
          return cx >= eb.x && cx <= eb.x + eb.width && cy >= eb.y && cy <= eb.y + eb.height;
        });
        if (host) { host.extras.push(st.id); lib.problems.push(`${size}: деталь "${st.name}" лежала вне группы "${host.node.name}", приклеена к ней`); }
      }
      entriesBySize[size] = entries;
    }
  }

  // Ключи объектов. L - опорный размер (там больше имён), S сопоставляется с ним по имени и форме,
  // потом безымянные из L ищутся по уже опознанным в S (так ваза получает ключ в обоих размерах).
  const L_ = entriesBySize.L || [], S_ = entriesBySize.S || [];
  const apply = (entries, res, onPair) => {
    for (const e of entries) {
      const v = res[e.id];
      if (!v || !v.key) continue;
      if (v.key.startsWith('@')) onPair(e, v.key.slice(1)); else e.key = v.key;
    }
  };
  const pairedTo = {}; // id безымянного объекта S -> id безымянного объекта L
  if (L_.length && S_.length) {
    apply(S_, matchKeys(L_, S_).res, (e, refId) => { pairedTo[e.id] = refId; });
    apply(L_, matchKeys(S_.map((e) => ({ ...e, nameKey: e.key || e.nameKey })), L_).res, () => {});
  } else {
    for (const e of [...L_, ...S_]) e.key = e.nameKey;
  }
  let unnamed = 0;
  for (const e of L_.length ? L_ : S_) {
    if (e.key) continue;
    e.key = stored['@' + e.id] || 'obj_' + (++unnamed);
    lib.problems.push(`${L_.length ? 'L' : 'S'}: объект без имени "${e.node.name}" (${e.id}) получил ключ ${e.key}`);
  }
  for (const e of S_) {
    if (e.key) continue;
    const mate = L_.find((x) => x.id === pairedTo[e.id]);
    e.key = (mate && mate.key) || stored['@' + e.id] || 'obj_' + (++unnamed);
    lib.problems.push(`S: объект без имени "${e.node.name}" (${e.id}) получил ключ ${e.key}`);
  }

  // Пары "главный - фоновый" по ключу, записи в индекс.
  for (const size of Object.keys(entriesBySize)) {
    const entries = entriesBySize[size], size_ = lib.sizes[size];
    for (const a of entries.filter((e) => e.state === 'main')) {
      const b = entries.find((e) => e.state === 'bg' && e.key === a.key) || null;
      size_.objects[a.key] = {
        main: { id: a.id, extras: a.extras, w: a.w, h: a.h },
        bg: b ? { id: b.id, extras: b.extras, w: b.w, h: b.h } : null,
        sourceName: a.node.name,
      };
      if (!lib.objects[a.key]) {
        const t = stored[a.key] || BUILTIN_TAGS[a.key] || { label: a.node.name, tags: [] };
        lib.objects[a.key] = { key: a.key, label: t.label, tags: t.tags, needsTags: !t.tags.length, previewId: a.id };
      }
    }
  }

  // Исходная палитра объектов: та, чьи цвета чаще всего встречаются в главных объектах.
  const counts = {};
  const anySize = lib.sizes.L || lib.sizes.S;
  if (anySize) {
    for (const o of Object.values(anySize.objects)) {
      const n = await figma.getNodeByIdAsync(o.main.id);
      n.findAll((x) => {
        if (Array.isArray(x.fills)) x.fills.forEach((p) => { if (p.type === 'SOLID') counts[hex(p.color)] = (counts[hex(p.color)] || 0) + 1; });
        return false;
      });
    }
  }
  let best = null, bestScore = -1;
  for (const p of lib.palettes) {
    const score = SLOTS.reduce((s, k) => s + (counts[p.colors[k]] || 0), 0);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  lib.source = best ? best.id : null;

  // Пользовательские палитры из файла.
  const custom = JSON.parse(figma.root.getPluginData('palettes') || '[]');
  custom.forEach((p) => lib.palettes.push({ ...p, builtin: false }));

  LIB = lib;
  return lib;
}

const paletteById = (id) => LIB.palettes.find((p) => p.id === id);

// ---------- Перекраска ----------
// Таблица "цвет -> слот" из исходной палитры. Цвет вне палитры идёт в ближайший слот,
// причём у фоновых объектов только в слоты фона (правило: цвета объектов в фонах нельзя).
function buildColorMap(from, to, state) {
  const map = {};
  for (const s of SLOTS) map[from.colors[s]] = to.colors[s];
  // Совпадающие цвета (например, белый и тёмный одинаковы во всех схемах) не ломают таблицу.
  const allowed = state === 'bg' ? BG_SLOTS : SLOTS;
  return (c) => {
    if (map[c] && (state !== 'bg' || BG_SLOTS.some((s) => from.colors[s] === c))) return map[c];
    let bestSlot = allowed[0], d = Infinity;
    for (const s of allowed) {
      const dd = dist(c, from.colors[s]);
      if (dd < d) { d = dd; bestSlot = s; }
    }
    return to.colors[bestSlot];
  };
}

// Точечные правки слотов, как у дизайнера (сверка с кадрами дизайнера). Лист = индекс в порядке
// findAll(() => true) внутри группы объекта; объект и лист узнаются по числу узлов и пропорциям, масштаб не важен.
//  R1: пазл, просвет между деталями (листья 45, 50, 51): в библиотеке белый, у дизайнера слот bg1.
//  R2: фоновые лампа (лист 1) и ваза (лист 6): вторая тень в библиотеке bg3, у дизайнера bg2 (светлее).
const LEAF_SLOT_FIXES = [
  { n: 57, aspect: 544 / 314, state: null, slot: 'bg1', leaves: [[45, 1.591], [50, 3.037], [51, 1.309]] },
  { n: 27, aspect: 946 / 1129, state: 'bg', slot: 'bg2', leaves: [[1, 1.728]] },
  { n: 135, aspect: 591 / 747, state: 'bg', slot: 'bg2', leaves: [[6, 1.431]] },
];

// Узлы в порядке findAll (обход в глубину, без корня), но своим обходом: findAll на свежем клоне вешал плагин.
function descendants(node) {
  const out = [], stack = 'children' in node ? [...node.children].reverse() : [];
  while (stack.length) {
    const n = stack.pop();
    out.push(n);
    if ('children' in n) for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
  }
  return out;
}

function fixLeafSlots(node, state, target) {
  if (!('children' in node)) return;
  const ns = descendants(node);
  for (const r of LEAF_SLOT_FIXES) {
    if (ns.length !== r.n || (r.state && r.state !== state) || Math.abs(node.width / node.height - r.aspect) > 0.03 * r.aspect) continue;
    for (const [i, asp] of r.leaves) {
      const l = ns[i];
      if (!l || !Array.isArray(l.fills) || !l.fills.length || Math.abs(l.width / l.height - asp) > 0.05 * asp) continue;
      l.fills = l.fills.map((p) => (p.type === 'SOLID' ? { ...p, color: rgb(target.colors[r.slot]) } : p));
    }
  }
}

// Обход своим descendants: у одиночного вектора (кусочек декора прямо в кадре) нет findAll, отсюда было "not a function"
// при перекраске: падало на нижнем слое декора, фон уже перекрашен, объекты нет.
function recolorNode(root, mapFn, stats) {
  const nodes = descendants(root);
  nodes.push(root);
  for (const n of nodes) {
    for (const prop of ['fills', 'strokes']) {
      if (!(prop in n) || !Array.isArray(n[prop]) || n[prop].length === 0) continue;
      let changed = false;
      const next = n[prop].map((p) => {
        if (p.type !== 'SOLID') return p;
        const c = hex(p.color), t = mapFn(c);
        if (stats) stats[c] = t;
        if (t === c) return p;
        changed = true;
        return { ...p, color: rgb(t) };
      });
      if (changed) n[prop] = next;
    }
  }
}

// ---------- Сборка ----------
function freeSpot(w, h) {
  const kids = figma.currentPage.children;
  if (!kids.length) return { x: 0, y: 0 };
  let maxX = -Infinity, minY = Infinity;
  for (const k of kids) { maxX = Math.max(maxX, k.x + k.width); minY = Math.min(minY, k.y); }
  return { x: maxX + 200, y: minY };
}

async function cloneObject(ref, parent) {
  const node = await figma.getNodeByIdAsync(ref.id);
  const parts = [node.clone()];
  for (const id of ref.extras || []) {
    const e = await figma.getNodeByIdAsync(id);
    if (e) parts.push(e.clone());
  }
  parts.forEach((p) => parent.appendChild(p));
  if (parts.length === 1) return parts[0];
  const g = figma.group(parts, parent);
  g.name = node.name;
  return g;
}

const LAYOUT_NAMES = { cluster: 'Собранно', offset: 'Со смещением', title: 'Под заголовок' };

// Размер библиотеки: пользователь выбрал L или S явно - берём его, иначе правило из контракта:
// маленький кадр (меньшая сторона < 600) или 4+ объектов - S, иначе L. Масштаб объектов не подгоняется.
const isExplicitSize = (s) => s === 'L' || s === 'S';
function autoSize(W, H, n) { return (Math.min(W, H) < 600 || n >= 4) ? 'S' : 'L'; }

// Объекты сцены в единицах выбранного размера. Если в размере нет какого-то объекта, берём другой размер.
function sceneItems(spec, size) {
  const sizeLib = LIB.sizes[size];
  const items = [];
  for (const it of spec.items) {
    const o = sizeLib && sizeLib.objects[it.key];
    if (!o) continue;
    const ref = it.state === 'bg' && o.bg ? o.bg : o.main;
    items.push({ id: it.key + ':' + items.length, key: it.key, state: it.state === 'bg' && o.bg ? 'bg' : 'main', ref, w: ref.w, h: ref.h });
  }
  return items;
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Допустимая доля элемента декора под объектами. У дизайнера под объектами
// целиком скрыты 36 из 102 элементов, так что максимум и 95-й процентиль у него 1.0 и порогом быть не могут;
// берём 0.5: элемент виден хотя бы наполовину.
const DECOR_MAX_COVER = 0.5;
const COVER_GRID = 12;

// Лист объекта для проверки перекрытия: повёрнутый прямоугольник (обратная матрица узла в координатах кадра).
function coverLeaves(node, fb, acc) {
  if (node.visible === false) return acc;
  if ('children' in node && node.type !== 'BOOLEAN_OPERATION') { for (const ch of node.children) coverLeaves(ch, fb, acc); return acc; }
  const painted = Array.isArray(node.fills) && node.fills.some((p) => p.visible !== false && (p.opacity ?? 1) > 0);
  if (!painted) return acc;
  const m = node.absoluteTransform;
  const a = m[0][0], c = m[0][1], b = m[1][0], d = m[1][1], tx = m[0][2] - fb.x, ty = m[1][2] - fb.y;
  const det = a * d - b * c;
  if (det) acc.push({ ia: d / det, ic: -c / det, ib: -b / det, id: a / det, tx, ty, w: node.width, h: node.height });
  return acc;
}

// Доля точек элемента (сетка 12x12 в его локальных координатах, только точки внутри кадра), лежащих под листьями объектов.
// Возвращает { total, frac }; total 0 - элемент целиком вне кадра.
function decorCover(node, fb, W, H, leaves) {
  const m = node.absoluteTransform;
  const a = m[0][0], c = m[0][1], b = m[1][0], d = m[1][1], tx = m[0][2] - fb.x, ty = m[1][2] - fb.y;
  const w = node.width, h = node.height, rows = h > 0.5 ? COVER_GRID : 1;
  let total = 0, hit = 0;
  for (let i = 0; i < COVER_GRID; i++) {
    for (let j = 0; j < rows; j++) {
      const u = w * (i + 0.5) / COVER_GRID, v = rows > 1 ? h * (j + 0.5) / COVER_GRID : 0;
      const px = a * u + c * v + tx, py = b * u + d * v + ty;
      if (px < 0 || py < 0 || px > W || py > H) continue;
      total++;
      if (leaves.some((l) => {
        const dx = px - l.tx, dy = py - l.ty, lu = l.ia * dx + l.ic * dy, lv = l.ib * dx + l.id * dy;
        return lu >= -0.5 && lu <= l.w + 0.5 && lv >= -0.5 && lv <= l.h + 0.5;
      })) hit++;
    }
  }
  return { total, frac: total ? hit / total : 0 };
}

// Фоновый декор (конфетти, линии) в родном размере из фона нужной палитры и нужного размера (L или S):
// позиции центров пропорциональны кадру, размеры не меняются. Конфетти разбирается на кусочки. Элемент, чья рамка
// задевает монету или ручку или который больше чем на DECOR_MAX_COVER закрыт объектами, сдвигается в ближайшее
// подходящее место, а если такого нет - пропускается. Декор вставляется под объекты (на нижние слои кадра).
async function addDecor(frame, sizeLib, target, source, spec, keepOut, objNodes) {
  const decorId = sizeLib.decor[target.colors.bg1] || sizeLib.decor[source.colors.bg1];
  const decor = decorId && await figma.getNodeByIdAsync(decorId);
  const stat = { placed: 0, shifted: 0, skipped: 0 };
  if (!decor) return stat;
  const fb = frame.absoluteBoundingBox, db = decor.absoluteBoundingBox;
  const leaves = objNodes.flatMap((n) => coverLeaves(n, fb, []));
  const rel = (n) => { const b = n.absoluteBoundingBox; return { x: b.x - fb.x, y: b.y - fb.y, w: b.width, h: b.height }; };
  const STEPS = [30, 60, 100, 150, 220, 320, 450];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const pieces = [];
  for (const ch of decor.children) {
    if (ch.type === 'GROUP' && /конфетти/.test(ch.name) && ch.children.length) for (const p of ch.children) pieces.push({ n: p, name: ch.name + ' · ' + p.name });
    else pieces.push({ n: ch, name: ch.name });
  }
  let layer = 0; // декор идёт под объекты, в порядке исходника
  for (const { n: ch, name } of pieces) {
    const c = ch.clone();
    frame.insertChild(layer, c);
    c.name = 'Декор · ' + name;
    const cb = ch.absoluteBoundingBox;
    const tx = (cb.x + cb.width / 2 - db.x) / decor.width * spec.W, ty = (cb.y + cb.height / 2 - db.y) / decor.height * spec.H;
    const r0 = rel(c);
    c.x += tx - (r0.x + r0.w / 2);
    c.y += ty - (r0.y + r0.h / 2);
    const bad = () => {
      const r = rel(c);
      if (keepOut.some((o) => overlaps(r, o))) return true;
      const k = decorCover(c, fb, spec.W, spec.H, leaves);
      return k.total === 0 || k.frac > DECOR_MAX_COVER;
    };
    let ok = !bad();
    if (!ok) {
      const x0 = c.x, y0 = c.y;
      outer: for (const st of STEPS) {
        for (const [dx, dy] of DIRS) {
          c.x = x0 + dx * st; c.y = y0 + dy * st;
          const rr = rel(c), cx = rr.x + rr.w / 2, cy = rr.y + rr.h / 2;
          if (cx < 0 || cy < 0 || cx > spec.W || cy > spec.H) continue;
          if (!bad()) { ok = true; break outer; }
        }
      }
      if (ok) stat.shifted++; else { c.remove(); stat.skipped++; continue; }
    }
    layer++;
    stat.placed++;
    if (!sizeLib.decor[target.colors.bg1]) recolorNode(c, buildColorMap(source, target, 'bg'));
  }
  return stat;
}

// spec: { size: 'L' | 'S' | 'auto', W, H, layout, palette, items: [{ key, state }], decor, seed, x, y }
async function compose(spec) {
  const target = paletteById(spec.palette) || paletteById(LIB.source);
  const source = paletteById(LIB.source);
  const explicit = isExplicitSize(spec.size);
  let size = explicit ? spec.size : autoSize(spec.W, spec.H, spec.items.length);
  if (!LIB.sizes[size]) size = Object.keys(LIB.sizes)[0];

  let items = sceneItems(spec, size);
  if (items.length < spec.items.length) {
    // В выбранном размере нет части объектов: пробуем другой размер.
    const other = size === 'L' ? 'S' : 'L';
    const alt = LIB.sizes[other] ? sceneItems(spec, other) : [];
    if (alt.length > items.length) { size = other; items = alt; }
  }
  if (!items.length) throw new Error('Нет объектов для сборки');

  const layoutOpts = () => ({ W: spec.W, H: spec.H, layout: spec.layout, seed: spec.seed || 0, size });
  let lay = computeLayout(items, layoutOpts());
  // Раскладка может рекомендовать другой размер (4-5 объектов и т.п.): если размер не выбран явно, пересчитываем.
  if (!explicit && lay.size && lay.size !== size && LIB.sizes[lay.size]) {
    const alt = sceneItems(spec, lay.size);
    if (alt.length === items.length) { size = lay.size; items = alt; lay = computeLayout(items, layoutOpts()); }
  }
  const sizeLib = LIB.sizes[size];
  const warnings = [...(lay.warnings || [])];

  const frame = figma.createFrame();
  frame.name = `Иллюстрация · ${LAYOUT_NAMES[spec.layout] || spec.layout} · ${size} · ${spec.W} × ${spec.H}`;
  frame.resize(spec.W, spec.H);
  frame.fills = [{ type: 'SOLID', color: rgb(target.colors.bg1) }];
  frame.clipsContent = true;
  const spot = spec.x != null ? { x: spec.x, y: spec.y } : freeSpot(spec.W, spec.H);
  frame.x = spot.x; frame.y = spot.y;
  figma.currentPage.appendChild(frame);

  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  // Монета и ручка видны целиком, поверх них декор не кладём.
  const keepOut = lay.placed.filter((p) => byId[p.id] && (byId[p.id].key === 'coin' || byId[p.id].key === 'pen'))
    .map((p) => ({ x: p.x - 6, y: p.y - 6, w: p.w + 12, h: p.h + 12 }));
  const objNodes = [];
  // Порядок слоёв строго по placed[].z (0 снизу), своей пересортировки нет.
  const placed = [...lay.placed].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const p of placed) {
    const it = byId[p.id];
    if (!it) continue;
    // Раскладка может сменить состояние (крупный объект уходит в фоновый при 4-5 объектах).
    const o = sizeLib.objects[it.key];
    const state = p.state && p.state !== it.state && (p.state !== 'bg' || o.bg) ? p.state : it.state;
    const ref = state === 'bg' && o.bg ? o.bg : o.main;
    const node = await cloneObject(ref, frame);
    if (lay.scale !== 1) node.rescale(lay.scale);
    node.x = p.x; node.y = p.y;
    node.name = `${LIB.objects[it.key] ? LIB.objects[it.key].label : it.key} · ${state === 'bg' ? 'фоновый' : 'главный'}`;
    node.setPluginData('obj', JSON.stringify({ key: it.key, state, size, src: [ref.id, ...(ref.extras || [])] }));
    // Сначала листья в слот ИСХОДНОЙ палитры, потом общая перекраска переводит их в целевую
    // (запись после recolorNode роняла плагин).
    fixLeafSlots(node, state, source);
    if (target.id !== source.id) recolorNode(node, buildColorMap(source, target, state));
    objNodes.push(node);
  }
  // Декор кладём после объектов, чтобы знать, что именно его закрывает, и вставляем под них.
  let decorStat = null;
  if (spec.decor) decorStat = await addDecor(frame, sizeLib, target, source, spec, keepOut, objNodes);
  frame.setPluginData('composition', JSON.stringify({ ...spec, palette: target.id, sizeUsed: size, scale: lay.scale, warnings, decorStat }));
  return frame;
}

// Перекраска готовой композиции (или любого выделения) в другую палитру.
function detectPalette(frame) {
  const data = frame.getPluginData('composition');
  if (data) { const p = paletteById(JSON.parse(data).palette); if (p) return p; }
  if (frame.fills && frame.fills[0] && frame.fills[0].type === 'SOLID') {
    const c = hex(frame.fills[0].color);
    const p = LIB.palettes.find((q) => q.colors.bg1 === c);
    if (p) return p;
  }
  return paletteById(LIB.source);
}

function recolorFrame(frame, toId) {
  const from = detectPalette(frame), to = paletteById(toId);
  if (!to) throw new Error('Палитра не найдена');
  if (frame.type === 'FRAME') frame.fills = [{ type: 'SOLID', color: rgb(to.colors.bg1) }];
  for (const ch of frame.children || []) {
    const meta = ch.getPluginData('obj');
    const state = meta ? JSON.parse(meta).state : (ch.name.startsWith('Декор') ? 'bg' : 'main');
    if (meta) fixLeafSlots(ch, state, from);
    recolorNode(ch, buildColorMap(from, to, state));
  }
  const data = frame.getPluginData('composition');
  if (data) frame.setPluginData('composition', JSON.stringify({ ...JSON.parse(data), palette: to.id }));
}

// ---------- Сообщения UI ----------
function libSummary() {
  return {
    sizes: Object.keys(LIB.sizes),
    palettes: LIB.palettes.map((p) => ({ id: p.id, name: p.name, colors: p.colors, builtin: p.builtin })),
    source: LIB.source,
    objects: Object.values(LIB.objects).map((o) => ({
      key: o.key, label: o.label, tags: o.tags, needsTags: o.needsTags,
      hasBg: Object.values(LIB.sizes).some((s) => s.objects[o.key] && s.objects[o.key].bg),
    })),
    problems: LIB.problems,
  };
}

async function png(node, width) {
  const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: width } });
  return figma.base64Encode(bytes);
}

const selectedComposition = () => figma.currentPage.selection.find((n) => n.type === 'FRAME') || null;

// UI показывает, что перекрасится по клику на палитру: число выделенных кадров и их текущая палитра.
function selectionInfo() {
  const frames = figma.currentPage.selection.filter((n) => n.type === 'FRAME');
  const ids = [...new Set(frames.map((f) => { try { return detectPalette(f).id; } catch (e) { return null; } }))];
  return { type: 'selection', frames: frames.length, ours: frames.filter((f) => f.getPluginData('composition')).length, palette: ids.length === 1 ? ids[0] : null };
}
figma.on('selectionchange', () => { if (LIB) figma.ui.postMessage(selectionInfo()); });

figma.ui.onmessage = async (msg) => {
  const reply = (data) => figma.ui.postMessage({ reqId: msg.reqId, ...data });
  try {
    switch (msg.type) {
      case 'init': {
        await indexLibrary();
        const settings = (await figma.clientStorage.getAsync('settings')) || {};
        reply({ ok: true, lib: libSummary(), settings, selection: selectionInfo() });
        break;
      }
      case 'save-settings':
        await figma.clientStorage.setAsync('settings', msg.settings);
        reply({ ok: true });
        break;
      case 'compose': {
        // Несколько вариантов в ряд, превью для UI.
        const frames = [];
        let x = null, y = null;
        const total = msg.variants.length;
        const progress = (done, stage) => figma.ui.postMessage({ type: 'progress', reqId: msg.reqId, done, total, stage });
        for (let i = 0; i < total; i++) {
          progress(i, 'compose');
          // Отдаём управление между вариантами: UI успевает показать прогресс, окно не замирает целиком.
          await new Promise((r) => setTimeout(r, 0));
          const v = msg.variants[i];
          const f = await compose({ ...msg.spec, ...v, x, y });
          if (x == null) { x = f.x; y = f.y; }
          x = f.x + f.width + 80;
          frames.push(f);
        }
        figma.currentPage.selection = frames;
        figma.viewport.scrollAndZoomIntoView(frames);
        progress(total, 'previews');
        await new Promise((r) => setTimeout(r, 0));
        const previews = [];
        for (const f of frames) previews.push({ id: f.id, name: f.name, png: await png(f, 480) });
        reply({ ok: true, previews });
        break;
      }
      case 'keep': {
        for (const id of msg.remove) { const n = await figma.getNodeByIdAsync(id); if (n) n.remove(); }
        const k = await figma.getNodeByIdAsync(msg.keep);
        if (k) { figma.currentPage.selection = [k]; figma.viewport.scrollAndZoomIntoView([k]); }
        reply({ ok: true });
        break;
      }
      case 'recolor': {
        const sel = figma.currentPage.selection.filter((n) => n.type === 'FRAME');
        if (!sel.length) throw new Error('Выделите кадр с композицией');
        // Каждый кадр отдельно: ошибка в одном не мешает остальным.
        const failed = [];
        for (const f of sel) {
          try { recolorFrame(f, msg.palette); } catch (e) { failed.push(f.name + ': ' + String(e && e.message || e)); }
        }
        // Превью для окна: только те перекрашенные кадры, что сейчас показаны в вариантах.
        const refresh = new Set(msg.refresh || []);
        const previews = [];
        for (const f of sel) if (refresh.has(f.id)) previews.push({ id: f.id, png: await png(f, 480) });
        reply({ ok: true, count: sel.length - failed.length, failed, previews });
        break;
      }
      case 'export-svg': {
        const f = selectedComposition();
        if (!f) throw new Error('Выделите кадр с композицией');
        const bytes = await f.exportAsync({ format: 'SVG', svgIdAttribute: true, svgOutlineText: true });
        reply({ ok: true, name: f.name.replace(/[^\wа-яё ×.-]+/gi, '_') + '.svg', svg: decodeUtf8(bytes) });
        break;
      }
      case 'object-previews': {
        const out = [];
        for (const key of msg.keys) {
          const o = LIB.objects[key];
          const n = o && await figma.getNodeByIdAsync(o.previewId);
          if (n) out.push({ key, png: await png(n, 256) });
        }
        reply({ ok: true, previews: out });
        break;
      }
      case 'save-tags': {
        // Распознанные имена и смыслы храним в файле: увидят все, кто откроет плагин.
        const stored = JSON.parse(figma.root.getPluginData('tags') || '{}');
        for (const t of msg.tags) {
          const o = LIB.objects[t.key];
          if (!o) continue;
          const sizeEntry = Object.values(LIB.sizes).map((s) => s.objects[t.key]).find(Boolean);
          stored[t.key] = { label: t.label, tags: t.tags };
          if (sizeEntry && t.key.startsWith('obj_')) stored['@' + sizeEntry.main.id] = t.key;
          o.label = t.label; o.tags = t.tags; o.needsTags = false;
        }
        figma.root.setPluginData('tags', JSON.stringify(stored));
        reply({ ok: true, lib: libSummary() });
        break;
      }
      case 'add-palette': {
        const custom = JSON.parse(figma.root.getPluginData('palettes') || '[]');
        const p = { id: 'u' + Date.now(), name: msg.name || paletteName(msg.colors.bg1), colors: msg.colors };
        custom.push(p);
        figma.root.setPluginData('palettes', JSON.stringify(custom));
        LIB.palettes.push({ ...p, builtin: false });
        reply({ ok: true, lib: libSummary(), id: p.id });
        break;
      }
      case 'remove-palette': {
        const custom = JSON.parse(figma.root.getPluginData('palettes') || '[]').filter((p) => p.id !== msg.id);
        figma.root.setPluginData('palettes', JSON.stringify(custom));
        LIB.palettes = LIB.palettes.filter((p) => p.id !== msg.id);
        reply({ ok: true, lib: libSummary() });
        break;
      }
      case 'palette-from-selection': {
        // Палитра из 8 прямоугольников или из группы образцов, как в библиотеке.
        const sel = figma.currentPage.selection;
        const g = sel.find(isSwatchGroup);
        let colors = null;
        if (g) colors = readSwatches(g);
        else {
          const rects = sel.filter((n) => 'fills' in n && Array.isArray(n.fills) && n.fills[0] && n.fills[0].type === 'SOLID');
          if (rects.length === 8) {
            const fake = { children: rects.map((r) => ({ x: r.absoluteBoundingBox.x, y: r.absoluteBoundingBox.y, fills: r.fills })) };
            colors = readSwatches(fake);
          }
        }
        if (!colors) throw new Error('Выделите группу из 8 образцов (как палитры в библиотеке) или 8 прямоугольников');
        reply({ ok: true, colors });
        break;
      }
      default:
        reply({ ok: false, error: 'Неизвестная команда ' + msg.type });
    }
  } catch (e) {
    reply({ ok: false, error: String(e && e.message || e) });
  }
};

function decodeUtf8(bytes) {
  let out = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      out += String.fromCodePoint(cp);
    }
  }
  return out;
}
