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
    objectPlacementBasis: {
      "obj-atyrau-su-arnasy":
        "Mövqe koordinatlardan deyil, Qazhidromet bülleteninin kəsim adlarından çıxarılıb («axıdılmadan 0,5 km yuxarı» və «axıdılmadan 0,5 km aşağı», səh. 22): obyektin koordinatları verilməyib.",
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
} as const satisfies TranslationResource
