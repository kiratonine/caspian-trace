"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIRECT_SOURCE_REGISTRY = void 0;
exports.findDirectSource = findDirectSource;
exports.directSourceRegistryHosts = directSourceRegistryHosts;
exports.DIRECT_SOURCE_REGISTRY = [
    entry('kazhydromet.kz', 'РГП «Казгидромет»', 1, ['national'], ['atyrau', 'mangystau']),
    entry('inform.kz', 'Казинформ', 1, ['national'], ['atyrau', 'mangystau']),
    entry('gov.kz', 'Официальный портал государственных органов Республики Казахстан', 1, ['national'], ['atyrau', 'mangystau']),
    entry('azh.kz', 'Ак Жайык', 1, ['atyrau', 'lower_ural', 'north_caspian'], ['atyrau']),
    entry('atpress.kz', 'АтырауПресс', 1, ['atyrau'], ['atyrau']),
    entry('lada.kz', 'Lada.kz', 1, ['mangystau', 'east_caspian'], ['mangystau']),
    entry('inaktau.kz', 'InAktau.kz', 1, ['mangystau', 'east_caspian'], ['mangystau']),
    entry('tumba.kz', 'Тумба', 1, ['mangystau', 'east_caspian'], ['mangystau']),
    entry('mangystaumedia.kz', 'Mangystau Media', 2, ['mangystau'], ['mangystau']),
    entry('uralskweek.kz', 'Уральская неделя', 2, ['upstream_ural'], ['atyrau']),
    entry('mgorod.kz', 'Мой город', 2, ['upstream_ural'], ['atyrau']),
    entry('diapazon.kz', 'Диапазон', 2, ['upstream_ilek'], ['atyrau']),
    entry('zakon.kz', 'Zakon.kz', 2, ['national'], ['atyrau', 'mangystau']),
];
const registryByHost = new Map();
for (const source of exports.DIRECT_SOURCE_REGISTRY) {
    for (const host of source.aliases)
        registryByHost.set(host, source);
}
function findDirectSource(hostname) {
    return registryByHost.get(hostname.toLowerCase()) ?? null;
}
function directSourceRegistryHosts() {
    return [...registryByHost.keys()];
}
function entry(canonicalHost, publisher, tier, coverage, requestRegions) {
    return {
        canonicalHost,
        aliases: [canonicalHost, `www.${canonicalHost}`],
        publisher,
        tier,
        coverage,
        requestRegions,
    };
}
//# sourceMappingURL=direct-source-registry.js.map