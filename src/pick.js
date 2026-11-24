// Подбор объектов библиотеки. Чистые функции без Figma API и без сети: работают в UI плагина и в node.
// Сеть (fetch) делает вызывающий: здесь только построение запросов и разбор ответов.
//
// Сценарий 1 (метафора или заголовок): buildDecisionsRequest -> parseDecisionsResponse -> selectScene.
//   Запасной путь без сети: offlinePick. Запасной вариант на flash-lite: buildFlashRequest / parseFlashResponse.
// Сценарий 2 (названия объектов): matchNames.

// ---------- Каталог ----------
// Теги: смыслы объекта для подбора по заголовку. Исходно те же, что BUILTIN_TAGS в code.js; расширения только
// по ошибкам на настроечных 20 метафор, отложенные 20 для тегов не использовались.
// names: словарь синонимов и форм для сценария 2. Русские основы пишутся без окончания (окончания
// разбирает matchNames), английские формы целиком. Все слова в нижнем регистре и с "е" вместо "ё".
const CATALOG = {
  book: {
    label: 'Книга',
    tags: ['знания', 'обучение', 'учёба', 'чтение', 'образование', 'курс', 'история', 'литература', 'опыт'],
    stems: ['книг', 'книжк', 'учебник', 'томик', 'фолиант'],
    words: ['book', 'books', 'textbook', 'novel'],
  },
  phone: {
    label: 'Телефон',
    tags: ['смартфон', 'приложение', 'мобильный', 'связь', 'онлайн', 'соцсети', 'уведомления', 'сервис'],
    stems: ['телефон', 'смартфон', 'мобильник', 'мобильн', 'айфон', 'сотов', 'трубк', 'гаджет'],
    words: ['phone', 'phones', 'smartphone', 'mobile', 'iphone', 'cellphone'],
  },
  puzzle: {
    label: 'Пазлы',
    tags: ['решение', 'задача', 'команда', 'сотрудничество', 'стратегия', 'логика', 'партнёрство', 'интеграция'],
    stems: ['пазл', 'головоломк', 'мозаик', 'паззл'],
    words: ['puzzle', 'puzzles', 'jigsaw'],
  },
  coin: {
    label: 'Монета',
    tags: ['деньги', 'финансы', 'экономия', 'оплата', 'инвестиции', 'кэшбэк', 'цена', 'выгода'],
    stems: ['монет', 'монетк', 'копейк', 'пятак'],
    words: ['coin', 'coins', 'penny', 'money'],
  },
  headphones: {
    label: 'Наушники',
    tags: ['музыка', 'подкаст', 'звук', 'аудио', 'поддержка', 'концентрация', 'слушать', 'отдых'],
    stems: ['наушник', 'гарнитур'],
    words: ['headphones', 'headphone', 'earphones', 'headset', 'earbuds'],
  },
  lamp: {
    label: 'Лампа',
    tags: ['идея', 'свет', 'работа', 'рабочее место', 'вдохновение', 'озарение', 'ночь', 'продуктивность'],
    stems: ['ламп', 'лампочк', 'светильник', 'торшер', 'ночник'],
    words: ['lamp', 'lamps', 'light', 'bulb', 'lightbulb'],
  },
  vase: {
    label: 'Ваза с тюльпанами',
    tags: ['цветы', 'праздник', 'подарок', 'весна', '8 марта', 'забота', 'уют', 'поздравление'],
    stems: ['ваз', 'тюльпан', 'цвет', 'цветок', 'букет'],
    words: ['vase', 'vases', 'flower', 'flowers', 'tulip', 'tulips', 'bouquet'],
  },
  wallet: {
    label: 'Кошелёк',
    tags: ['деньги', 'бюджет', 'покупки', 'зарплата', 'накопления', 'расходы', 'оплата'],
    stems: ['кошелек', 'кошельк', 'портмоне', 'бумажник', 'кошелечек'],
    words: ['wallet', 'wallets', 'purse', 'billfold'],
  },
  pen: {
    label: 'Ручка',
    tags: ['подпись', 'договор', 'письмо', 'заметки', 'творчество', 'экзамен', 'запись'],
    stems: ['ручк', 'авторучк', 'перо', 'пера', 'пером'],
    words: ['pen', 'pens', 'ballpen', 'ballpoint'],
  },
  folder: {
    label: 'Папка',
    tags: ['документы', 'архив', 'офис', 'отчёт', 'бумаги', 'организация', 'дела'],
    stems: ['папк', 'досье', 'скоросшиватель', 'файл'],
    words: ['folder', 'folders', 'file', 'files', 'binder', 'dossier'],
  },
};

