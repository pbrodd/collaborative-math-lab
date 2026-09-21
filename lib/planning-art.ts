import { schedule, seconds, type Plan, type Planning } from './planning.ts';
import { unitSvg, symbolLicense, symbolVersion } from './tactical-symbol.ts';
export const escapeHtml = (value: string) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const unitImage = `data:image/svg+xml,${encodeURIComponent(unitSvg)}`;
const colors = ['#ad4d19', '#1f658e', '#647221', '#813f88', '#963b45', '#267369'];
export function planningSvg(plan: Plan, selected = '', interactive = false, onlyRoute = '') {
  const e = escapeHtml;
  const paths = plan.routes
    .filter((r) => !onlyRoute || onlyRoute === r.id)
    .map((r, i) => {
      const start = plan.markers.find((m) => m.id === r.from),
        end = plan.markers.find((m) => m.id === r.to);
      if (!start || !end) return '';
      const points = [start, ...r.via, end];
      return `<g data-route="${e(r.id)}"><polyline points="${points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${selected === r.id ? 5 : 3}" stroke-dasharray="${i % 2 ? '8 4' : 'none'}" marker-end="url(#route-arrow)"/><text x="${points[1].x + 9}" y="${points[1].y - 10}" fill="${colors[i % colors.length]}" font-size="12" font-weight="700" paint-order="stroke" stroke="#f4f5e9" stroke-width="4">${e(r.label)}</text>${selected === r.id ? r.via.map((p, n) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="white" stroke="${colors[i % colors.length]}"/><text x="${p.x + 7}" y="${p.y + 13}" font-size="10">${n + 1}</text>`).join('') : ''}</g>`;
    })
    .join('');
  const markers = plan.markers
    .map(
      (
        m,
      ) => `<g data-marker="${e(m.id)}" transform="translate(${m.x} ${m.y})" ${interactive ? `tabindex="0" role="button" aria-label="${e(m.label)}. Arrow keys move; Enter saves."` : ''} style="cursor:${interactive ? 'grab' : 'default'}">
    <title>${e(m.label)}${m.kind === 'objective' ? ` · Stage ${m.stage}` : ''}</title><circle r="25" fill="${selected === m.id ? '#ffdca0' : '#f9f9ef'}" fill-opacity=".95" stroke="${selected === m.id ? '#a94a15' : '#9fae9e'}" stroke-width="${selected === m.id ? 3 : 1}"/>
    ${m.kind === 'player' ? `<image x="-21" y="-15" width="42" height="30" href="${e(unitImage)}"/>` : '<path d="M 0 -13 L 13 0 L 0 13 L -13 0 Z" fill="#b96029" stroke="#553d28"/>'}
    <text y="40" text-anchor="middle" font-size="13" font-weight="700" paint-order="stroke" stroke="#f4f5e9" stroke-width="4">${e(m.label)}</text></g>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="${interactive ? 'group' : 'img'}" aria-label="Original Relay Station practice floorplan with team routes" style="display:block;width:100%;height:auto;font-family:ui-monospace,monospace;color:#213e35">
  <defs><pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d6dfcd" stroke-width=".5"/></pattern><marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#394c40"/></marker></defs>
  <rect width="800" height="520" fill="#f4f5e9"/><rect width="800" height="520" fill="url(#map-grid)"/>
  <text x="28" y="32" font-size="14" font-weight="700" letter-spacing="2">RELAY STATION / PRACTICE GROUND</text><text x="735" y="32" font-size="14">N ↑</text>
  <rect x="95" y="65" width="610" height="355" fill="#e2e9d7"/>
  <rect x="110" y="80" width="185" height="180" fill="#edf0df"/><rect x="315" y="80" width="190" height="180" fill="#edf0df"/><rect x="525" y="80" width="165" height="180" fill="#edf0df"/>
  <path d="M95 320 V65 H705 V320 M705 380 V420 H635 M575 420 H250 M200 420 H95 V380 M305 65 V265 M515 65 V265 M95 265 H175 M220 265 H390 M440 265 H590 M640 265 H705" fill="none" stroke="#5d7056" stroke-width="7"/>
  <g fill="#42543e" font-size="11"><text x="118" y="102">RELAY ROOM</text><text x="330" y="102">OBSERVATION</text><text x="538" y="102">SIGNALS</text><text x="310" y="398">SOUTH CONCOURSE</text><text x="18" y="290">WEST</text><text x="735" y="290">EAST</text></g>
  <g fill="#bdcbb5" stroke="#8c9f80"><rect x="118" y="190" width="30" height="50"/><rect x="255" y="115" width="28" height="55"/><rect x="337" y="190" width="50" height="32"/><rect x="458" y="122" width="32" height="55"/><rect x="657" y="182" width="29" height="52"/><rect x="540" y="120" width="25" height="70"/></g>
  ${paths}${markers}<text x="28" y="507" font-size="10">Original map · diagram units, not meters · supplied route times · relay-station-v1</text></svg>`;
}
export function planningBriefHtml(planning: Planning) {
  const p = planning.plan,
    e = escapeHtml,
    times = schedule(p);
  const reviews = planning.reviews.filter((r) => r.revision === p.revision);
  const status = reviews.length
    ? `${reviews.at(-1)!.verdict === 'approve' ? 'Review recorded' : 'Revision requested'} by ${reviews.at(-1)!.author}`
    : 'Awaiting review';
  return `<article class="card"><header><span class="kicker">Shared plan · revision ${p.revision}</span><h2>${e(p.settings.title)}</h2></header><div class="body">${planningSvg(p)}<p>${e(p.settings.notes)}</p><p class="note">${e(status)}. Within each stage: at most ${e(p.settings.tolerance)} seconds between any pair of ready times. All routes ready by ${e(p.settings.deadline)} seconds.</p><p class="note">${times.feasible ? 'The saved numbers meet the modeled timing conditions.' : 'The saved plan has missing routes, estimates to recheck, or timing conditions to resolve.'} This does not verify game conditions, map traversability, or an optimal strategy.</p></div></article>
  ${times.results.map((item) => `<article class="card"><header><span class="kicker">Stage ${item.stage} / ${e(item.route.owner || 'Assign with the crew')}</span><h2>${e(item.route.label)}</h2></header><div class="body"><p><b>Route:</b> ${e(p.markers.find((m) => m.id === item.route.from)!.label)} → ${e(p.markers.find((m) => m.id === item.route.to)!.label)}</p><p><b>Start at:</b> ${seconds(item.start)} sec from shared zero</p><p><b>Ready at:</b> ${seconds(item.ready)} sec</p>${item.route.needsMeasurement ? '<p><b>Recheck this timing estimate: the route sketch changed.</b></p>' : ''}<p><b>Travel / setup:</b> ${e(item.route.travel)} / ${e(item.route.setup)} sec</p><p><b>Wait for:</b> ${item.route.after.map((id) => e(p.routes.find((r) => r.id === id)!.label)).join(' + ') || 'Shared countdown zero'}; then ${e(item.route.delay)} sec</p><p class="note">Record actual start, readiness, interruptions, and whether this stage stayed within its arrival window.</p><div class="write-line"></div></div><footer>Plan revision ${p.revision} · modeled timing · ${e(status)}</footer></article>`).join('')}
  <article class="card"><div class="body"><h3>Map and symbol credits</h3><p class="note">Original Relay Station map: Collaborative Math Lab contributors, MIT. Friendly-unit artwork generated with Milsymbol ${symbolVersion} by Måns Beckman. https://github.com/spatialillusions/milsymbol</p><p class="note" style="font-size:9px;white-space:pre-wrap">${e(symbolLicense)}</p></div></article>`;
}
export function planningDocument(
  planning: Planning,
  title: string,
  creator: string,
  source: string,
) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Field briefing</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#253c33;background:#ecefdf;margin:0}.toolbar,main{max-width:900px;margin:25px auto;padding:0 20px}.card{background:white;border:1px dashed #95a18d;margin:20px 0;break-inside:avoid;overflow-wrap:anywhere}header,.body,footer{padding:18px 24px}header{background:#263c34;color:#faf8e9}h2{margin:8px 0;font-family:monospace}h3{font-size:14px}.kicker,footer{font:12px monospace}.note{font-size:12px}.write-line{height:50px;border-bottom:1px solid #95a18d}button{padding:10px 18px;font:inherit;cursor:pointer}p{white-space:pre-wrap}@page{margin:12mm}@media print{body{background:white;font-size:11pt}.toolbar button{display:none}main{padding:0;margin:0}header{background:white;color:#253c33}.card{break-inside:avoid}.card svg{max-height:130mm}}</style></head><body><div class="toolbar"><h1>${escapeHtml(title)}</h1><p>By ${escapeHtml(creator)}${source ? ` · Based on ${escapeHtml(source)}` : ''}</p><p>Captured ${new Date().toISOString()}. Keep this snapshot with your observations.</p><button id="print">Print / Save as PDF</button></div><main>${planningBriefHtml(planning)}</main><script>document.getElementById('print').addEventListener('click',function(){window.print()});</script></body></html>`;
}
