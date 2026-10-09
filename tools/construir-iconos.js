/* Genera el "sprite" de íconos: SOLO los íconos que el sistema realmente usa, incrustados en index.html.
 * Reemplaza a la biblioteca Lucide completa (358 KB) por unos pocos KB y evita recorrer la pantalla en cada dibujo.
 * Uso:  construir-iconos.bat   (necesita Node.js e internet en TU PC). Correrlo cuando se agregue un ícono nuevo.
 * En el código se usa  ic('nombre-del-icono')  y en el HTML  <svg class="i w-4 h-4"><use href="#i-nombre"/></svg>
 * Los nombres son los de https://lucide.dev/icons */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const raiz = path.join(__dirname, '..');
const VERSION = '0.468.0';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-'));
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', 'lucide-static@' + VERSION, '--silent'], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
const tgz = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'));
execFileSync('tar', ['-xzf', tgz], { cwd: tmp });
const dir = path.join(tmp, 'package', 'icons');
const todos = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));

const htmlPath = path.join(raiz, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const fuentes = [html, ...fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(raiz, 'js', f), 'utf8'))].join('\n')
  .replace(/<!-- ICONOS:INICIO -->[\s\S]*<!-- ICONOS:FIN -->/, '');
const usados = todos.filter(n => fuentes.includes("'" + n + "'") || fuentes.includes('"' + n + '"') || fuentes.includes('`' + n + '`') || fuentes.includes('#i-' + n + '"'));

const simbolos = usados.map(n => {
  const svg = fs.readFileSync(path.join(dir, n + '.svg'), 'utf8');
  const interior = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/\s*\n\s*/g, '');
  return `<symbol id="i-${n}" viewBox="0 0 24 24">${interior}</symbol>`;
}).join('');

if (!/<!-- ICONOS:INICIO -->/.test(html)) { console.error('Faltan las marcas ICONOS:INICIO / ICONOS:FIN en index.html'); process.exit(1); }
html = html.replace(/<!-- ICONOS:INICIO -->[\s\S]*<!-- ICONOS:FIN -->/, `<!-- ICONOS:INICIO -->${simbolos}<!-- ICONOS:FIN -->`);
fs.writeFileSync(htmlPath, html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Listo: ${usados.length} íconos (${simbolos.length} bytes) -> index.html`);
console.log(usados.join(' '));