const LIB_KEYS = Object.keys(CATALOG);

// Объекты в формате, который ждут функции ниже: [{key, label, tags}]. В плагине их даёт библиотека
// (state.lib.objects), в node берутся из CATALOG.
function defaultObjects() {
  return LIB_KEYS.map((k) => ({ key: k, label: CATALOG[k].label, tags: CATALOG[k].tags }));
}

// ---------- Нормализация и расстояние ----------
function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Левенштейн с перестановкой соседних букв за 1 (опечатка "лмапа" это одна ошибка, не две).
function damerau(a, b) {
  const n = a.length; const m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d = [];
  for (let i = 0; i <= n; i++) { d[i] = [i]; }
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[n][m];
}

// ---------- Разбор ответа Gemini: защита от пустого и битого JSON ----------
function safeJson(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  if (!t) return null;
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(t); } catch (e) { /* ниже пробуем вырезать объект */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* битый */ }
  }
  return null;
}

// ---------- Отбор сцены ----------
// ranked: [{key, p}] от большего к меньшему. Герой первым, 2-3 объекта.
// Второй объект берётся всегда, третий только при p >= thirdMin. noFit: максимум ниже noFitBelow.
const DEFAULTS = {
  noFitBelow: 0.5, // maxP ниже этого: "в библиотеке нет подходящего"
  thirdMin: 0.15, // третий объект берётся при p не ниже
  secondMin: 0.0, // второй объект при p не ниже (0 = всегда)
  maxObjects: 3,
  fitWeight: 0, // вес вопроса "подходит ли" в ранжировании (режим choice+fit)
};

function selectScene(ranked, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const list = (ranked || []).filter((r) => r && r.key && isFinite(r.p)).sort((a, b) => b.p - a.p);
  if (!list.length) return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: 'пустой ответ' };
  const items = [list[0].key];
  if (list[1] && list[1].p >= o.secondMin) items.push(list[1].key);
  if (o.maxObjects >= 3 && list[2] && list[2].p >= o.thirdMin && items.length >= 2) items.push(list[2].key);
  // Минимум 2 объекта: если вероятности есть, но второй не прошёл порог, берём его всё равно.
  if (items.length < 2 && list[1]) items.push(list[1].key);
  const maxP = list[0].p;
  return { ok: true, items, hero: items[0], noFit: maxP < o.noFitBelow, maxP, ranked: list };
}

// ---------- Decisions API (один запрос на ввод) ----------
const DECISIONS_MODEL = 'gemini-decision-1';

// objects: [{key, label, tags}]. opts.withTags: добавлять смыслы объекта в описание варианта.
// opts.fit: добавить вопрос "подходит ли" по каждому объекту (всё равно один запрос).
function buildDecisionsRequest(text, objects, opts) {
  const o = Object.assign({ withTags: true, fit: false }, opts || {});
  const objs = (objects && objects.length ? objects : defaultObjects());
  const criteria = {};
  objs.forEach((ob) => {
    criteria[ob.key] = o.withTags && ob.tags && ob.tags.length ? `${ob.label}: ${ob.tags.slice(0, 10).join(', ')}` : ob.label;
  });
  const questions = {
    hero: {
      type: 'choice',
      instructions: 'Какой один предмет лучше всего передаёт главный смысл заголовка? Если смысл переносный, выбирай по образу, а не по буквальным словам.',
      criteria,
    },
  };
  if (o.fit) {
    objs.forEach((ob) => {
      questions['fit_' + ob.key] = { type: 'noul', instructions: `Подходит ли к этому заголовку иллюстрация с предметом "${ob.label}"? Его смыслы: ${(ob.tags || []).slice(0, 8).join(', ')}.` };
    });
  }
  return { model: DECISIONS_MODEL, input: `Заголовок или метафора для иллюстрации: ${String(text || '').trim()}`, questions };
}

