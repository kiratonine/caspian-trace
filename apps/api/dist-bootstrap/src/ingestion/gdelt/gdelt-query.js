"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLLUTION_TERMS = exports.MANGYSTAU_GEOGRAPHY_TERMS = exports.ATYRAU_GEOGRAPHY_TERMS = exports.MANGYSTAU_REGION_MARKERS = exports.ATYRAU_REGION_MARKERS = void 0;
exports.buildGdeltQuery = buildGdeltQuery;
exports.ATYRAU_REGION_MARKERS = [
    'Атырау', 'Atyrau', 'Жайық', 'Жайык', 'Урал', 'Ural River',
];
exports.MANGYSTAU_REGION_MARKERS = [
    'Актау', 'Aktau', 'Мангистау', 'Маңғыстау', 'Mangystau',
];
const SHARED_GEOGRAPHY_TERMS = ['Каспий', 'Caspian'];
exports.ATYRAU_GEOGRAPHY_TERMS = [
    ...exports.ATYRAU_REGION_MARKERS, ...SHARED_GEOGRAPHY_TERMS,
];
exports.MANGYSTAU_GEOGRAPHY_TERMS = [
    ...exports.MANGYSTAU_REGION_MARKERS, ...SHARED_GEOGRAPHY_TERMS,
];
exports.POLLUTION_TERMS = [
    'загрязнение', 'нефтепродукты', 'нефтяная пленка', 'нефтяная плёнка',
    'зеленая вода', 'зелёная вода', 'сточные воды', 'гибель рыбы', 'разлив нефти',
    'ластану', 'мұнай', 'ағынды су', 'pollution', 'oil spill', 'oil products',
    'wastewater', 'fish kill',
];
function buildGdeltQuery(input) {
    const geography = new Set();
    for (const region of input.regions) {
        const terms = region === 'atyrau' ? exports.ATYRAU_GEOGRAPHY_TERMS : exports.MANGYSTAU_GEOGRAPHY_TERMS;
        for (const term of terms)
            geography.add(term);
    }
    const url = new URL(input.endpoint);
    url.search = new URLSearchParams({
        query: `(${[...geography].join(' OR ')}) AND (${exports.POLLUTION_TERMS.join(' OR ')})`,
        mode: 'artlist',
        format: 'json',
        maxrecords: String(Math.min(25, input.maxRecords)),
        sort: 'datedesc',
        startdatetime: gdeltUtc(input.from),
        enddatetime: gdeltUtc(input.to),
    }).toString();
    return url;
}
function gdeltUtc(value) {
    return value.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}
//# sourceMappingURL=gdelt-query.js.map