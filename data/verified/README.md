# Проверка verified fixtures

Автоматическая проверка структуры:

```bash
npm run verify:investigation-data
```

Финальная проверка, которая завершается ошибкой без двух людей:

```bash
node scripts/verify-investigation-data.mjs --require-human
```

Для каждого измерения два участника независимо сверяют `stationLabel`,
`rawValueText`, `unit`, `sourcePage` и `sourceExcerpt` с PDF. Для каждой связи
станций они также сверяют направление `upstream -> downstream`, страницу,
основание и точную выдержку. После проверки каждый добавляет свой GitHub username
в `checkedBy`. Автоматическая запись
`codex-automated-source-verification` человеком не считается.

Когда каждый demo-показатель содержит два разных человеческих username:

1. установить `reviewPolicy.completedHumanReviewers` в `2`;
2. установить `reviewPolicy.status` в `complete`;
3. запустить финальную команду выше;
4. получить review двух участников на commit с изменением manifest/fixtures.

Нельзя повышать счётчик вручную без записей `checkedBy` у каждого измерения и
каждой связи станций.