// json: тело ответа Decisions ({answers: ...}) или уже готовое answers. Не бросает исключений.
function parseDecisionsResponse(json, objects, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  try {
    const ans = json && json.answers ? json.answers : json;
    if (!ans || typeof ans !== 'object') return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: 'пустой ответ' };
    const objs = (objects && objects.length ? objects : defaultObjects());
    const h = ans.hero;
    if (!h || typeof h !== 'object') return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: 'нет ответа hero' };
    const probs = h.probabilities && typeof h.probabilities === 'object' ? h.probabilities : (h.choice ? { [h.choice]: h.confidence || 1 } : {});
    const ranked = objs.map((ob) => {
      const pc = Number(probs[ob.key]) || 0;
      const f = ans['fit_' + ob.key];
      const pf = f && isFinite(f.noul) ? Number(f.noul) : 0;
      return { key: ob.key, p: pc + (o.fitWeight || 0) * pf, pChoice: pc, pFit: pf };
    });
    const scene = selectScene(ranked, o);
    // noFit считаем по вероятности выбора героя, а не по смешанному баллу
    const maxChoice = Math.max.apply(null, ranked.map((r) => r.pChoice));
    scene.noFit = !(maxChoice >= o.noFitBelow);
    scene.maxP = maxChoice;
    if (h.choice && scene.items[0] !== h.choice && !(o.fitWeight > 0) && ranked.find((r) => r.key === h.choice)) {
      scene.items = [h.choice].concat(scene.items.filter((k) => k !== h.choice)).slice(0, o.maxObjects);
      scene.hero = h.choice;
    }
    return scene;
  } catch (e) {
    return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: String(e && e.message || e) };
  }
}

// ---------- flash-lite с JSON (запасной вариант) ----------
const FLASH_MODEL = 'gemini-3.5-flash-lite';

function buildFlashRequest(text, objects) {
  const objs = (objects && objects.length ? objects : defaultObjects());
  const list = objs.map((ob) => `- ${ob.key} (${ob.label}): ${(ob.tags || []).slice(0, 10).join(', ')}`).join('\n');
  const prompt = [
    'Ты арт-директор векторных иллюстраций. Подбери 2 или 3 объекта из фиксированной библиотеки, которые лучше всего иллюстрируют заголовок или метафору статьи на русском.',
    'Используй ТОЛЬКО эти ключи:',
    list,
    'Первым в списке идёт герой: предмет, который передаёт главный смысл. Если смысл переносный, выбирай по образу. Остальные объекты дополняют сцену и не должны противоречить смыслу.',
    'Если в библиотеке нет объекта, который действительно подходит к теме (спорт, природа, ИИ и т.п.), поставь confidence "low" и выбери ближайшие по смыслу. Иначе confidence "high" или "medium".',
    `Заголовок: ${String(text || '').trim()}`,
    'Ответ строго JSON: {"objects":["ключ_героя","ключ","ключ"],"confidence":"high|medium|low"}',
  ].join('\n');
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };
}

