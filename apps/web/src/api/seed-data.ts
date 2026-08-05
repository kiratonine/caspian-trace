import type {
  CandidateObject,
  EvidenceStatement,
  IncidentSignal,
  Investigation,
  Measurement,
  SourceDocument,
  Station,
} from "@/types"
import type {
  IncidentDetail,
  IncidentSummary,
  LiveStatus,
  ReplayScenario,
} from "./contracts"
// Данные заглушек src/api/*. Все числа, даты, URL и формулировки — из ТЗ
// (§5 значения, §7.4 публикации, §10 сентябрьский сигнал), из схем и фикстур
// `packages/contracts`, из проверенных данных `data/verified/*` и из golden-
// фикстур расчётного ядра `data/fixtures/investigation/*`. При расхождении
// приоритет у бэка: контракт и оценки уровней принадлежат ему (запрет 6
// CLAUDE.md).
//
// Сессия 14 приняла ветку `feat/backend-investigation`:
//   • измерения: настоящие `sourceExcerpt` + `verified: true`, страницы PDF
//     22 (сентябрь) и 24 (май), у бюллетеней проставлен сверенный `sha256`;
//   • `riverOrder` появился у четырёх створов — из попарных проверенных связей,
//     а не из порядка строк таблицы; у остальных остаётся `null`;
//   • сентябрь снова L2: коридор, открытый вверх, и два опровержения;
//   • утверждения теперь `generatedBy: 'rule_engine'` — их выпускает ядро,
//     а не наша ручная разметка.
const SEEDED_AT = "2026-08-04T00:00:00+05:00"

// --- Документы-источники -----------------------------------------------------

// `sha256` бюллетеней сверен бэком скачиванием файла (`data/verified/*.json`),
// но `fetchedAt` в их же выгрузке остаётся `null` и статус — `unverified`:
// хэш посчитан, а времени скачивания в проверенных данных нет.
const docKazhydromet202509: SourceDocument = {
  id: "doc-kazhydromet-2025-09",
  title:
    "Информационный бюллетень о состоянии окружающей среды: Атырауская область, сентябрь 2025",
  publisher: "РГП «Казгидромет»",
  url: "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf",
  publishedAt: null,
  fetchedAt: null,
  contentType: "pdf",
  sha256: "360390d641e3e3d2b8a6b4157b3eebdf6386cb24bee08cdf9c38a1d6f01b4fbb",
  cachePath: null,
  status: "unverified",
}

const docKazhydromet202505: SourceDocument = {
  id: "doc-kazhydromet-2025-05",
  title:
    "Информационный бюллетень о состоянии окружающей среды: Атырауская область, май 2025",
  publisher: "РГП «Казгидромет»",
  url: "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf",
  publishedAt: null,
  fetchedAt: null,
  contentType: "pdf",
  sha256: "73fb21e06f529160bf8756b3612bc3eab6a9f3615a91530ff19292120c684bce",
  cachePath: null,
  status: "unverified",
}

const docZakonGreenWater: SourceDocument = {
  id: "doc-zakon-green-water",
  title: "В Атырау зелёная вода в реке оказалась следом нефтяного загрязнения",
  publisher: "Zakon.kz",
  url: "https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html",
  publishedAt: "2025-09-09T15:16:00+05:00", // ТЗ §10, reportedAt примера
  fetchedAt: null,
  contentType: "html",
  sha256: null,
  cachePath: null,
  status: "unverified",
}

const docKazinformWastewater: SourceDocument = {
  id: "doc-kazinform-wastewater",
  title: "В сточных водах Атырау обнаружены остатки нефтепродуктов",
  publisher: "Kazinform",
  url: "https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40",
  publishedAt: null,
  fetchedAt: null,
  contentType: "html",
  sha256: null,
  cachePath: null,
  status: "unverified",
}

const docAkZhaiykOilFilm: SourceDocument = {
  id: "doc-akzhaiyk-oil-film",
  title: "Противоречивые измерения нефтяной плёнки", // описание из ТЗ §7.4
  publisher: "Газета «Ак Жайык»",
  url: "https://azh.kz/ru/news/view/120575",
  publishedAt: null,
  fetchedAt: null,
  contentType: "html",
  sha256: null,
  cachePath: null,
  status: "unverified",
}

