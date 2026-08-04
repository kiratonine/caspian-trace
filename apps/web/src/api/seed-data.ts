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
// (§5 значения, §7.4 публикации, §10 сентябрьский сигнал) и из фикстур
// `packages/contracts/fixtures/*` — последние приоритетнее там, где расходятся:
// контракт и оценки уровней принадлежат бэку (запрет 6 CLAUDE.md).
//
// Сессия 13 привела сид к утверждённым схемам пакета. Что изменилось по
// сравнению с нашим прежним сидом и почему:
//   • документы: `fetchedAt: null`, `sha256: null`, `status: 'unverified'` —
//     схема запрещает `verified` без обоих полей provenance, а файлы бюллетеней
//     мы не скачивали и не хэшировали;
//   • измерения: `sourceExcerpt: null` + `verified: false` — прежняя «цитата»
//     была нашей реконструкцией строки таблицы, а схема требует под `verified`
//     настоящую выдержку из документа;
//   • створы: `relationType: 'neutral'`, `relatedObjectId: null`,
//     `locationSourceDocumentId: null` — связи створов с объектами не
//     подтверждены provenance (это работа Backend 2), а схема требует документ
//     местоположения ровно тогда, когда есть координаты;
//   • сентябрь: L1 вместо L2, без коридора и без опровергнутой версии —
//     пространственный вывод держится на порядке створов, который не
//     верифицирован (вопрос 1). Вернётся, когда придёт `riverOrder`.
const SEEDED_AT = "2026-08-04T00:00:00+05:00"

// --- Документы-источники -----------------------------------------------------

// `fetchedAt`/`sha256` заполнит бэк, когда скачает и захэширует файл; до тех пор
// документ по схеме `unverified` — «мы знаем адрес», а не «мы проверили файл».
const docKazhydromet202509: SourceDocument = {
  id: "doc-kazhydromet-2025-09",
  title:
    "Информационный бюллетень о состоянии окружающей среды: Атырауская область, сентябрь 2025",
  publisher: "РГП «Казгидромет»",
  url: "https://www.kazhydromet.kz/uploads/files_calendar/9344/file/68f0e81dcc3caatyrau-russ-byulleten-za-sentyabr-2025g.pdf",
  publishedAt: null,
  fetchedAt: null,
  contentType: "pdf",
  sha256: null,
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
  sha256: null,
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

// Связи створов с объектами (`relationType`, `relatedObjectId`) читаются из
// подписей бюллетеня, но provenance под них ещё не собран, поэтому в сиде они
// нейтральны: фикстуры пакета задают ровно такую планку, а «выше/ниже сброса»
// в названии створа остаётся видимым текстом, а не машинным утверждением.
function station(id: string, name: string): Station {
  return {
    id,
    name,
    waterBody: "Жайык",
    location: null, // координаты не подтверждены (ТЗ §17)
    riverOrder: null, // порядок створов не подтверждён (вопрос 1)
    relationType: "neutral",
    relatedObjectId: null,
    // Схема требует документ местоположения ровно тогда, когда есть координаты.
    locationSourceDocumentId: null,
  }
}

const stZhaiyk1kmAboveAtyrau = station(
  "st-zhaiyk-1km-above-atyrau",
  "1 км выше Атырау"
)
const stAsa05kmAbove = station(
  "st-asa-0-5km-above",
  "0,5 км выше сброса КГП «Атырау су арнасы»"
)
const stAsa05kmBelow = station(
  "st-asa-0-5km-below",
  "0,5 км ниже сброса КГП «Атырау су арнасы»"
)
const stZhaiyk1kmBelowAtyrau = station(
  "st-zhaiyk-1km-below-atyrau",
  "1 км ниже Атырау"
)
const stSturgeon05kmAbove = station(
  "st-sturgeon-0-5km-above",
  "0,5 км выше осетрового завода"
)
const stSturgeon3kmBelow = station(
  "st-sturgeon-3km-below",
  "3 км ниже осетрового завода"
)
const stDamba = station("st-damba", "посёлок Дамба")

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
  sourcePage: number | null
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
    // Дословную выдержку из PDF отдаст бэк при разборе документа; до тех пор
    // измерение по схеме не «verified» — наша реконструкция строки цитатой не была.
    sourceExcerpt: null,
    verified: false,
  }
}

const SEPTEMBER_PAGE = 22 // ТЗ §5: приложение 2, страница PDF 22
const MAY_PAGE = null // страница бюллетеня не перепроверена (вопрос 8 плана)