// Ответ generateContent целиком или уже строка текста.
function parseFlashResponse(resp, objects) {
  try {
    const objs = (objects && objects.length ? objects : defaultObjects());
    const keys = new Set(objs.map((o) => o.key));
    let text = resp;
    if (resp && typeof resp === 'object') {
      const parts = resp.candidates && resp.candidates[0] && resp.candidates[0].content && resp.candidates[0].content.parts;
      text = (parts || []).map((p) => p.text || '').join('');
    }
    const j = safeJson(text);
    if (!j) return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: 'пустой или битый JSON' };
    const arr = Array.isArray(j) ? j : (j.objects || j.items || []);
    const items = [];
    (Array.isArray(arr) ? arr : []).forEach((k) => { const key = normalize(String(k)).replace(/\s+/g, ''); if (keys.has(key) && !items.includes(key)) items.push(key); });
    if (!items.length) return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: 'нет известных ключей' };
    const conf = String(j.confidence || '').toLowerCase();
    return { ok: true, items: items.slice(0, 3), hero: items[0], noFit: conf === 'low', maxP: conf === 'high' ? 1 : conf === 'medium' ? 0.6 : 0.2 };
  } catch (e) {
    return { ok: false, items: [], hero: null, noFit: true, maxP: 0, error: String(e && e.message || e) };
  }
}

// ---------- Офлайн по тегам ----------
const TAG_ENDINGS = /(ами|ями|ого|его|ому|ему|ыми|ими|ой|ей|ом|ем|ам|ям|ах|ях|ов|ев|ых|их|ую|юю|ая|яя|ое|ее|ые|ие|ий|ый|ов|а|я|у|ю|ы|и|е|о|ь)$/;
function stemWord(w) {
  let s = normalize(w);
  if (s.length > 5) s = s.replace(TAG_ENDINGS, '');
  return s.length > 5 ? s.slice(0, 5) : s;
}

function offlinePick(text, objects, opts) {
  const o = Object.assign({ maxObjects: 3, minScore: 1 }, opts || {});
  const objs = (objects && objects.length ? objects : defaultObjects());
  const words = normalize(text).split(' ').filter((w) => w.length >= 3);
  const stems = words.map(stemWord);
  const scored = objs.map((ob) => {
    const tagStems = new Set();
    (ob.tags || []).concat([ob.label]).forEach((t) => normalize(t).split(' ').filter((w) => w.length >= 3).forEach((w) => tagStems.add(stemWord(w))));
    let score = 0;
    stems.forEach((s) => { if (tagStems.has(s)) score += 1; });
    return { key: ob.key, p: score };
  }).sort((a, b) => b.p - a.p);
  if (!scored[0] || scored[0].p < o.minScore) {
    // Совпадений нет: нейтральная пара из тех, что дизайнер использует как фон и опору.
    return { ok: true, items: ['book', 'lamp'], hero: 'book', noFit: true, maxP: 0, offline: true };
  }
  const items = scored.filter((s) => s.p >= o.minScore).slice(0, o.maxObjects).map((s) => s.key);
  if (items.length < 2) { const extra = scored.find((s) => !items.includes(s.key)); if (extra) items.push(extra.key); }
  return { ok: true, items, hero: items[0], noFit: false, maxP: scored[0].p, offline: true };
}

// ---------- Сценарий 2: сопоставление имён ----------
const NAME_SUFFIXES = new Set(['', 'а', 'я', 'у', 'ю', 'ы', 'и', 'е', 'о', 'ь', 'ой', 'ей', 'ою', 'ом', 'ем', 'ам', 'ям', 'ами', 'ями', 'ах', 'ях', 'ов', 'ев', 'ек', 'ок', 'ка', 'ки', 'ку', 'кой', 'ке', 'ик', 'ики', 'иков', 's', 'es']);
const STOP_WORDS = new Set(['и', 'а', 'с', 'со', 'в', 'во', 'на', 'к', 'по', 'из', 'для', 'или', 'ещё', 'еще', 'плюс', 'добавь', 'добавить', 'нужно', 'нужны', 'нужен', 'хочу', 'мне', 'надо', 'сделай', 'собери', 'там', 'тут', 'ещe', 'the', 'a', 'an', 'and', 'with', 'of', 'on', 'in', 'to', 'plus', 'или', 'мой', 'моя', 'мои', 'один', 'одна', 'два', 'две', 'три', 'сцену', 'сцена', 'композицию', 'композиция', 'объект', 'объекты', 'предмет', 'предметы']);