// --- Объекты для проверки (никогда не «виновники») ---------------------------

const objAtyrauSuArnasy: CandidateObject = {
  id: "obj-atyrau-su-arnasy",
  name: "КГП «Атырау су арнасы»",
  category: "сброс сточных вод",
  location: null,
  waterBody: "Жайык",
  riverOrder: null,
  evidenceDocumentIds: [docKazhydromet202509.id, docKazhydromet202505.id],
  completeness: "confirmed", // §7.7: явно упомянут в подписях створов бюллетеней
}

const objSturgeonPlant: CandidateObject = {
  id: "obj-sturgeon-plant",
  name: "Осетровый завод",
  category: "предприятие",
  location: null,
  waterBody: "Жайык",
  riverOrder: null,
  evidenceDocumentIds: [docKazhydromet202509.id],
  completeness: "confirmed",
}

// --- Створы ------------------------------------------------------------------

// Связи створов с объектами (`relationType`, `relatedObjectId`) остаются
// нейтральными: у бэка привязка объекта к створу живёт во входе расчётного ядра
// (`candidateObjects[].stationId`), а не в контракте створа, и UI её не читает.
// «Выше/ниже сброса» в названии створа — видимый текст, а не машинное утверждение.
//
// `riverOrder` — линеаризация ПОПАРНЫХ проверенных связей
// `data/verified/atyrau-2025-*-station-relations.json` (upstream → downstream,
// у каждой sha256 документа, страница и дословная выдержка), а не порядок строк
// таблицы. У створов, которых в этих связях нет, порядок по-прежнему `null`.
function station(id: string, name: string, riverOrder: number | null): Station {
  return {
    id,
    name,
    waterBody: "Жайык",
    location: null, // координаты не подтверждены (ТЗ §17)
    riverOrder,
    relationType: "neutral",
    relatedObjectId: null,
    // Схема требует документ местоположения ровно тогда, когда есть координаты.
    locationSourceDocumentId: null,
  }
}

// Цепочка сентябрьских связей: 1 км выше Атырау → 0,5 км выше сброса →
// 0,5 км ниже сброса → 1 км ниже Атырау. Майская пара — звено этой же цепочки,
// поэтому нумерация сквозная: сравниваются только соседи внутри одного события.
const stZhaiyk1kmAboveAtyrau = station(
  "st-zhaiyk-1km-above-atyrau",
  "1 км выше Атырау",
  0
)
const stAsa05kmAbove = station(
  "st-asa-0-5km-above",
  "0,5 км выше сброса КГП «Атырау су арнасы»",
  1
)
const stAsa05kmBelow = station(
  "st-asa-0-5km-below",
  "0,5 км ниже сброса КГП «Атырау су арнасы»",
  2
)
const stZhaiyk1kmBelowAtyrau = station(
  "st-zhaiyk-1km-below-atyrau",
  "1 км ниже Атырау",
  3
)
// Осетровый завод и посёлок Дамба в проверенные связи не входят — их место
// в цепочке не подтверждено, и схема покажет их без ранжирования.
const stSturgeon05kmAbove = station(
  "st-sturgeon-0-5km-above",
  "0,5 км выше осетрового завода",
  null
)
const stSturgeon3kmBelow = station(
  "st-sturgeon-3km-below",
  "3 км ниже осетрового завода",
  null
)
const stDamba = station("st-damba", "посёлок Дамба", null)

const septemberStations: Station[] = [
  stZhaiyk1kmAboveAtyrau,
  stAsa05kmAbove,
  stAsa05kmBelow,
  stZhaiyk1kmBelowAtyrau,
  stSturgeon05kmAbove,
  stSturgeon3kmBelow,
  stDamba,
]

const mayStations: Station[] = [stAsa05kmAbove, stAsa05kmBelow]

// --- Измерения (ТЗ §5) -------------------------------------------------------

// Точная дата отбора в ТЗ не указана — только месяц (ISO 8601 год-месяц).
const SEPTEMBER_2025 = "2025-09"
const MAY_2025 = "2025-05"