const mSep1kmAbove = measurement(
  "m-2025-09-1km-above-atyrau",
  stZhaiyk1kmAboveAtyrau.id,
  SEPTEMBER_2025,
  0.234,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepAsaAbove = measurement(
  "m-2025-09-asa-above",
  stAsa05kmAbove.id,
  SEPTEMBER_2025,
  0.058,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepAsaBelow = measurement(
  "m-2025-09-asa-below",
  stAsa05kmBelow.id,
  SEPTEMBER_2025,
  0.054,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSep1kmBelow = measurement(
  "m-2025-09-1km-below-atyrau",
  stZhaiyk1kmBelowAtyrau.id,
  SEPTEMBER_2025,
  0.167,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepSturgeonAbove = measurement(
  "m-2025-09-sturgeon-above",
  stSturgeon05kmAbove.id,
  SEPTEMBER_2025,
  0.066,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepSturgeonBelow = measurement(
  "m-2025-09-sturgeon-below",
  stSturgeon3kmBelow.id,
  SEPTEMBER_2025,
  0.063,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)
const mSepDamba = measurement(
  "m-2025-09-damba",
  stDamba.id,
  SEPTEMBER_2025,
  0.067,
  docKazhydromet202509.id,
  SEPTEMBER_PAGE
)

const mMayAsaAbove = measurement(
  "m-2025-05-asa-above",
  stAsa05kmAbove.id,
  MAY_2025,
  0.114,
  docKazhydromet202505.id,
  MAY_PAGE
)
const mMayAsaBelow = measurement(
  "m-2025-05-asa-below",
  stAsa05kmBelow.id,
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

// Утверждение сентября — дословно из фикстуры: фиксация значения на створе,
// без слова «максимум». Утверждение о максимуме — это уже сравнение створов
// между собой, а сравнивать их нельзя, пока порядок не подтверждён.
const esSepFact: EvidenceStatement = {
  id: "es-2025-09-fact-max",
  kind: "supports",
  text: "На створе «1 км выше Атырау» за сентябрь зафиксировано 0,234 мг/дм³ нефтепродуктов.",
  measurementIds: [mSep1kmAbove.id],
  sourceDocumentIds: [docKazhydromet202509.id],
  generatedBy: "human_verified",
}

const invSeptember: Investigation = {
  id: "inv-atyrau-2025-09",
  title: "Жайык, Атырау: нефтепродукты, сентябрь 2025",
  signalIds: [sigZakonGreenWater.id],
  indicator: "нефтепродукты",
  // L1, а не L2 из ТЗ §14: измерения подтверждены, но пространственный вывод
  // держится на порядке створов, а он не верифицирован (фикстура пакета).
  evidenceLevel: "L1",
  corridor: null, // координаты не подтверждены — GeoJSON строить нельзя (ТЗ §17)
  supportedFacts: [esSepFact],
  contradictedHypotheses: [], // версия исключается пространственно — см. уровень
  unknowns: [
    "Нет числового значения нефтепродуктов на ближайшем вышележащем створе за ту же дату — точнее локализовать источник нельзя.",
    "Порядок створов сверху вниз не подтверждён вручную — линейная схема показывает точки без ранжирования.",
  ],
  conclusion:
    "Источник не установлен. Подтверждены сентябрьские лабораторные измерения нефтепродуктов, но порядок створов не верифицирован; пространственный вывод отложен.",
  updatedAt: SEEDED_AT,
}

const esMayDelta: EvidenceStatement = {
  id: "es-2025-05-delta",
  kind: "supports",
  text: "Внутри парного интервала у сброса КГП «Атырау су арнасы» в мае зарегистрирован рост концентрации на 0,079 мг/дм³: 0,114 мг/дм³ выше сброса и 0,193 мг/дм³ ниже.",
  measurementIds: [mMayAsaAbove.id, mMayAsaBelow.id],
  sourceDocumentIds: [docKazhydromet202505.id],
  generatedBy: "human_verified",
}

// Май: фикстуры detail бэк ещё не прислал, уровень L3 взят из его же
// `incidents.json`. Парные значения одного интервала на одну дату — тот случай,
// где вывод не требует порядка створов (ТЗ §14).
const invMay: Investigation = {
  id: "inv-atyrau-2025-05",
  title: "Жайык, Атырау: нефтепродукты, май 2025",
  signalIds: [],
  indicator: "нефтепродукты",
  evidenceLevel: "L3",
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
    // Участок не выделен: границы коридора — пространственный вывод, а он
    // отложен до подтверждения порядка створов (фикстура пакета).
    corridorBounds: null,
  },
  [invMay.id]: {
    investigation: invMay,
    region: "atyrau",
    signals: [],
    measurements: mayMeasurements,
    stations: mayStations,
    candidateObjects: [objAtyrauSuArnasy],
    sourceDocuments: [docKazhydromet202505],
    // Интервал задан самой парой измерений, а не порядком створов, поэтому
    // он остаётся до майской фикстуры от бэка.
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

// Сценарий реплея — фикстура `replay-september.json`: интервалы §12, тексты
// и уровни шагов от бэка. Шаг подтверждения ссылается на бюллетень Казгидромета,
// а не на публикацию Zakon.kz: официальный первоисточник здесь бюллетень.
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
          text: "Добавлен официальный бюллетень Казгидромета с лабораторными измерениями нефтепродуктов.",
          sourceDocumentId: docKazhydromet202509.id,
          evidenceLevel: "L1",
        },
      },
      {
        id: "rs-2025-09-measurement",
        offsetMs: REPLAY_STEP_OFFSETS_MS[2],
        type: "measurement",
        payload: {
          // Четыре городских значения — как в фикстуре сценария
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
          text: "Порядок створов не верифицирован; пространственная интерпретация измерений отложена.",
          evidenceLevel: "L1",
        },
      },
      {
        id: "rs-2025-09-conclusion",
        offsetMs: REPLAY_STEP_OFFSETS_MS[4],
        type: "conclusion",
        payload: { text: invSeptember.conclusion, evidenceLevel: "L1" },
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
    statements: [esSepFact],
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