// Таблица: слово -> ключ. Строится из CATALOG один раз.
const STEM_INDEX = [];
LIB_KEYS.forEach((k) => {
  CATALOG[k].stems.forEach((s) => STEM_INDEX.push({ stem: normalize(s), key: k }));
});
const WORD_INDEX = {};
LIB_KEYS.forEach((k) => {
  CATALOG[k].words.forEach((w) => { WORD_INDEX[normalize(w)] = k; });
  WORD_INDEX[normalize(CATALOG[k].label.split(' ')[0])] = k;
});
// Для близкого сравнения (опечатки): целые слова и основы длиной от 5 букв.
const FUZZY_FORMS = [];
LIB_KEYS.forEach((k) => {
  const forms = new Set();
  CATALOG[k].words.forEach((w) => forms.add(normalize(w)));
  CATALOG[k].stems.forEach((s) => { forms.add(normalize(s)); forms.add(normalize(s) + 'а'); });
  forms.add(normalize(CATALOG[k].label.split(' ')[0]));
  forms.forEach((f) => { if (f.length >= 4) FUZZY_FORMS.push({ form: f, key: k }); });
});

function matchWord(w) {
  if (WORD_INDEX[w]) return WORD_INDEX[w];
  for (const e of STEM_INDEX) {
    if (w.startsWith(e.stem) && NAME_SUFFIXES.has(w.slice(e.stem.length))) return e.key;
  }
  if (w.length >= 5) {
    // Опечатки: расстояние Левенштейна (перестановка соседних букв за 1) до 2 для слов от 7 букв и до 1 для слов из 5-6 букв
    // (до 2 на коротких слова давали ложные срабатывания: кружка -> книжка, рамка -> ручка), первая буква совпадает.
    // Слово сравниваем целиком и без последних 1-3 букв (падежное окончание) с основой.
    let best = 99; let bestKeys = new Set();
    for (const f of FUZZY_FORMS) {
      if (f.form[0] !== w[0]) continue;
      for (let cut = 0; cut <= 3; cut++) {
        const cand = w.slice(0, w.length - cut);
        if (cand.length < 6 && cut > 0) break;
        const d = damerau(cand, f.form);
        const lim = cut === 0 ? (w.length >= 7 ? 2 : 1) : 1;
        if (d <= lim && f.form.length >= 4) {
          if (d < best) { best = d; bestKeys = new Set([f.key]); } else if (d === best) bestKeys.add(f.key);
        }
      }
    }
    if (best <= 2 && bestKeys.size === 1) return [...bestKeys][0];
  }
  return null;
}

// Ввод пользователя -> {keys: [ключи в порядке ввода, без повторов], unknown: [слова без объекта]}.
function matchNames(text) {
  const words = normalize(text).split(' ').filter(Boolean);
  const keys = []; const unknown = [];
  words.forEach((w) => {
    if (STOP_WORDS.has(w)) return;
    const k = matchWord(w);
    if (k) { if (!keys.includes(k)) keys.push(k); } else if (w.length >= 3) unknown.push(w);
  });
  return { keys, unknown };
}

const _exports = {
  CATALOG, LIB_KEYS, DEFAULTS, defaultObjects, normalize, levenshtein, safeJson,
  selectScene, buildDecisionsRequest, parseDecisionsResponse, buildFlashRequest, parseFlashResponse,
  offlinePick, matchNames, DECISIONS_MODEL, FLASH_MODEL,
};
if (typeof module !== 'undefined') module.exports = _exports;
else if (typeof window !== 'undefined') window.PICK = _exports;