function measurement(
  id: string,
  stationId: string,
  sampledPeriod: string,
  value: number,
  sourceDocumentId: string,
  sourcePage: number,
  sourceExcerpt: string
): Measurement {
  return {
    id,
    stationId,
    // Точной даты отбора в бюллетенях нет — известен только месяц.
    sampledAt: null,
    sampledPeriod,
    indicator: "нефтепродукты",
    value,
    // Как число напечатано в таблице бюллетеня — с десятичной запятой.
    rawValueText: value.toLocaleString("ru-RU"),
    unit: "mg/dm3",
    matrix: "water",
    qualityClass: null, // класс качества в таблице §5 не приведён
    sourceDocumentId,
    sourcePage,
    // Дословная выдержка из PDF и `verified: true` — из проверенных данных
    // `data/verified/atyrau-2025-*.json` (страница, sha256 и строка сверены
    // скачиванием файла). Реконструкций строки таблицы здесь больше нет.
    sourceExcerpt,
    verified: true,
  }
}

const SEPTEMBER_PAGE = 22 // сверено скачиванием: приложение 2, страница PDF 22
const MAY_PAGE = 24 // вопрос 8 закрыт: страница PDF 24

const mSep1kmAbove = measurement(
  "m-2025-09-1km-above-atyrau",
  stZhaiyk1kmAboveAtyrau.id,
  SEPTEMBER_2025,
  0.234,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "1 км выше г.Атырау 5 класс Нефтепродукты – 0,234 мг/дм3"
)
const mSepAsaAbove = measurement(
  "m-2025-09-asa-above",
  stAsa05kmAbove.id,
  SEPTEMBER_2025,
  0.058,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "г.Атырау, 0,5 км выше сброса КГП «Атырау су арнасы» — Нефтепродукты – 0,058 мг/дм3"
)
const mSepAsaBelow = measurement(
  "m-2025-09-asa-below",
  stAsa05kmBelow.id,
  SEPTEMBER_2025,
  0.054,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "г.Атырау, 0,5 км ниже сброса КГП «Атырау су арнасы» — Нефтепродукты – 0,054 мг/дм3"
)
const mSep1kmBelow = measurement(
  "m-2025-09-1km-below-atyrau",
  stZhaiyk1kmBelowAtyrau.id,
  SEPTEMBER_2025,
  0.167,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "1 км ниже г.Атырау 4 класс Нефтепродукты – 0,167 мг/дм3"
)
const mSepSturgeonAbove = measurement(
  "m-2025-09-sturgeon-above",
  stSturgeon05kmAbove.id,
  SEPTEMBER_2025,
  0.066,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "0,5 км выше сброса РГКП «Урало-Атырауский осетровый завод» — Нефтепродукты – 0,066 мг/дм3"
)
const mSepSturgeonBelow = measurement(
  "m-2025-09-sturgeon-below",
  stSturgeon3kmBelow.id,
  SEPTEMBER_2025,
  0.063,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "3 км ниже сброса РГКП «Урало-Атырауский осетровый завод» — Нефтепродукты – 0,063 мг/дм3"
)
const mSepDamba = measurement(
  "m-2025-09-damba",
  stDamba.id,
  SEPTEMBER_2025,
  0.067,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE,
  "пос.Дамба — Нефтепродукты – 0,067 мг/дм3"
)

const mMayAsaAbove = measurement(
  "m-2025-05-asa-above",
  stAsa05kmAbove.id,
  MAY_2025,
  0.114,
  docKazhydromet202505.id,
  MAY_PAGE,
  "г.Атырау, 0,5 км выше сброса КГП «Атырау су арнасы» — Нефтепродукты – 0,114 мг/дм3"
)
const mMayAsaBelow = measurement(
  "m-2025-05-asa-below",
  stAsa05kmBelow.id,
  MAY_2025,
  0.193,
  docKazhydromet202505.id,
  MAY_PAGE,
  "г.Атырау, 0,5 км ниже сброса КГП «Атырау су арнасы» — Нефтепродукты – 0,193 мг/дм3"
)

const septemberMeasurements: Measurement[] = [
  mSep1kmAbove,
  mSepAsaAbove,
  mSepAsaBelow,
  mSep1kmBelow,
  mSepSturgeonAbove,
  mSepSturgeonBelow,
  mSepDamba,
]

const mayMeasurements: Measurement[] = [mMayAsaAbove, mMayAsaBelow]

// --- Сигналы -----------------------------------------------------------------

