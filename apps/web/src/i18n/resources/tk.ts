import type { TranslationResource } from "./types"

// Türkmençe — latyn elipbiýi (1993-nji ýyldan bäri Türkmenistanda resmi ýazuw).
//
// Юридически чувствительные строки: «barlanmaly desga» — нейтральный залог,
// никаких слов со значением «günäkär» / «bozujy» / «hapalaýjy».
// Имена собственные («Caspian Trace», названия юрлиц) не переводятся.
export const tk = {
  app: {
    name: "Caspian Trace",
    tagline:
      "Açyk maglumatlar boýunça hapalanmagyň gelip çykyşy baradaky çaklamalary barlamak",
    legalDisclaimer:
      "Hapalanmagyň çeşmesi anyklanylmady. Ady agzalan ähli desgalar — barlanmaly desgalardyr; material hiç kimiň günäkärdigi barada tassyklama saklamaýar. Netijeler açyk çeşmeler boýunça kesgitli düzgünler bilen düzüldi we täze maglumatlar ýüze çykanda üýtgäp biler.",
    objectForReview: "barlanmaly desga",
    dataLoadError: "Waka maglumatlaryny ýükläp bolmady.",
  },
  insufficientData: {
    title: "Maglumat ýeterlik däl",
    explanation:
      "Bu ýalňyşlyk däl: netije barlap boljak faktlar bilen tassyklanýança çap edilmeýär.",
    reasonsLabel: "Näme ýetmeýär",
  },
  language: {
    label: "Interfeýsiň dili",
  },
  panel: {
    section: {
      conclusion: { title: "Netije" },
      evidenceLevel: { title: "Subutnama derejesi" },
      supportedFacts: { title: "Näme anyklanyldy" },
      contradictedHypotheses: { title: "Näme tassyklanmaýar" },
      unknowns: { title: "Näme näbelli" },
      sources: { title: "Çeşmeler" },
    },
    noFacts: "Hasaplaýyş özeni tassyklaýjy tassyklama çykarmady.",
    noRejected:
      "Häzirlikçe hiç bir anyk çaklama faktlar bilen aradan aýrylmady.",
    noUnknowns: "Maglumatlardaky boşluklar sanalmady.",
    noSources: "Çeşme resminamalary goşulmady.",
  },
  evidence: {
    L0: {
      label: "Barlanmadyk signal",
      description:
        "Bir neşir ýa-da köpçülikleýin habar bar. Barlaghana tassyklamasy ýok.",
    },
    L1: {
      label: "Waka tassyklandy",
      description:
        "Waka iki garaşsyz çeşmede beýan edildi, resmi çeşme bar ýa-da nusga almagyň netijeleri çap edildi.",
    },
    L2: {
      label: "Çeşme bölege çenli anyklanyldy",
      description:
        "Fiziki taýdan mümkin bölek kesgitlenildi; iň azyndan bir geografik çaklama maglumatyň ýoklugy bilen däl, fakt bilen aradan aýryldy.",
    },
    L3: {
      label: "Geçelge barlaghana maglumatlary bilen goldanýar",
      description:
        "Bir senede we deňeşdirip boljak birliklerde goňşy kesimleriň arasynda jübüt ölçegler bar. Bu günäkäriň anyklanandygyny aňlatmaýar.",
    },
  },
  feed: {
    signalsHeading: "Signallar",
    noSignals: "Waka hiç bir köpçülikleýin signal baglanyşdyrylmady.",
    noIncidents: "Maglumatlarda häzirlikçe waka ýok.",
    signalObservedPrefix: "syn edildi",
    signalReportedPrefix: "habar berildi",
    signalDetailsLabel: "sitata, ýer we çeşme",
  },
  comparison: {
    switcherLabel: "Şu bölegiň syn döwürleri",
    verdictChangeTitle: "Netije üýtgedi",
    verdictChangeBefore: "Öňki",
    verdictChangeExplanation:
      "Netije anyk ölçegleriň faktlaryndan gelip çykýar: başga döwür — kesimlerde " +
      "başga bahalar, şonuň üçin subutnama derejesi-de, haýsy çaklamalary aradan " +
      "aýyrmagyň mümkindigi-de üýtgeýär. Bu barlanýan desgalara gaýtadan baha " +
      "bermek däldir.",
    verdictChangeDismiss: "Deňeşdirmäni gizle",
  },
  scheme: {
    upstreamHint: "ýokarda — akym boýunça ýokarda",
    unconfirmedOrderHint: "kesimleriň tertibi tassyklanmady",
    partialOrderHint: "tertip ähli kesimler üçin tassyklanmady",
    unorderedNote:
      "Kesimleriň akym boýunça tertibi elde tassyklanmady, şonuň üçin shema nokatlary tertipleşdirmeýär: setirleriň yzygiderliligi derýanyň akymyny görkezmeýär.",
    unorderedLabel: "bu kesimleriň tertibi tassyklanmady",
    corridorLabel: "çak edilýän geçelge",
    corridorOpenUpNote: "akym boýunça ýokary açyk",
    corridorBoundLabel: "geçelgäniň serhedi",
    corridorUpperBoundTooltip: "Çak edilýän geçelgäniň ýokarky serhedi.",
    corridorLowerBoundTooltip: "Çak edilýän geçelgäniň aşaky serhedi.",
    corridorOpenUpTooltip:
      "Çak edilýän geçelge akym boýunça ýokary açyk: çeşmäni şu kesimden ýokarda gözlemeli.",
    noValueLabel: "baha ýok",
  },
  map: {
    placeholderChip: "demo-koordinatlar",
    placeholderWarning:
      "Kartadaky koordinatlar görkeziş häsiýetlidir: maglumatlarda kesimleriň tassyklanan koordinatlary ýok. Kesimleriň akym boýunça aşak tertibi resminamalar bilen tassyklandy, nokatlaryň ýerdäki ýerleşişi — ýok.",
    unplacedChip: "ýerleşişi tassyklanmady",
    corridorOpenUpstreamLabel: "bölek akym boýunça ýokary açyk",
    unplacedNote:
      "Bu kesimler we desgalar üçin akym zynjyryndaky ýer resminamalar bilen tassyklanmady, şonuň üçin olar kartada ýerleşdirilmedi.",
    candidateLabel: "barlanmaly desga",
    verdictCorridorPrefix: "Bölek:",
    verdictOpenUpstreamPrefix: "kesimden ýokarda",
    verdictBetweenPrefix: "kesimleriň arasynda",
    verdictExcludedPrefix: "Faktlar bilen aradan aýryldy:",
    verdictDossierLink: "Dosýe",
    measurementsTrigger: "Ölçegler",
    objectOutsideCorridor: "bölekden daşarda",
    objectInsideCorridor: "bölegiň çäginde",
    objectCorridorUnknown: "bölege görä ýerleşişi kesgitlenmedi",
    objectPlacementBasis: {
      "obj-atyrau-su-arnasy":
        "Ýerleşişi koordinatlardan däl, Gazgidrometiň býulleteniniň kesim atlaryndan çykaryldy («akdyryşdan 0,5 km ýokarda» we «akdyryşdan 0,5 km aşakda», 22-nji sah.): desganyň koordinatlary berilmedi.",
    },
    coordinateMode: {
      verifiedLabel: "Ýerleşişi çeşme bilen tassyklandy",
      verifiedStation: "Kesimiň ýerleşişi çeşme bilen tassyklandy",
      verifiedObject: "Desganyň ýerleşişi çeşme bilen tassyklandy",
      schematicLabel: "Shemalaýyn ýerleşiş",
      schematicStation: "Kesimiň shemalaýyn ýerleşişi",
      schematicStationDetail: "Kesimiň takyk GPS ýerleşişi tassyklanmady.",
      schematicObjectDetail:
        "Bu desganyň koordinaty hem-de sebäpli baglanyşygyň subutnamasy däl.",
      schematicDisclaimer:
        "Shemalaýyn ýerleşiş — takyk koordinatlar tassyklanmady. Karta düşegi bu ýerleşişi GPS maglumatyna öwürmeýär.",
      markerSummary: "Tassyklanan: {{verified}} · shemalaýyn: {{schematic}}",
    },
  },
  units: {
    "mg/dm3": "mg/dm³",
    "mg/kg": "mg/kg",
    percent: "%",
  },
  matrix: {
    water: "suw",
    surface_water: "ýerüsti suw",
    sediment: "düýp çökündileri",
  },
  regions: {
    atyrau: "Atyrau welaýaty",
    mangystau: "Mangystau welaýaty",
  },
  phenomena: {
    oil_film: "nebit gatlagy",
    color_change: "suwuň reňkiniň üýtgemegi",
    odor: "ys",
    fish_kill: "balyklaryň gyrylmagy",
    wastewater: "akdyrylýan suwlar",
    other: "başga hadysa",
    verificationStatus: {
      unverified: "Tassyklanmady",
      corroborated: "Garaşsyz çeşmeler bilen tassyklandy",
      official: "Resmi çeşme",
      conflicting: "Çeşmeler biri-birine garşy gelýär",
    },
  },
  dossier: {
    kicker: "Derňew dosýesi",
    linkLabel: "Dosýe",
    openAction: "Dosýäni aç",
    section: {
      header: "Sözbaşy we döredilen senesi",
      disclaimer: "Hukuk bellikleri",
      conclusion: "Jemleýji beýannama",
      evidenceLevel: "Subutnama derejesi",
      signals: "Signallaryň hronologiýasy",
      measurements: "Ölçegler",
      supportedFacts: "Näme anyklanyldy",
      contradictedHypotheses: "Wakany düşündirmeýän çaklamalar",
      unknowns: "Näme näbelli",
      candidateObjects: "Barlanmaly desgalar",
      sources: "Çeşmeler",
      provenance: "Düzgünleriň wersiýasy we giriş maglumatlarynyň heşi",
    },
    printAction: "Çap et / PDF sakla",
    jsonAction: "JSON ýükle",
    jsonError: "JSON taýýarlap bolmady.",
    backAction: "Derňew ekranyna",
    regionLabel: "Welaýat",
    periodLabel: "Syn döwri",
    updatedAtLabel: "Netije täzelendi",
    generatedAtLabel: "Dosýe düzüldi",
    legalTitle: "Hukuk bellikleri",
    corridorLabel: "Bölek",
    corridorOpenUpPrefix: "Kesimden akym boýunça ýokary açyk",
    corridorBetweenPrefix: "Kesimleriň arasynda",
    corridorNone: "Bölegiň serhetleri kesgitlenmedi.",
    noMapNote:
      "Kesimleriň koordinatlary tassyklanmady, şonuň üçin dosýede karta getirilmeýär: bölek serhet kesimleriniň atlary bilen berildi.",
    noSignals: "Waka hiç bir köpçülikleýin signal baglanyşdyrylmady.",
    noMeasurements: "Waka hiç bir ölçeg goşulmady.",
    noObjects: "Bölegiň çäginde barlanmaly desgalar sanalmady.",
    timelineObserved: "Syn edildi",
    timelineReported: "Habar berildi",
    measurementColumns: {
      station: "Kesim",
      indicator: "Görkeziji",
      matrix: "Gurşaw",
      sampledAt: "Nusga alnan sene",
      value: "Baha",
      source: "Çeşme",
    },
    measurementSharedPrefix: "Ähli setirlerde",
    noDate: "sene görkezilmedi",
    completeness: {
      confirmed: "çeşmelerde göni agzalýar",
      partial: "çeşmelerdäki maglumatlar doly däl",
    },
    objectBasisLabel: "Esaslar",
    objectNoBasis: "Esas resminamalary goşulmady.",
    sourcePagePrefix: "sah.",
    shaLabel: "SHA-256",
    shaNotComputed: "hasaplanmady",
    rulesetLabel: "Düzgünleriň wersiýasy",
    inputHashLabel: "Giriş maglumatlarynyň heşi",
    rulesetMissing: "hasaplaýyş özeni tarapyndan berilmedi",
    inputHashMissing: "hasaplaýyş özeni tarapyndan berilmedi",
    provenanceNote:
      "Düzgünleriň wersiýasy we giriş maglumatlarynyň heşi hasaplamany gaýtalap, " +
      "şol bir netijäni almaga mümkinçilik berýär. Olary hasaplaýyş özeni hasaplaýar; " +
      "özen bahalary bermeýänçä, dosýe bu barada göni habar berýär, ynandyryjy " +
      "görünýän bahalary ornuna goýmaýar.",
  },
  replay: {
    stepType: {
      signal: "Köpçülikleýin signal",
      corroboration: "Wakanyň tassyklanmagy",
      measurement: "Barlaghana bahalary",
      inference: "Düzgüniň ulanylmagy",
      conclusion: "Netije",
    },
    playLabel: "Repleýi başlat",
    resumeLabel: "Repleýi dowam etdir",
    restartLabel: "Repleýi täzeden başlat",
    pauseLabel: "Arakesme",
    exitLabel: "Repleýi tamamla",
    keyboardHint: "Repleý: boşluk — başlatmak we arakesme, ←/→ — ädimme-ädim",
    unavailable: "Bu waka üçin repleý ssenarisi häzirlikçe elýeterli däl.",
    pending: "Repleýiň indiki ädimleriniň birinde peýda bolar.",
    stepAriaLabel: "«{{step}}» ädimine geç",
    measurementSummaryOne: "1 kesim boýunça barlaghana bahasy ýüklendi",
    measurementSummaryOther:
      "{{count}} kesim boýunça barlaghana bahalary ýüklendi",
  },
  liveStatus: {
    sourceHealth: {
      healthy: {
        label: "Jogap berýär",
        shortLabel: "jogap berýär",
        description: "Soňky soralyş ýalňyşsyz geçdi.",
      },
      never_run: {
        label: "Hiç haçan soralmady",
        shortLabel: "soralmady",
        description:
          "Çeşme konfigurasiýada beýan edildi, ýöne oňa entek ýüz tutulmady.",
      },
      degraded: {
        label: "Arakesmeler bilen jogap berýär",
        shortLabel: "arakesmeler bilen",
        description:
          "Soraglaryň bir bölegi ýalňyşlyk bilen tamamlanýar: çeşmäniň maglumatlary doly bolmazlygy mümkin.",
      },
      rate_limited: {
        label: "Soraglaryň ýygylygynyň çäklendirmesi",
        shortLabel: "sorag çäklendirmesi",
        description:
          "Çeşme çäklendirme boýunça hyzmatdan wagtlaýyn ýüz öwürýär: täzelenme yza süýşürildi.",
      },
      failed: {
        label: "Elýeterli däl",
        shortLabel: "elýeterli däl",
        description: "Soňky soralyş ýalňyşlyk bilen tamamlandy.",
      },
    },
    triggerLabel: "Çeşmeler",
    title: "Maglumatlaryň ýagdaýy",
    sourcesTitle: "Daşarky çeşmeler",
    disclaimer:
      "Elýeterli däl çeşme — bu maglumatlardaky boşlukdyr, wakanyň ýoklugy däl: " +
      "ekran diňe eýýäm barlananyny görkezýär.",
    lastSuccessLabel: "Soňky üstünlikli soralyş",
    neverSucceeded: "üstünlikli soralyş bolmady",
    cacheAvailable: "soňky jogabyň keşi bar",
    cacheMissing: "keş ýok",
    allHealthy: "hemmesi jogap berýär",
    empty:
      "Çeşmeleriň sanawy boş: soramaga zat ýok, bu-da maglumatlaryň ýagdaýydyr.",
    loading: "ýagdaý anyklanylýar",
    error: "çeşmeleriň ýagdaýy alynmady",
  },
  agentFlow: {
    title: "Agent nähili işleýär",
    seedNotice: "Demo maglumatlary görkezilýär; çeşme ýagdaýlary häzirki daşarky sorag däl.",
    footer: "AI signaly tapmaga we tertiplemäge kömek edýär. Jemleýji netije diňe barlanan maglumatlardan gurulýar.",
    step: {
      search: {
        title: "Jemgyýetçilik habarlaryny gözlemek",
        description: "Ulgam GDELT-i we rugsat edilen göni çeşmeleri barlaýar.",
        statusGap: "Çeşme wagtlaýyn elýeterli däl — bu maglumat boşlugy, hadysalaryň ýoklugy däl.",
        statusAvailable: "Çeşmäniň ýagdaýy API-den alyndy.",
        statusUnknown: "Çeşmäniň häzirki ýagdaýy entek alynmady.",
      },
      provenance: {
        title: "Gelip çykyşyny barlamak",
        description: "Çeşme üçin URL, neşirçi, snapshot we SHA-256 saklanýar.",
        summary: "Resminamalar: {{total}} · SHA-256 bilen: {{sha}} · snapshot bilen: {{snapshots}}",
      },
      candidate: {
        title: "Kandidaty çykarmak",
        description: "AI ýeri, hadysany, döwri we sitatany saýlap biler. Kandidat tassyklanan fakt hasaplanmaýar.",
        badge: "Barlag gerek",
      },
      official: {
        title: "Resmi maglumatlar bilen deňeşdirmek",
        description: "Ulgam habary Gazgidromet resminamasy, PDF sahypasy we laboratoriýa bahalary bilen deňeşdirýär.",
        summary: "Barlanan ölçegler: {{measurements}} · resmi resminamalar: {{documents}} · belli sahypalar: {{pages}}",
      },
      analysis: {
        title: "Barlanan faktlaryň seljermesi",
        description: "L0–L3, koridor, delta we conclusion investigation-core tarapyndan döredilýär.",
      },
    },
  },
  investigationTrace: {
    title: "Saýlanan derňewi barlamak",
    loading: "Saýlanan derňewiň maglumatlary ýüklenýär.",
    error: "Saýlanan derňewiň yzyny ýükläp bolmady.",
    stage: { signal: "Jemgyýetçilik signaly", official: "Resmi barlag", measurements: "Ölçegler", conclusion: "Deterministik netije" },
    noSignal: "Jemgyýetçilik signaly ýok.",
    noOfficialDocument: "Resmi resminama goşulmady.",
    reportedAt: "Çap edildi: {{value}}",
    location: "Ýer: {{value}}",
    phenomenon: "Hadysa: {{value}}",
    extractionModeLabel: "Çykaryş tertibi",
    extractionMode: { llm_verified: "AI-kandidat; barlag ýagdaýy aýratyn görkezilýär", verified_seed: "Barlanan demo fixture; AI işletilmedi", rule: "Düzgün bilen çykaryldy" },
    verificationLabel: "Barlag ýagdaýy",
    pageUnknown: "Çeşme sahypasy görkezilmedi.",
    pageKnown: "Çeşme sahypasy: {{page}}",
    sourceStatusLabel: "Resminamanyň ýagdaýy",
    sourceStatus: { verified: "barlanan", unverified: "barlanmadyk", unavailable: "elýeterli däl" },
    measurementSummary: "Ölçegler: {{total}} · seljeriş üçin tassyklandy: {{verified}}",
    sampledPeriods: "Nusga döwri ýa-da senesi: {{value}}",
    sourcePages: "Sahypa belli: {{known}} · görkezilmedi: {{unknown}}",
    units: "Birlikler: {{value}}",
    unknownValue: "görkezilmedi",
    corridor: { none: "Bölegiň çäkleri kesgitlenmedi.", open_upstream: "Bölek akym boýunça ýokary açyk.", between: "Bölek iki kesim bilen çäklenýär." },
    unknowns: "Maglumat boşluklary: {{count}}",
    conclusionDisclaimer: "Derňewiň netijesi şeýle görkezse, çeşme kesgitlenmedi. Deterministik netije AI-a degişli edilmeýär.",
  },
  stubs: {
    source: {
      incidents: {
        screenArea: "Wakalar lentasy, derýanyň shemasy, sag panel, dosýe",
      },
      replay: { screenArea: "Repleý ssenarisi" },
      export: { screenArea: "JSON formatyndaky dosýe" },
      "live-status": { screenArea: "Çeşmeleriň ýagdaýy (şu sanaw)" },
    },
    mapCoordsDisclaimerTitle: "Kartadaky koordinatlar",
    mapCoordsDisclaimer:
      "Görkeziş häsiýetlidir. Maglumatlarda kesimleriň tassyklanan koordinatlary " +
      "ýok: kesimleriň akym boýunça aşak tertibi resminamalar bilen tassyklandy, " +
      "nokatlaryň ýerdäki ýerleşişi — ýok. Zynjyrdaky ýeri tassyklanmadyk kesimler " +
      "we desgalar karta asla çykarylmaýar.",
    badgeLabel: "maket",
    dataModeTitle: "Maglumat režimi",
    dataModeSeedSummary:
      "Maglumatlar API-den däl, ýygnamadaky barlanan faýldan okalýar: bekend entek birikdirilmedi.",
    dataModeSeedExplanation:
      "Sanlar welin oýlanyp tapylmady: bahalar, sahypalar we SHA-256 — " +
      "Gazgidrometiň býulletenlerinden. Maket — bu eltip bermegiň usuly, " +
      "maglumatyň çeşmesi däl.",
    dataModeApiSummary:
      "Maglumatlar API-den okalýar. Her endpointiň jogaby ulgamyň serhedinde şertnama shemasy bilen barlanýar.",
    endpointReady: "endpoint göterildi",
    endpointMissing: "endpoint entek ýok",
  },
  a11y: {
    feedRegion: "Signallar we derňewler",
    schemeRegion: "Derýanyň çyzykly shemasy",
    mapRegion: "Bölegiň kartasy",
    panelRegion: "Netije we subutnamalar",
    replayTimeline: "Repleý şkalasy",
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
