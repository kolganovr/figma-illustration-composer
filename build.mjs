// Сборка плагина в dist/: code.js = layout.js + code.js, ui.html с ключом из .env.
// Ключ попадает только в dist (он в .gitignore), в репозитории его нет.
//   node build.mjs           обычная сборка
//   node build.mjs --bridge  ещё и dist/core-bridge.js (ядро без интерфейса для запуска через MCP-мост)
//   node build.mjs --bridge --code=<файл> --layout=<файл>  ядро и раскладка из других файлов
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');
const out = join(root, 'dist');
mkdirSync(out, { recursive: true });

let key = '', keyUntil = '';
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(GEMINI_API_KEY|GEMINI_KEY_UNTIL)\s*=\s*(.*)\s*$/);
    if (m && m[1] === 'GEMINI_API_KEY') key = m[2].replace(/^["']|["']$/g, '');
    if (m && m[1] === 'GEMINI_KEY_UNTIL') keyUntil = m[2].replace(/^["']|["']$/g, '');
  }
}

const layout = src('layout.js').replace(/\nif \(typeof module[^\n]*\n?/, '\n');
writeFileSync(join(out, 'code.js'), layout + '\n' + src('code.js'));
// pick.js встраивается в ui.html вместо <script src="pick.js"> (у плагина Figma один файл UI).
// Замена функцией, чтобы "$" в коде pick.js не читались как шаблоны replace.
const pickTag = /<script src="pick\.js"><\/script>/;
if (!pickTag.test(src('ui.html'))) throw new Error('в src/ui.html нет <script src="pick.js"></script>');
const ui = src('ui.html')
  .replace(pickTag, () => '<script>\n' + src('pick.js') + '\n</script>')
  .replace('__EMBEDDED_KEY__', () => key)
  .replace('__EMBEDDED_KEY_UNTIL__', () => keyUntil);
writeFileSync(join(out, 'ui.html'), ui);
copyFileSync(join(root, 'src', 'manifest.json'), join(out, 'manifest.json'));

if (process.argv.includes('--bridge')) {
  const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').slice(n.length + 3);
  const codeFile = arg('code'), layoutFile = arg('layout');
  const stripExport = (t) => t.replace(/\nif \(typeof module[^\n]*\n?/, '\n');
  const bridgeLayout = layoutFile ? stripExport(readFileSync(join(root, layoutFile), 'utf8')) : layout;
  const core = (codeFile ? readFileSync(join(root, codeFile), 'utf8') : src('code.js'))
    .replace(/^figma\.showUI[^\n]*\n/m, '')
    .replace(/^figma\.on\('selectionchange'[^\n]*\n/m, '') // подписка на выделение слала бы в окно моста чужие сообщения
    .replace(/\r?\nfigma\.ui\.onmessage[\s\S]*?\r?\n};\r?\n/, '\n');
  writeFileSync(join(out, 'core-bridge.js'), bridgeLayout + '\n' + core +
    '\nmodule.exports = { indexLibrary, compose, recolorFrame, libSummary, computeLayout, buildColorMap, matchKeys, addDecor, paletteById, getLib: () => LIB };\n');
}
console.log(`dist готов, ключ ${key ? 'встроен' + (keyUntil ? ' до ' + keyUntil : '') : 'не задан'}`);
