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
import { REPLAY_STEP_OFFSETS_MS } from "@/constants/replay"

// Данные заглушек src/api/*. Все числа, даты, URL и формулировки — из ТЗ
// (§5 значения, §7.4 публикации, §10 даты сентябрьского сигнала, §14 сценарий).
// Ничего не выдумано: неизвестная дата — null, неподтверждённая страница — 0,
// невычисленный sha256 — ''. riverOrder везде null — порядок створов не
// подтверждён командой (вопрос 1 плана); sourceExcerpt измерений — реконструкция
// строки таблицы из значений ТЗ §5, дословную цитату бюллетеня отдаст бэк.

// Дата внесения verified_seed (не дата наблюдений).
const SEEDED_AT = "2026-08-04T00:00:00+05:00"

// --- Документы-источники -----------------------------------------------------

const docKazhydromet202509: SourceDocument = {
  id: "doc-kazhydromet-2025-09",
  title:
    "Информационный бюллетень о состоянии окружающей среды: Атырауская область, сентябрь 2025",
  publisher: "РГП «Казгидромет»",
  url: "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf",
  publishedAt: null,
  fetchedAt: SEEDED_AT,
  contentType: "pdf",
  sha256: "", // вычислит бэк при скачивании файла
  cachePath: null,
  status: "verified",
}

const docKazhydromet202505: SourceDocument = {
  id: "doc-kazhydromet-2025-05",
  title:
    "Информационный бюллетень о состоянии окружающей среды: Атырауская область, май 2025",
  publisher: "РГП «Казгидромет»",
  url: "https://www.kazhydromet.kz/uploads/files_calendar/8606/file/6850158c0099catyrau-russ-byulleten-za-may-2025g.pdf",
  publishedAt: null,
  fetchedAt: SEEDED_AT,
  contentType: "pdf",
  sha256: "",
  cachePath: null,
  status: "verified",
}

const docZakonGreenWater: SourceDocument = {
  id: "doc-zakon-green-water",
  title: "В Атырау зелёная вода в реке оказалась следом нефтяного загрязнения",
  publisher: "Zakon.kz",
  url: "https://www.zakon.kz/obshestvo/6490267-v-atyrau-zelenaya-voda-v-reke-okazalas-sledom-neftyanogo-zagryazneniya.html",
  publishedAt: "2025-09-09T15:16:00+05:00", // ТЗ §10, reportedAt примера
  fetchedAt: SEEDED_AT,
  contentType: "html",
  sha256: "",
  cachePath: null,
  status: "verified",
}

const docKazinformWastewater: SourceDocument = {
  id: "doc-kazinform-wastewater",
  title: "В сточных водах Атырау обнаружены остатки нефтепродуктов",
  publisher: "Kazinform",
  url: "https://www.inform.kz/ru/v-stochnih-vodah-atirau-obnaruzheni-ostatki-nefteproduktov-adef40",
  publishedAt: null,
  fetchedAt: SEEDED_AT,
  contentType: "html",
  sha256: "",
  cachePath: null,
  status: "verified",
}