// Даты, цитата и статус проверки — из фикстуры `incident-september.json`.
// Статус `corroborated`, а не `official`: официальный первоисточник — бюллетень
// Казгидромета, а публикация Zakon.kz его пересказывает.
const sigZakonGreenWater: IncidentSignal = {
  id: "sig-zakon-green-water",
  title: "Необычная зелёная окраска воды в Жайыке",
  observedAt: null,
  observedPeriod: SEPTEMBER_2025,
  reportedAt: "2025-09-09T15:16:00+05:00",
  location: null,
  locationText: "река Жайык, Атырау",
  phenomenon: "color_change",
  excerpt: "Жителей Атырау встревожила необычная зеленая окраска воды",
  sourceDocumentId: docZakonGreenWater.id,
  extractionMode: "verified_seed",
  verificationStatus: "corroborated",
}

// --- Расследования -----------------------------------------------------------

// Утверждения, уровни, коридоры и выводы — дословно из golden-фикстур
// расчётного ядра (`data/fixtures/investigation/*-golden.json`, ruleset 1.2.0).
// Ни одно из них фронт не сочиняет и не переписывает: это результат правил,
// который мы обязаны показывать как есть (запрет 6 CLAUDE.md).
//
// Сентябрь: оба утверждения — `contradicts`. Отдельного «установленного факта»
// ядро не выпускает: числа сами по себе живут в измерениях, а утверждением
// становится только применённое к ним правило.
const esSepNoIncrease: EvidenceStatement = {
  id: "evidence-no-increase-rel-sep-asa-pair-m-2025-09-asa-above-m-2025-09-asa-below",
  code: "NO_LOCAL_INCREASE_IN_PAIR",
  kind: "contradicts",
  text: "В сопоставимой паре изменение составляет -0,004 мг/дм³; эта пара не подтверждает дополнительное поступление внутри интервала в данном временном срезе.",
  measurementIds: [mSepAsaAbove.id, mSepAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "rule_engine",
  sortOrder: 0,
}

const esSepMaximumUpstream: EvidenceStatement = {
  id: "evidence-maximum-upstream-obj-atyrau-su-arnasy",
  code: "MAXIMUM_UPSTREAM_OF_OBJECT",
  kind: "contradicts",
  text: "Объект для проверки «КГП «Атырау су арнасы»» расположен ниже максимального вышележащего измерения и не объясняет этот максимум обычным переносом вниз по течению. Это не оценивает другие события или участки ниже объекта.",
  measurementIds: [mSep1kmAbove.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "rule_engine",
  sortOrder: 1,
}

const invSeptember: Investigation = {
  id: "inv-atyrau-2025-09",
  title: "Жайык, Атырау: нефтепродукты, сентябрь 2025",
  signalIds: [sigZakonGreenWater.id],
  indicator: "нефтепродукты",
  // L2 вернулся: связи створов подтверждены попарно, и пространственный вывод
  // снова опирается на данные, а не на порядок строк таблицы.
  evidenceLevel: "L2",
  corridor: null, // координаты не подтверждены — GeoJSON строить нельзя (ТЗ §17)
  supportedFacts: [],
  contradictedHypotheses: [esSepNoIncrease, esSepMaximumUpstream],
  unknowns: [
    // Первый пробел — из golden ядра; второй наш: у ядра всего четыре створа,
    // а в событии их семь, и трём порядок по-прежнему нечем подтвердить.
    "Нет сопоставимого числового значения на ближайшем подтверждённом вышележащем створе.",
    "Порядок створов «выше/ниже сброса осетрового завода» и «посёлок Дамба» не подтверждён — они показаны без ранжирования.",
  ],
  conclusion:
    "Источник не установлен. Доступные факты не поддерживают локальную версию ниже максимума; поиск следует продолжать выше створа «1 км выше Атырау».",
  updatedAt: SEEDED_AT,
}

const esMayLocalIncrease: EvidenceStatement = {
  id: "evidence-local-increase-rel-may-asa-pair-m-2025-05-asa-above-m-2025-05-asa-below",
  code: "LOCAL_INCREASE_IN_PAIR",
  kind: "supports",
  text: "В сопоставимом парном интервале зарегистрирован рост +0,079 мг/дм³; интервал требует проверки, но причина роста не установлена.",
  measurementIds: [mMayAsaAbove.id, mMayAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202505.id],
  generatedBy: "rule_engine",
  sortOrder: 0,
}

// Май — `may-golden.json`: парные значения одного интервала на один период,
// тот случай, где вывод не требует всей цепочки створов (ТЗ §14).
const invMay: Investigation = {
  id: "inv-atyrau-2025-05",
  title: "Жайык, Атырау: нефтепродукты, май 2025",
  signalIds: [],
  indicator: "нефтепродукты",
  evidenceLevel: "L3",
  corridor: null,
  supportedFacts: [esMayLocalIncrease],
  contradictedHypotheses: [],
  // Ядро пробелов не выпустило: в майском кейсе обе точки интервала измерены.
  unknowns: [],
  conclusion:
    "Источник не установлен. В сопоставимом парном интервале зарегистрирован рост; интервал требует проверки как возможная зона дополнительного поступления.",
  updatedAt: SEEDED_AT,
}

// Кейс «недостаточно данных» (§7.6, §13) — `aktau-golden.json`: причины отказа
// приходят кодами, тексты дословные. Формулировку «есть сообщения и модель волн»
// ядро не выпускает — она осталась только в вопросах к команде.
const invAktau: Investigation = {
  id: "inv-aktau-insufficient",
  title: "Актау, побережье Каспия: сообщения о загрязнении",
  signalIds: [],
  indicator: "не определён",
  evidenceLevel: "L0",
  corridor: null,
  supportedFacts: [],
  contradictedHypotheses: [],
  unknowns: [
    "Оперативное поле течений недоступно.",
    "Синхронные лабораторные измерения отсутствуют.",
    "Подтверждённый порядок створов отсутствует.",
  ],
  conclusion:
    "Источник не локализован: имеющихся данных недостаточно для пространственного вывода.",
  updatedAt: SEEDED_AT,
}

// --- Сборки для эндпоинтов ---------------------------------------------------

export const incidentSummaries: IncidentSummary[] = [
  {
    id: invSeptember.id,
    title: invSeptember.title,
    region: "atyrau",
    evidenceLevel: invSeptember.evidenceLevel,
    indicator: invSeptember.indicator,
    updatedAt: invSeptember.updatedAt,
    period: SEPTEMBER_2025, // тот же месяц, что у измерений события
  },
  {
    id: invMay.id,
    title: invMay.title,
    region: "atyrau",
    evidenceLevel: invMay.evidenceLevel,
    indicator: invMay.indicator,
    updatedAt: invMay.updatedAt,
    period: MAY_2025,
  },
  {
    id: invAktau.id,
    title: invAktau.title,
    region: "mangystau",
    evidenceLevel: invAktau.evidenceLevel,
    indicator: invAktau.indicator,
    updatedAt: invAktau.updatedAt,
    period: null, // период сообщений не установлен (кейс «недостаточно данных»)
  },
]

export const incidentDetails: Record<string, IncidentDetail> = {
  [invSeptember.id]: {
    investigation: invSeptember,
    region: "atyrau",
    signals: [sigZakonGreenWater],
    measurements: septemberMeasurements,
    stations: septemberStations,
    candidateObjects: [objAtyrauSuArnasy, objSturgeonPlant],
    sourceDocuments: [
      docKazhydromet202509,
      docZakonGreenWater,
      docKazinformWastewater,
      docAkZhaiykOilFilm,
    ],
    // Коридор открыт вверх по течению: нижняя граница — верхний измеренный
    // створ, выше него сопоставимых значений нет (golden ядра).
    corridorBounds: {
      upstreamStationId: null,
      downstreamStationId: stZhaiyk1kmAboveAtyrau.id,
    },
  },
  [invMay.id]: {
    investigation: invMay,
    region: "atyrau",
    signals: [],
    measurements: mayMeasurements,
    stations: mayStations,
    candidateObjects: [objAtyrauSuArnasy],
    sourceDocuments: [docKazhydromet202505],
    // Границы интервала — из `may-golden.json`: сама проверенная пара створов.
    corridorBounds: {
      upstreamStationId: stAsa05kmAbove.id,
      downstreamStationId: stAsa05kmBelow.id,
    },
  },
  [invAktau.id]: {
    investigation: invAktau,
    region: "mangystau",
    signals: [],
    measurements: [],
    stations: [],
    candidateObjects: [],
    sourceDocuments: [],
    corridorBounds: null,
  },
}

// Сценарий реплея — стабильный ответ API `replay-september.json`: шесть шагов,
// офсеты 0/5/10/15/20/25 с, тексты и уровни от бэка. Каждое применённое правило
// получает свой шаг `inference`, поэтому их два. Шаг подтверждения ссылается
// на бюллетень Казгидромета, а не на публикацию Zakon.kz: официальный
// первоисточник здесь бюллетень.
export const replayScenarios: Record<string, ReplayScenario> = {
  [invSeptember.id]: {
    id: invSeptember.id,
    incidentId: invSeptember.id,
    steps: [
      {
        id: "inv-atyrau-2025-09-signal",
        offsetMs: 0,
        type: "signal",
        payload: { signal: sigZakonGreenWater, evidenceLevel: "L0" },
      },
      {
        id: "inv-atyrau-2025-09-corroboration",
        offsetMs: 5000,
        type: "corroboration",
        payload: {
          text: "Проверенный официальный источник «Бюллетень Атырауской области, сентябрь 2025» включён в доказательную базу.",
          sourceDocumentId: docKazhydromet202509.id,
          evidenceLevel: "L1",
        },
      },
      {
        id: "inv-atyrau-2025-09-measurements",
        offsetMs: 10000,
        type: "measurement",
        payload: {
          // Четыре створа с подтверждёнными связями — ровно те, что попали
          // во вход расчётного ядра.
          measurements: [
            mSep1kmAbove,
            mSep1kmBelow,
            mSepAsaAbove,
            mSepAsaBelow,
          ],
          evidenceLevel: "L1",
        },
      },
      {
        id: `inv-atyrau-2025-09-inference-${esSepNoIncrease.id}`,
        offsetMs: 15000,
        type: "inference",
        payload: { text: esSepNoIncrease.text, evidenceLevel: "L2" },
      },
      {
        id: `inv-atyrau-2025-09-inference-${esSepMaximumUpstream.id}`,
        offsetMs: 20000,
        type: "inference",
        payload: { text: esSepMaximumUpstream.text, evidenceLevel: "L2" },
      },
      {
        id: "inv-atyrau-2025-09-conclusion",
        offsetMs: 25000,
        type: "conclusion",
        payload: { text: invSeptember.conclusion, evidenceLevel: "L2" },
      },
    ],
  },
}

// Граф доказательств повторяет ответ `GET /api/investigations/:id/evidence`:
// в нём только измерения и документы, на которых стоят утверждения, — это
// не полный состав события (его отдаёт detail).
export const evidenceGraphs: Record<
  string,
  {
    statements: EvidenceStatement[]
    measurements: Measurement[]
    sourceDocuments: SourceDocument[]
  }
> = {
  [invSeptember.id]: {
    statements: [esSepNoIncrease, esSepMaximumUpstream],
    measurements: [mSep1kmAbove, mSep1kmBelow, mSepAsaAbove, mSepAsaBelow],
    sourceDocuments: [docKazhydromet202509, docZakonGreenWater],
  },
  [invMay.id]: {
    statements: [esMayLocalIncrease],
    measurements: mayMeasurements,
    sourceDocuments: [docKazhydromet202505],
  },
  [invAktau.id]: {
    statements: [],
    measurements: [],
    sourceDocuments: [],
  },
}

// Статусы источников — фикстура `live-status.json`: бэк ещё ни разу не ходил
// в сеть (`never_run`), и кэш не заявляется, пока Storage не реализован.
export const liveStatusSeed: LiveStatus = {
  sources: [
    {
      id: "kazhydromet-bulletins",
      name: "Казгидромет: ежемесячные бюллетени",
      lastSuccessAt: null,
      cacheAvailable: false,
      status: "never_run",
    },
    {
      id: "gdelt",
      name: "GDELT DOC 2.0",
      lastSuccessAt: null,
      cacheAvailable: false,
      status: "never_run",
    },
    {
      id: "open-meteo-flood",
      name: "Open-Meteo Flood API (расход Жайыка)",
      lastSuccessAt: null,
      cacheAvailable: false,
      status: "never_run",
    },
    {
      id: "open-meteo-marine",
      name: "Open-Meteo Marine API (волны у Актау)",
      lastSuccessAt: null,
      cacheAvailable: false,
      status: "never_run",
    },
  ],
}
