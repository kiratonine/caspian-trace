import type { TranslationResource } from "./types"

// Azərbaycanca — latın qrafikası (Azərbaycanda qüvvədə olan rəsmi yazı).
//
// Юридически чувствительные строки: «yoxlanılmalı obyekt» — нейтральный залог,
// никаких слов со значением «təqsirkar» / «pozucu» / «çirkləndirici».
// Имена собственные («Caspian Trace», названия юрлиц) не переводятся.
export const az = {
  app: {
    name: "Caspian Trace",
    tagline:
      "Açıq məlumatlar əsasında çirklənmənin mənşəyi versiyalarının yoxlanılması",
    legalDisclaimer:
      "Çirklənmə mənbəyi müəyyən edilməyib. Adı çəkilən bütün obyektlər yoxlanılmalı obyektlərdir; material heç kimin təqsirli olması barədə iddia ehtiva etmir. Nəticələr açıq mənbələr üzrə determinist qaydalarla qurulub və yeni məlumatlar ortaya çıxdıqda dəyişə bilər.",
    objectForReview: "yoxlanılmalı obyekt",
    dataLoadError: "Hadisə məlumatlarını yükləmək mümkün olmadı.",
  },
  insufficientData: {
    title: "Məlumat kifayət etmir",
    explanation:
      "Bu, xəta deyil: nəticə yoxlanıla bilən faktlarla təsdiqlənməyincə dərc olunmur.",
    reasonsLabel: "Nə çatışmır",
  },
  language: {
    label: "İnterfeys dili",
  },
  panel: {
    section: {
      conclusion: { title: "Nəticə" },
      evidenceLevel: { title: "Sübutluluq səviyyəsi" },
      supportedFacts: { title: "Nə müəyyən edilib" },
      contradictedHypotheses: { title: "Nə təsdiqlənmir" },
      unknowns: { title: "Nə naməlumdur" },
      sources: { title: "Mənbələr" },
    },
    noFacts: "Hesablama nüvəsi təsdiqləyici müddəa buraxmayıb.",
    noRejected: "Hələlik heç bir konkret versiya faktlarla istisna edilməyib.",
    noUnknowns: "Məlumatlardakı boşluqlar sadalanmayıb.",
    noSources: "Mənbə sənədləri əlavə edilməyib.",
  },
  evidence: {
    L0: {
      label: "Yoxlanılmamış siqnal",
      description:
        "Bir nəşr və ya ictimai bildiriş var. Laboratoriya təsdiqi yoxdur.",
    },
    L1: {
      label: "Hadisə təsdiqlənib",
      description:
        "Hadisə iki müstəqil mənbədə təsvir olunub, rəsmi mənbə mövcuddur və ya nümunə götürmə nəticələri dərc edilib.",
    },
    L2: {
      label: "Mənbə sahəyə qədər dəqiqləşdirilib",
      description:
        "Fiziki cəhətdən mümkün sahə müəyyən edilib; ən azı bir coğrafi versiya məlumatın olmaması ilə deyil, faktla istisna edilib.",
    },
    L3: {
      label: "Dəhliz laboratoriya məlumatları ilə dəstəklənir",
      description:
        "Eyni tarixdə və müqayisə oluna bilən vahidlərdə qonşu kəsimlər arasında cüt ölçmələr var. Bu, təqsirkarın müəyyən edildiyi anlamına gəlmir.",
    },
  },
  feed: {
    signalsHeading: "Siqnallar",
    noSignals: "Hadisəyə heç bir ictimai siqnal bağlanmayıb.",
    noIncidents: "Məlumatlarda hələlik hadisə yoxdur.",
    signalObservedPrefix: "müşahidə olunub",
    signalReportedPrefix: "bildirilib",
    signalDetailsLabel: "sitat, yer və mənbə",
  },
  comparison: {
    switcherLabel: "Bu sahənin müşahidə dövrləri",
    verdictChangeTitle: "Nəticə dəyişdi",
    verdictChangeBefore: "Əvvəl",
    verdictChangeExplanation:
      "Nəticə konkret ölçmələrin faktlarından irəli gəlir: başqa dövr — kəsimlərdə " +
      "başqa qiymətlər, ona görə də həm sübutluluq səviyyəsi, həm də hansı " +
      "versiyaları istisna etmək mümkün olduğu dəyişir. Bu, yoxlanılan obyektlərin " +
      "yenidən qiymətləndirilməsi deyil.",
    verdictChangeDismiss: "Müqayisəni gizlət",
  },
  scheme: {
    upstreamHint: "yuxarıda — axın üzrə yuxarı",
    unconfirmedOrderHint: "kəsimlərin sırası təsdiqlənməyib",
    partialOrderHint: "sıra bütün kəsimlər üçün təsdiqlənməyib",
    unorderedNote:
      "Kəsimlərin axın üzrə sırası əl ilə təsdiqlənməyib, ona görə sxem nöqtələri sıralamır: sətirlərin ardıcıllığı çayın axınını əks etdirmir.",
    unorderedLabel: "bu kəsimlərin sırası təsdiqlənməyib",
    corridorLabel: "ehtimal olunan dəhliz",
    corridorOpenUpNote: "axın üzrə yuxarı açıqdır",
    corridorBoundLabel: "dəhlizin sərhədi",
    corridorUpperBoundTooltip: "Ehtimal olunan dəhlizin yuxarı sərhədi.",
    corridorLowerBoundTooltip: "Ehtimal olunan dəhlizin aşağı sərhədi.",
    corridorOpenUpTooltip:
      "Ehtimal olunan dəhliz axın üzrə yuxarı açıqdır: mənbəni bu kəsimdən yuxarıda axtarmaq lazımdır.",
    noValueLabel: "qiymət yoxdur",
  },
  map: {
    placeholderChip: "demo-koordinatlar",
    placeholderWarning:
      "Xəritədəki koordinatlar nümayiş xarakterlidir: məlumatlarda kəsimlərin təsdiqlənmiş koordinatları yoxdur. Kəsimlərin axın üzrə aşağı sırası sənədlərlə təsdiqlənib, nöqtələrin ərazidəki mövqeyi — yox.",
    unplacedChip: "mövqe təsdiqlənməyib",
    corridorOpenUpstreamLabel: "sahə axın üzrə yuxarı açıqdır",
    unplacedNote:
      "Bu kəsimlər və obyektlər üçün axın zəncirindəki yer sənədlərlə təsdiqlənməyib, ona görə xəritədə yerləşdirilməyiblər.",
    candidateLabel: "yoxlanılmalı obyekt",
    verdictCorridorPrefix: "Sahə:",
    verdictOpenUpstreamPrefix: "kəsimdən yuxarı",
    verdictBetweenPrefix: "kəsimlər arasında",
    verdictExcludedPrefix: "Faktlarla istisna edilib:",
    verdictDossierLink: "Dosye",
    measurementsTrigger: "Ölçmələr",
    objectOutsideCorridor: "sahədən kənarda",
    objectInsideCorridor: "sahənin hüdudlarında",
    objectCorridorUnknown: "sahəyə nisbətən mövqe müəyyən edilməyib",
    objectPlacementBasis: {
      "obj-atyrau-su-arnasy":
        "Mövqe koordinatlardan deyil, Qazhidromet bülleteninin kəsim adlarından çıxarılıb («axıdılmadan 0,5 km yuxarı» və «axıdılmadan 0,5 km aşağı», səh. 22): obyektin koordinatları verilməyib.",
    },
    coordinateMode: {
      verifiedLabel: "Mövqe mənbə ilə təsdiqlənib",
      verifiedStation: "Kəsimin mövqeyi mənbə ilə təsdiqlənib",
      verifiedObject: "Obyektin mövqeyi mənbə ilə təsdiqlənib",
      schematicLabel: "Sxematik mövqe",
      schematicStation: "Kəsimin sxematik mövqeyi",
      schematicStationDetail: "Kəsimin dəqiq GPS mövqeyi təsdiqlənməyib.",
      schematicObjectDetail:
        "Bu, obyektin koordinatı və ya səbəb əlaqəsinin sübutu deyil.",
      schematicDisclaimer:
        "Sxematik mövqe — dəqiq koordinatlar təsdiqlənməyib. Xəritə fonu bu yerləşdirməni GPS məlumatına çevirmir.",
      markerSummary: "Təsdiqlənib: {{verified}} · sxematik: {{schematic}}",
    },
  },
  units: {
    "mg/dm3": "mq/dm³",
    "mg/kg": "mq/kq",
    percent: "%",
  },
  matrix: {
    water: "su",
    surface_water: "yerüstü su",
    sediment: "dib çöküntüləri",
  },
  regions: {
    atyrau: "Atırau vilayəti",
    mangystau: "Mangistau vilayəti",
  },
  phenomena: {
    oil_film: "neft təbəqəsi",
    color_change: "suyun rənginin dəyişməsi",
    odor: "iy",
    fish_kill: "balıq ölümü",
    wastewater: "tullantı suları",
    other: "digər hadisə",
    verificationStatus: {
      unverified: "Təsdiqlənməyib",
      corroborated: "Müstəqil mənbələrlə təsdiqlənib",
      official: "Rəsmi mənbə",
      conflicting: "Mənbələr ziddiyyətlidir",
    },
  },
  dossier: {
    kicker: "Araşdırma dosyesi",
    linkLabel: "Dosye",
    openAction: "Dosyeni aç",
    section: {
      header: "Başlıq və yaradılma tarixi",
      disclaimer: "Hüquqi qeyd",
      conclusion: "Yekun ifadə",
      evidenceLevel: "Sübutluluq səviyyəsi",
      signals: "Siqnalların xronologiyası",
      measurements: "Ölçmələr",
      supportedFacts: "Nə müəyyən edilib",
      contradictedHypotheses: "Hadisəni izah etməyən versiyalar",
      unknowns: "Nə naməlumdur",
      candidateObjects: "Yoxlanılmalı obyektlər",
      sources: "Mənbələr",
      provenance: "Qaydaların versiyası və giriş məlumatlarının heşi",
    },
    printAction: "Çap / PDF yadda saxla",
    jsonAction: "JSON yüklə",
    jsonError: "JSON hazırlamaq mümkün olmadı.",
    backAction: "Araşdırma ekranına",
    regionLabel: "Vilayət",
    periodLabel: "Müşahidə dövrü",
    updatedAtLabel: "Nəticə yeniləndi",
    generatedAtLabel: "Dosye formalaşdırıldı",
    legalTitle: "Hüquqi qeyd",
    corridorLabel: "Sahə",
    corridorOpenUpPrefix: "Kəsimdən axın üzrə yuxarı açıqdır",
    corridorBetweenPrefix: "Kəsimlər arasında",
    corridorNone: "Sahənin sərhədləri müəyyən edilməyib.",
    noMapNote:
      "Kəsimlərin koordinatları təsdiqlənməyib, ona görə dosyedə xəritə verilmir: sahə sərhəd kəsimlərinin adları ilə təyin olunub.",
    noSignals: "Hadisəyə heç bir ictimai siqnal bağlanmayıb.",
    noMeasurements: "Hadisəyə heç bir ölçmə əlavə edilməyib.",
    noObjects: "Sahənin hüdudlarında yoxlanılmalı obyektlər sadalanmayıb.",
    timelineObserved: "Müşahidə olunub",
    timelineReported: "Bildirilib",
    measurementColumns: {
      station: "Kəsim",
      indicator: "Göstərici",
      matrix: "Mühit",
      sampledAt: "Nümunə tarixi",
      value: "Qiymət",
      source: "Mənbə",
    },
    measurementSharedPrefix: "Bütün sətirlərdə",
    noDate: "tarix göstərilməyib",
    completeness: {
      confirmed: "mənbələrdə birbaşa qeyd olunub",
      partial: "mənbələrdəki məlumatlar tam deyil",
    },
    objectBasisLabel: "Əsaslar",
    objectNoBasis: "Əsas sənədləri əlavə edilməyib.",
    sourcePagePrefix: "səh.",
    shaLabel: "SHA-256",
    shaNotComputed: "hesablanmayıb",
    rulesetLabel: "Qaydaların versiyası",
    inputHashLabel: "Giriş məlumatlarının heşi",
    rulesetMissing: "hesablama nüvəsi tərəfindən verilməyib",
    inputHashMissing: "hesablama nüvəsi tərəfindən verilməyib",
    provenanceNote:
      "Qaydaların versiyası və giriş məlumatlarının heşi hesablamanı təkrarlayıb " +
      "eyni nəticəni almağa imkan verir. Onları hesablama nüvəsi hesablayır; nüvə " +
      "qiymətləri ötürənə qədər dosye bu barədə birbaşa məlumat verir, ağlabatan " +
      "görünən qiymətləri əvəzinə qoymur.",
  },
  replay: {
    stepType: {
      signal: "İctimai siqnal",
      corroboration: "Hadisənin təsdiqi",
      measurement: "Laboratoriya qiymətləri",
      inference: "Qaydanın tətbiqi",
      conclusion: "Nəticə",
    },
    playLabel: "Replayı başlat",
    resumeLabel: "Replayı davam etdir",
    restartLabel: "Replayı yenidən başlat",
    pauseLabel: "Fasilə",
    exitLabel: "Replayı bitir",
    keyboardHint: "Replay: boşluq — başlat və fasilə, ←/→ — addımlarla",
    unavailable: "Bu hadisə üçün replay ssenarisi hələlik əlçatan deyil.",
    pending: "Replayın növbəti addımlarından birində görünəcək.",
    stepAriaLabel: "«{{step}}» addımına keç",
    measurementSummaryOne: "1 kəsim üzrə laboratoriya qiyməti yükləndi",
    measurementSummaryOther:
      "{{count}} kəsim üzrə laboratoriya qiymətləri yükləndi",
  },
  liveStatus: {
    sourceHealth: {
      healthy: {
        label: "Cavab verir",
        shortLabel: "cavab verir",
        description: "Son sorğu xətasız keçdi.",
      },
      never_run: {
        label: "Heç vaxt sorğulanmayıb",
        shortLabel: "sorğulanmayıb",
        description:
          "Mənbə konfiqurasiyada təsvir olunub, lakin ona hələ müraciət edilməyib.",
      },
      degraded: {
        label: "Fasilələrlə cavab verir",
        shortLabel: "fasilələrlə",
        description:
          "Sorğuların bir hissəsi xəta ilə bitir: mənbənin məlumatları tam olmaya bilər.",
      },
      rate_limited: {
        label: "Sorğu tezliyi məhdudiyyəti",
        shortLabel: "sorğu limiti",
        description:
          "Mənbə limitə görə xidmətdən müvəqqəti imtina edir: yenilənmə təxirə salınıb.",
      },
      failed: {
        label: "Əlçatmaz",
        shortLabel: "əlçatmaz",
        description: "Son sorğu xəta ilə bitdi.",
      },
    },
    triggerLabel: "Mənbələr",
    title: "Məlumatların vəziyyəti",
    sourcesTitle: "Xarici mənbələr",
    disclaimer:
      "Əlçatmaz mənbə — bu, məlumatlardakı boşluqdur, hadisənin olmaması deyil: " +
      "ekran yalnız artıq yoxlanılmışı göstərir.",
    lastSuccessLabel: "Son uğurlu sorğu",
    neverSucceeded: "uğurlu sorğu olmayıb",
    cacheAvailable: "son cavabın keşi var",
    cacheMissing: "keş yoxdur",
    allHealthy: "hamısı cavab verir",
    empty:
      "Mənbələr siyahısı boşdur: sorğulamağa bir şey yoxdur, bu da məlumatların vəziyyətidir.",
    loading: "vəziyyət dəqiqləşdirilir",
    error: "mənbələrin vəziyyəti alınmadı",
  },
  agentFlow: {
    title: "Agent necə işləyir",
    seedNotice: "Demo məlumatları göstərilir; mənbə vəziyyətləri cari xarici sorğu deyil.",
    footer: "Sİ siqnalı tapmağa və qurmağa kömək edir. Nəticə yalnız yoxlanmış məlumatlara əsaslanır.",
    step: {
      search: {
        title: "İctimai məlumatların axtarışı",
        description: "Sistem GDELT və icazəli birbaşa mənbələri yoxlayır.",
        statusGap: "Mənbə müvəqqəti əlçatmazdır — bu, məlumat boşluğudur, hadisələrin olmaması deyil.",
        statusAvailable: "Mənbə vəziyyəti API-dən alınıb.",
        statusUnknown: "Mənbənin cari vəziyyəti hələ alınmayıb.",
      },
      provenance: {
        title: "Mənşənin yoxlanması",
        description: "Mənbə üçün URL, nəşriyyatçı, snapshot və SHA-256 saxlanır.",
        summary: "Sənədlər: {{total}} · SHA-256 ilə: {{sha}} · snapshot ilə: {{snapshots}}",
      },
      candidate: {
        title: "Namizədin çıxarılması",
        description: "Sİ məkanı, hadisəni, dövrü və sitatı ayıra bilər. Namizəd təsdiqlənmiş fakt sayılmır.",
        badge: "Yoxlama tələb olunur",
      },
      official: {
        title: "Rəsmi məlumatlarla tutuşdurma",
        description: "Sistem nəşri Qazhidromet sənədi, PDF səhifəsi və laboratoriya qiymətləri ilə tutuşdurur.",
        summary: "Yoxlanmış ölçmələr: {{measurements}} · rəsmi sənədlər: {{documents}} · məlum səhifələr: {{pages}}",
      },
      analysis: {
        title: "Yoxlanmış faktların təhlili",
        description: "L0–L3, dəhliz, delta və conclusion investigation-core tərəfindən formalaşdırılır.",
      },
    },
  },
  investigationTrace: {
    title: "Seçilmiş araşdırmanın yoxlanması",
    loading: "Seçilmiş araşdırmanın məlumatları yüklənir.",
    error: "Seçilmiş araşdırmanın izini yükləmək mümkün olmadı.",
    stage: { signal: "İctimai siqnal", official: "Rəsmi yoxlama", measurements: "Ölçmələr", conclusion: "Deterministik nəticə" },
    noSignal: "İctimai siqnal yoxdur.",
    noOfficialDocument: "Rəsmi sənəd əlavə edilməyib.",
    reportedAt: "Dərc edilib: {{value}}",
    location: "Məkan: {{value}}",
    phenomenon: "Hadisə: {{value}}",
    extractionModeLabel: "Çıxarma rejimi",
    extractionMode: { llm_verified: "Sİ namizədi; yoxlama vəziyyəti ayrıca göstərilib", verified_seed: "Yoxlanmış demo fixture; Sİ işə salınmayıb", rule: "Qayda ilə çıxarılıb" },
    verificationLabel: "Yoxlama vəziyyəti",
    pageUnknown: "Mənbə səhifəsi göstərilməyib.",
    pageKnown: "Mənbə səhifəsi: {{page}}",
    sourceStatusLabel: "Sənədin vəziyyəti",
    sourceStatus: { verified: "yoxlanıb", unverified: "yoxlanmayıb", unavailable: "əlçatmazdır" },
    measurementSummary: "Ölçmələr: {{total}} · təhlil üçün təsdiqlənib: {{verified}}",
    sampledPeriods: "Nümunə dövrü və ya tarixi: {{value}}",
    sourcePages: "Səhifə məlumdur: {{known}} · göstərilməyib: {{unknown}}",
    units: "Vahidlər: {{value}}",
    unknownValue: "göstərilməyib",
    corridor: { none: "Sahənin sərhədləri müəyyən edilməyib.", open_upstream: "Sahə axın üzrə yuxarı açıqdır.", between: "Sahə iki kəsimlə məhdudlaşır." },
    unknowns: "Məlumat boşluqları: {{count}}",
    conclusionDisclaimer: "Araşdırmanın nəticəsi bunu göstərirsə, mənbə müəyyən edilməyib. Deterministik nəticə Sİ-yə aid edilmir.",
  },
  stubs: {
    source: {
      incidents: {
        screenArea: "Hadisələr lenti, çay sxemi, sağ panel, dosye",
      },
      replay: { screenArea: "Replay ssenarisi" },
      export: { screenArea: "JSON formatında dosye" },
      "live-status": { screenArea: "Mənbələrin vəziyyəti (bu siyahı)" },
    },
    mapCoordsDisclaimerTitle: "Xəritədəki koordinatlar",
    mapCoordsDisclaimer:
      "Nümayiş xarakterlidir. Məlumatlarda kəsimlərin təsdiqlənmiş koordinatları " +
      "yoxdur: kəsimlərin axın üzrə aşağı sırası sənədlərlə təsdiqlənib, nöqtələrin " +
      "ərazidəki mövqeyi — yox. Zəncirdəki yeri təsdiqlənməyən kəsim və obyektlər " +
      "ümumiyyətlə xəritəyə çıxarılmır.",
    badgeLabel: "maket",
    dataModeTitle: "Məlumat rejimi",
    dataModeSeedSummary:
      "Məlumatlar API-dən deyil, yığımdakı yoxlanılmış fayldan oxunur: bekend hələ qoşulmayıb.",
    dataModeSeedExplanation:
      "Rəqəmlər isə uydurulmayıb: qiymətlər, səhifələr və SHA-256 — Qazhidrometin " +
      "bülletenlərindəndir. Maket — bu, çatdırılma üsuludur, məlumat mənbəyi deyil.",
    dataModeApiSummary:
      "Məlumatlar API-dən oxunur. Hər endpoint cavabı şəbəkə sərhədində müqavilə sxemi ilə yoxlanılır.",
    endpointReady: "endpoint qaldırılıb",
    endpointMissing: "endpoint hələ yoxdur",
  },
  a11y: {
    feedRegion: "Siqnallar və araşdırmalar",
    schemeRegion: "Çayın xətti sxemi",
    mapRegion: "Sahənin xəritəsi",
    panelRegion: "Nəticə və sübutlar",
    replayTimeline: "Replay şkalası",
  },
  landing: {
    metaTitle: "Каспийский след — экологические расследования по открытым данным",
    metaDescription:
      "Сервис, который объединяет открытые сообщения, официальные документы и спутниковые данные в единую цепочку событий.",
    eyebrow: "Экологические расследования по открытым данным",
    title: "Понять, где началось загрязнение — без поспешных обвинений",
    description:
      "«Каспийский след» объединяет сообщения, официальные документы и спутниковые данные в единую цепочку событий.",
    cta: "Перейти к проекту",
    ctaHint: "Факты, источники и вывод — на одном экране.",
    flow: {
      step1Title: "Сигнал",
      step1Desc: "Появляется сообщение о проблеме.",
      step2Title: "Источник",
      step2Desc: "Проверяется происхождение информации.",
      step3Title: "Карта",
      step3Desc: "Факты связываются с местом и временем.",
      step4Title: "Вывод",
      step4Desc: "Показывается то, что известно и что ещё нужно проверить.",
    },
    problem: {
      title: "Почему это важно",
      description:
        "Информация об экологических происшествиях часто разбросана по разным источникам.",
      item1Title: "Данные разбросаны",
      item1Desc: "Нужные материалы находятся в разных местах.",
      item2Title: "Источники сложно сопоставить",
      item2Desc:
        "Не всегда понятно, какие сообщения относятся к одному событию.",
      item3Title: "Предположения часто выглядят как факты",
      item3Desc: "Ближайший объект могут ошибочно принять за источник загрязнения.",
    },
    solution: {
      title: "Одна проверяемая картина",
      description:
        "Сервис собирает доступные материалы, связывает их между собой и показывает историю изменений.",
      step1Title: "Собираем",
      step1Desc: "Открытые сообщения и официальные материалы.",
      step2Title: "Проверяем",
      step2Desc:
        "Сохраняем источник и отделяем подтверждённые сведения от предположений.",
      step3Title: "Показываем",
      step3Desc: "Карту, факты, возможный участок и пробелы в данных.",
      disclaimer:
        "Система не назначает виновных. Если доказательств недостаточно, факт остается не подтвержденным.",
    },
    finalCta: {
      title: "Посмотрите, как это работает",
      description:
        "Откройте интерактивный экран проекта и изучите расследования.",
      caption: "Карта, источники, вывод и история изменений.",
    },
    footer: {
      tagline: "Проверка версий происхождения загрязнения по открытым данным",
    },
  },
} as const satisfies TranslationResource