const docAkZhaiykOilFilm: SourceDocument = {
  id: "doc-akzhaiyk-oil-film",
  title: "Противоречивые измерения нефтяной плёнки", // описание из ТЗ §7.4
  publisher: "Газета «Ак Жайык»",
  url: "https://azh.kz/ru/news/view/120575",
  publishedAt: null,
  fetchedAt: SEEDED_AT,
  contentType: "html",
  sha256: "",
  cachePath: null,
  status: "verified",
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

const stZhaiyk1kmAboveAtyrau: Station = {
  id: "st-zhaiyk-1km-above-atyrau",
  name: "1 км выше Атырау",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "neutral", // положение задано относительно города, а не объекта проверки
  relatedObjectId: null,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stAsa05kmAbove: Station = {
  id: "st-asa-0-5km-above",
  name: "0,5 км выше сброса КГП «Атырау су арнасы»",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "upstream",
  relatedObjectId: objAtyrauSuArnasy.id,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stAsa05kmBelow: Station = {
  id: "st-asa-0-5km-below",
  name: "0,5 км ниже сброса КГП «Атырау су арнасы»",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "downstream",
  relatedObjectId: objAtyrauSuArnasy.id,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stZhaiyk1kmBelowAtyrau: Station = {
  id: "st-zhaiyk-1km-below-atyrau",
  name: "1 км ниже Атырау",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "neutral",
  relatedObjectId: null,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stSturgeon05kmAbove: Station = {
  id: "st-sturgeon-0-5km-above",
  name: "0,5 км выше осетрового завода",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "upstream",
  relatedObjectId: objSturgeonPlant.id,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stSturgeon3kmBelow: Station = {
  id: "st-sturgeon-3km-below",
  name: "3 км ниже осетрового завода",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "downstream",
  relatedObjectId: objSturgeonPlant.id,
  locationSourceDocumentId: docKazhydromet202509.id,
}

const stDamba: Station = {
  id: "st-damba",
  name: "посёлок Дамба",
  waterBody: "Жайык",
  location: null,
  riverOrder: null,
  relationType: "neutral",
  relatedObjectId: null,
  locationSourceDocumentId: docKazhydromet202509.id,
}

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
  station: Station,
  sampledAt: string,
  value: number,
  sourceDocumentId: string,
  sourcePage: number
): Measurement {
  return {
    id,
    stationId: station.id,
    sampledAt,
    indicator: "нефтепродукты",
    value,
    unit: "mg/dm3",
    matrix: "water",
    qualityClass: null,
    sourceDocumentId,
    sourcePage,
    sourceExcerpt: `Нефтепродукты, ${station.name}: ${value.toLocaleString("ru-RU")} мг/дм³`,
    verified: true,
  }
}

const SEPTEMBER_PAGE = 22 // ТЗ §5: приложение 2, страница PDF 22
const MAY_PAGE = 0 // страница не перепроверена (вопрос 8 плана) — 0 до подтверждения

const mSep1kmAbove = measurement(
  "m-2025-09-1km-above-atyrau",
  stZhaiyk1kmAboveAtyrau,
  SEPTEMBER_2025,
  0.234,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepAsaAbove = measurement(
  "m-2025-09-asa-above",
  stAsa05kmAbove,
  SEPTEMBER_2025,
  0.058,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepAsaBelow = measurement(
  "m-2025-09-asa-below",
  stAsa05kmBelow,
  SEPTEMBER_2025,
  0.054,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSep1kmBelow = measurement(
  "m-2025-09-1km-below-atyrau",
  stZhaiyk1kmBelowAtyrau,
  SEPTEMBER_2025,
  0.167,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepSturgeonAbove = measurement(
  "m-2025-09-sturgeon-above",
  stSturgeon05kmAbove,
  SEPTEMBER_2025,
  0.066,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepSturgeonBelow = measurement(
  "m-2025-09-sturgeon-below",
  stSturgeon3kmBelow,
  SEPTEMBER_2025,
  0.063,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepDamba = measurement(
  "m-2025-09-damba",
  stDamba,
  SEPTEMBER_2025,
  0.067,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)

const mMayAsaAbove = measurement(
  "m-2025-05-asa-above",
  stAsa05kmAbove,
  MAY_2025,
  0.114,
  docKazhydromet202505.id,
  MAY_PAGE
)
const mMayAsaBelow = measurement(
  "m-2025-05-asa-below",
  stAsa05kmBelow,
  MAY_2025,
  0.193,
  docKazhydromet202505.id,
  MAY_PAGE
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

// Даты и цитата — из примера ТЗ §10 (verified_seed).
const sigZakonGreenWater: IncidentSignal = {
  id: "sig-zakon-green-water",
  title: "Необычная зелёная окраска воды в Жайыке",
  observedAt: "2025-09-01T00:00:00+05:00",
  reportedAt: "2025-09-09T15:16:00+05:00",
  location: null,
  locationText: "река Жайык, Атырау",
  phenomenon: "color_change",
  excerpt: "Жителей Атырау встревожила необычная зеленая окраска воды",
  sourceDocumentId: docZakonGreenWater.id,
  extractionMode: "verified_seed",
  verificationStatus: "official", // подтверждено официальными результатами 15 проб (§7.4)
}

// --- Расследования -----------------------------------------------------------

// Формулировки утверждений — по «разрешённым выводам» ТЗ §5.
const esSepFactMax: EvidenceStatement = {
  id: "es-2025-09-fact-max",
  code: "MAXIMUM_RECORDED_UPSTREAM",
  kind: "supports",
  text: "Максимум нефтепродуктов за сентябрь — 0,234 мг/дм³ — зафиксирован на створе «1 км выше Атырау».",
  measurementIds: [mSep1kmAbove.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "human_verified",
  sortOrder: 0,
}

const esSepFactPair: EvidenceStatement = {
  id: "es-2025-09-fact-pair",
  code: "NO_LOCAL_INCREASE_IN_PAIR",
  kind: "supports",
  text: "В паре створов у сброса КГП «Атырау су арнасы» значение ниже сброса не увеличилось относительно точки выше: 0,054 против 0,058 мг/дм³.",
  measurementIds: [mSepAsaAbove.id, mSepAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "human_verified",
  sortOrder: 1,
}

const esSepHypAsa: EvidenceStatement = {
  id: "es-2025-09-hyp-asa",
  code: "MAXIMUM_UPSTREAM_OF_OBJECT",
  kind: "contradicts",
  text: "Локальный интервал возле сброса КГП «Атырау су арнасы» не объясняет максимум 0,234 мг/дм³: максимум расположен выше, а в паре возле сброса рост не зафиксирован. Это не оправдывает объект вообще — он остаётся объектом для проверки ниже себя.",
  measurementIds: [mSep1kmAbove.id, mSepAsaAbove.id, mSepAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "human_verified",
  sortOrder: 2,
}

const invSeptember: Investigation = {
  id: "inv-atyrau-2025-09",
  title: "Жайык, Атырау: нефтепродукты, сентябрь 2025",
  signalIds: [sigZakonGreenWater.id],
  indicator: "нефтепродукты",
  evidenceLevel: "L2", // §14: L2, но не L3 — нет числа на ближайшем вышележащем створе
  corridor: null, // координаты не подтверждены — GeoJSON строить нельзя (ТЗ §17)
  supportedFacts: [esSepFactMax, esSepFactPair],
  contradictedHypotheses: [esSepHypAsa],
  unknowns: [
    "Нет числового значения нефтепродуктов на ближайшем вышележащем створе за ту же дату — точнее локализовать источник нельзя.",
    "Порядок створов сверху вниз не подтверждён вручную (riverOrder) — линейная схема показывает точки без ранжирования.",
  ],
  conclusion:
    "Источник не установлен. Сентябрьский максимум 0,234 мг/дм³ зафиксирован на створе «1 км выше Атырау»; сброс КГП «Атырау су арнасы» этот максимум не объясняет. Источник следует искать выше створа «1 км выше Атырау».",
  updatedAt: SEEDED_AT,
}

const esMayDelta: EvidenceStatement = {
  id: "es-2025-05-delta",
  code: "LOCAL_INCREASE_IN_PAIR",
  kind: "supports",
  text: "Внутри парного интервала у сброса КГП «Атырау су арнасы» в мае зарегистрирован рост концентрации на 0,079 мг/дм³: 0,114 мг/дм³ выше сброса и 0,193 мг/дм³ ниже.",
  measurementIds: [mMayAsaAbove.id, mMayAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202505.id],
  generatedBy: "human_verified",
  sortOrder: 0,
}

const invMay: Investigation = {
  id: "inv-atyrau-2025-05",
  title: "Жайык, Атырау: нефтепродукты, май 2025",
  signalIds: [],
  indicator: "нефтепродукты",
  evidenceLevel: "L3", // §14: парные лабораторные измерения на одной дате
  corridor: null,
  supportedFacts: [esMayDelta],
  contradictedHypotheses: [],
  unknowns: [
    "Одного сравнения недостаточно, чтобы приписать рост конкретному объекту или доказать статистическую значимость.",
  ],
  conclusion:
    "Источник не установлен. В мае внутри парного интервала у сброса КГП «Атырау су арнасы» зарегистрирован рост на 0,079 мг/дм³; интервал требует проверки как возможная зона дополнительного поступления.",
  updatedAt: SEEDED_AT,
}

// Кейс «недостаточно данных» (§7.6, §13). Формат ждёт ответа команды —
// вопрос 7 плана; до тех пор минимальный честный вариант без выдуманных сигналов.
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
    "Отсутствует открытое оперативное поле течений Каспия — направление переноса неизвестно.",
    "Нет достаточной сети синхронных измерений у побережья.",
    "Модель волн — только слабое вспомогательное доказательство; по ней нельзя строить уровни L2/L3.",
  ],
  conclusion:
    "Источник не локализован. Есть сообщения и модель волн, но отсутствует открытое оперативное поле течений и достаточная сеть синхронных измерений.",
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
    corridorBounds: {
      upstreamStationId: null, // интервал открыт вверх: «выше створа 1 км выше Атырау»
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

// Сценарий реплея — хронология ТЗ §14, интервалы §12.
export const replayScenarios: Record<string, ReplayScenario> = {
  [invSeptember.id]: {
    id: "replay-atyrau-2025-09",
    incidentId: invSeptember.id,
    steps: [
      {
        id: "rs-2025-09-signal",
        offsetMs: REPLAY_STEP_OFFSETS_MS[0],
        type: "signal",
        payload: { signal: sigZakonGreenWater, evidenceLevel: "L0" },
      },
      {
        id: "rs-2025-09-corroboration",
        offsetMs: REPLAY_STEP_OFFSETS_MS[1],
        type: "corroboration",
        payload: {
          text: "Опубликована официальная информация: отобраны 15 проб воды, в них найдены следы нефтяного загрязнения.",
          sourceDocumentId: docZakonGreenWater.id,
          evidenceLevel: "L1",
        },
      },
      {
        id: "rs-2025-09-measurement",
        offsetMs: REPLAY_STEP_OFFSETS_MS[2],
        type: "measurement",
        payload: {
          // §14: в реплее загружаются четыре городских значения
          measurements: [
            mSep1kmAbove,
            mSepAsaAbove,
            mSepAsaBelow,
            mSep1kmBelow,
          ],
          evidenceLevel: "L1",
        },
      },
      {
        id: "rs-2025-09-inference",
        offsetMs: REPLAY_STEP_OFFSETS_MS[3],
        type: "inference",
        payload: {
          // дословно §14
          text: "Городской выпуск не объясняет максимум, расположенный выше него. В паре возле выпуска роста не зафиксировано.",
          evidenceLevel: "L2",
        },
      },
      {
        id: "rs-2025-09-conclusion",
        offsetMs: REPLAY_STEP_OFFSETS_MS[4],
        type: "conclusion",
        payload: { text: invSeptember.conclusion, evidenceLevel: "L2" },
      },
    ],
  },
}

export const evidenceGraphs: Record<
  string,
  {
    statements: EvidenceStatement[]
    measurements: Measurement[]
    sourceDocuments: SourceDocument[]
  }
> = {
  [invSeptember.id]: {
    statements: [esSepFactMax, esSepFactPair, esSepHypAsa],
    measurements: septemberMeasurements,
    sourceDocuments: [
      docKazhydromet202509,
      docZakonGreenWater,
      docKazinformWastewater,
      docAkZhaiykOilFilm,
    ],
  },
  [invMay.id]: {
    statements: [esMayDelta],
    measurements: mayMeasurements,
    sourceDocuments: [docKazhydromet202505],
  },
  [invAktau.id]: {
    statements: [],
    measurements: [],
    sourceDocuments: [],
  },
}

// Статусы источников (§12 GET /api/live/status): бэк ещё не ходил в сеть,
// в кэше — только проверенные бюллетени.
export const liveStatusSeed: LiveStatus = {
  sources: [
    {
      id: "kazhydromet-bulletins",
      name: "Казгидромет: ежемесячные бюллетени",
      lastSuccessAt: null,
      cacheAvailable: true,
    },
    {
      id: "gdelt",
      name: "GDELT DOC 2.0",
      lastSuccessAt: null,
      cacheAvailable: false,
    },
    {
      id: "open-meteo-flood",
      name: "Open-Meteo Flood API (расход Жайыка)",
      lastSuccessAt: null,
      cacheAvailable: false,
    },
    {
      id: "open-meteo-marine",
      name: "Open-Meteo Marine API (волны у Актау)",
      lastSuccessAt: null,
      cacheAvailable: false,
    },
  ],
}
