import type { Book } from './model';
import { planningBriefHtml } from './planning-art.ts';
import type { Planning } from './planning.ts';

export type CardOptions = {
  appearance: 'paper' | 'briefing';
  task: string;
  question: string;
  prediction: string;
  falsifier: string;
};
export type MissionCard = {
  role: string;
  title: string;
  owner: string;
  equation: string;
  constraints: string[];
  dependencies: string[];
  status: string;
  result: string;
  answers: string[];
  explanation: string;
  revision: number | null;
};
export type CardSet = {
  planning?: Planning | null;
  title: string;
  creator: string;
  source: string;
  revision: number;
  capturedAt: string;
  information: string;
  data: string[];
  cards: MissionCard[];
  options: CardOptions;
};

// Project an explicit allowlist. Never serialize the workbook into an artifact:
// it also contains room invitations, author answers, private work, and reviews.
export function missionCardSet(
  book: Book,
  values: Record<string, string>,
  options: CardOptions,
  capturedAt = new Date().toISOString(),
): CardSet {
  if (book.document.type !== 'scenario') throw new Error('Open a scenario to make mission cards.');
  const scenario = book.document;
  const substitute = (text: string) =>
    text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (all, key) =>
      values[key] !== undefined ? `(${values[key]})` : all,
    );
  const cards = scenario.tasks
    .filter((task) => task.kind !== 'transfer' && (!options.task || task.id === options.task))
    .map((task): MissionCard => {
      const work = book.contributions.find((c) => c.task_id === task.id);
      const current = Boolean(work?.published && work.book_revision === book.revision);
      const owner =
        book.members.find((m) => m.id === work?.owner_id)?.name || 'Assign with the crew';
      const reviewer = book.members.find((m) => m.id === work?.reviewer_id)?.name;
      return {
        role: task.role,
        title: task.title,
        owner,
        equation: substitute(task.equation),
        constraints: task.constraints.map(substitute),
        dependencies: task.dependencies.map(
          (id) => scenario.tasks.find((t) => t.id === id)?.role || id,
        ),
        status: current
          ? reviewer
            ? `Peer reviewed by ${reviewer}`
            : 'Published · not peer reviewed'
          : 'Planning draft · no current published finding',
        result: current ? work!.work.steps.at(-1)?.equation || '' : '',
        answers: current
          ? task.answers
              .filter((a) => work!.work.answers[a.key]?.trim())
              .map((a) => `${a.label}: ${work!.work.answers[a.key]} ${a.unit}`.trim())
          : [],
        explanation: current ? work!.work.explanation : '',
        revision: current ? work!.revision : null,
      };
    });
  return {
    planning: book.planning
      ? {
          plan: structuredClone(book.planning.plan),
          reviews: book.planning.reviews
            .filter((r) => r.revision === book.planning!.plan.revision)
            .map((r) => ({ ...r, plan: structuredClone(book.planning!.plan) })),
        }
      : null,
    title: book.title,
    creator: book.creator,
    source: book.source ? `${book.source.title} by ${book.source.creator}` : '',
    revision: book.revision,
    capturedAt,
    information: scenario.information,
    data: scenario.data.map((item) => `${item.key}: ${item.value} ${item.unit}`.trim()),
    cards,
    options,
  };
}

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
function paragraph(label: string, value: string) {
  return value ? `<div class="item"><h3>${escape(label)}</h3><p>${escape(value)}</p></div>` : '';
}
function writingLine(label: string, value = '') {
  return `<div class="item"><h3>${escape(label)}</h3>${value ? `<p>${escape(value)}</p>` : '<div class="write-line"></div>'}</div>`;
}

