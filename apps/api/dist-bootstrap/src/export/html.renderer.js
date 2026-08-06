"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDossierHtml = renderDossierHtml;
exports.escapeHtml = escapeHtml;
function renderDossierHtml(model) {
    const facts = [...model.supportedFacts, ...model.contradictedHypotheses];
    return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(model.title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;color:#17202a}h1,h2{line-height:1.2}dt{font-weight:700}a{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}a{color:inherit}.no-print{display:none}}</style></head>
<body><main>
<h1>${escapeHtml(model.title)}</h1>
<p><strong>Уровень доказательности:</strong> ${escapeHtml(model.evidenceLevel)}</p>
<p>${escapeHtml(model.disclaimer)}</p>
<h2>Вывод</h2><p>${escapeHtml(model.conclusion)}</p>
<h2>Факты и проверки</h2><ul>${facts.map((fact) => `<li>${escapeHtml(fact.text)}</li>`).join('')}</ul>
<h2>Неизвестные</h2><ul>${model.unknowns.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('')}</ul>
<h2>Измерения</h2><ul>${model.measurements.map((item) => `<li>${escapeHtml(item.indicator)}: ${escapeHtml(item.rawValueText)} ${escapeHtml(item.unit)} — ${escapeHtml(item.sampledPeriod ?? item.sampledAt ?? 'дата не указана')}</li>`).join('')}</ul>
<h2>Источники</h2><ol>${model.sources.map((source) => `<li><a href="${escapeHtml(validateSourceUrl(source.url))}" rel="noopener noreferrer">${escapeHtml(source.title)}</a> — ${escapeHtml(source.publisher)}</li>`).join('')}</ol>
<p>Ruleset: ${escapeHtml(model.rulesetVersion ?? 'n/a')} · Input hash: ${escapeHtml(model.inputHash ?? 'n/a')}</p>
</main></body></html>`;
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character] ?? character);
}
function validateSourceUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('UNSAFE_SOURCE_URL');
    }
    return url.toString();
}
//# sourceMappingURL=html.renderer.js.map