// Standalone, offline HTML: no remote assets, workbook credentials, or live data.
// All student-supplied strings are escaped; the only script is the print control.
export function missionCardsHtml(set: CardSet) {
  const stamp = `${set.title} · Scenario revision ${set.revision} · ${set.capturedAt}`;
  const footer = `<footer>${escape(stamp)}</footer>`;
  const cards = set.cards
    .map(
      (card, i) => `<article class="card">
    <header><span class="kicker">${String(i + 1).padStart(2, '0')} / ${escape(card.role)}</span><h2>${escape(card.title)}</h2><p>${escape(card.owner)}</p></header>
    <div class="body">
      <p class="status">${escape(card.status)}${card.revision === null ? '' : ` · Work revision ${card.revision}`}</p>
      ${paragraph('Relationship', card.equation)}
      ${paragraph('Conditions', card.constraints.join('; '))}
      ${paragraph('Needs findings from', card.dependencies.join(' + '))}
      ${paragraph('Published finding', card.result)}
      ${paragraph('Published answers', card.answers.join('\n'))}
      ${paragraph('Team explanation', card.explanation)}
      ${writingLine('In-match action / position')}
      ${writingLine('Start cue / arrival window')}
      ${writingLine('Observed / unexpected')}
    </div>${footer}</article>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(set.title)} · Mission cards</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eeede5;color:#182e30;font:15px/1.5 system-ui,sans-serif}.toolbar{max-width:1050px;margin:24px auto;padding:0 20px}.toolbar h1{font-size:26px;margin-bottom:6px}.toolbar p{max-width:75ch}button{font:inherit;cursor:pointer;padding:10px 18px;background:#213e37;color:white;border:0;border-radius:5px}button:focus-visible{outline:3px solid #b95527;outline-offset:4px}.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:1050px;margin:25px auto;padding:0 20px 30px}.card{display:flex;flex-direction:column;min-width:0;background:white;border:1px dashed #8c9790;break-inside:avoid;overflow-wrap:anywhere}.card header{padding:18px 22px;border-bottom:2px solid #51664f}.kicker{font:700 11px/1.5 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}h2{font-size:22px;line-height:1.2;margin:9px 0}h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px}p{margin:0;white-space:pre-wrap}.body{padding:18px 22px;flex:1}.item{margin:14px 0}.status{font-size:12px;font-weight:650;border-bottom:1px solid #cad1c7;padding-bottom:10px}.write-line{height:26px;border-bottom:1px solid #afb9af}footer{padding:12px 22px;border-top:1px solid #d1d6ce;font:10px/1.5 ui-monospace,monospace}ul{padding-left:18px;margin:8px 0}.briefing .card header{background:#263c34;color:#faf8e9;border-bottom:5px solid #b6be91}.briefing .kicker{color:#e0e4c9}.briefing h2{text-transform:uppercase;font-family:ui-monospace,monospace;font-size:20px}.briefing .card{border-color:#51664f}.note{font-size:12px;margin-top:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;border-bottom:1px solid #afb9af;padding:9px 4px}td{height:38px}@media(max-width:650px){.sheet{grid-template-columns:1fr}}@page{size:auto;margin:12mm}@media print{body{background:white;font-size:10pt}.toolbar{display:none}.sheet{display:block;margin:0;padding:0;max-width:none}.card{margin:0 0 7mm;break-inside:avoid;page-break-inside:avoid}.card header,.briefing .card header{background:white;color:#182e30;padding:10px 16px}.briefing .kicker{color:#182e30}.body{padding:10px 16px}h2{font-size:16pt}.item{margin:9px 0}footer{padding:8px 16px}.write-line{height:20px}}
</style></head><body class="${set.options.appearance === 'briefing' ? 'briefing' : 'paper'}">
<div class="toolbar"><h1>${escape(set.title)} · Mission cards</h1><p>Keep this file for offline reference. Print or choose “Save as PDF” in your browser’s print dialog. Cards can be cut along the borders; longer findings may need more space.</p><p class="note">This is a saved snapshot, not a live room. Notes written on paper are not saved to the workbook. Named inputs in {{braces}} still need a published finding. Review labels describe student work, not proof of a game strategy.</p><p class="note"><button id="print-cards" type="button">Print / Save as PDF</button></p></div>
<main class="sheet">
${set.planning ? planningBriefHtml(set.planning) : ''}
<article class="card"><header><span class="kicker">Team briefing / saved snapshot</span><h2>${escape(set.title)}</h2><p>Created by ${escape(set.creator)}</p></header><div class="body">
${paragraph('Based on', set.source)}${paragraph('Supplied information', set.information)}
${paragraph('Supplied data', set.data.join('\n'))}
<h3>Objectives in this pack</h3><ul>${set.cards.map((card) => `<li>${escape(card.role)}: ${escape(card.title)}</li>`).join('')}</ul>
${writingLine('Map / floor / game version')}${writingLine('Shared clock zero / countdown')}
<p class="note">Supplied practice data are a model. Measure your own match conditions before treating these timings or damage values as game facts. Algebra checks do not verify those assumptions.</p>
</div>${footer}</article>
${cards}
<article class="card"><header><span class="kicker">Experiment / before the match</span><h2>Give the prediction a fair test.</h2></header><div class="body">
${writingLine('Question', set.options.question)}${writingLine('We predict', set.options.prediction)}${writingLine('Evidence that would count against it', set.options.falsifier)}
${writingLine('Keep these conditions the same')}${writingLine('What we measure / units / tolerance')}
<p class="note">Write the prediction before the trial. Record misses as well as successes. Winning the match alone does not establish whether the timing prediction worked.</p>
</div>${footer}</article>
<article class="card"><header><span class="kicker">Field notes / after the match</span><h2>What actually happened?</h2></header><div class="body">
<table><thead><tr><th>Trial</th><th>Predicted</th><th>Observed</th><th>Units</th></tr></thead><tbody>${[1, 2, 3].map((n) => `<tr><td>${n}</td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>
${writingLine('Observed − predicted / error tolerance')}${writingLine('Unexpected conditions / excluded trial and why')}${writingLine('Supports, challenges, or leaves the prediction unresolved?')}${writingLine('Reviewer / next revision')}
<p class="note">Bring these observations back to a notebook or role discussion. Keep this card so the original prediction survives your next revision.</p>
</div>${footer}</article>
</main><script>document.getElementById('print-cards').addEventListener('click',function(){window.print()});</script></body></html>`;
}
