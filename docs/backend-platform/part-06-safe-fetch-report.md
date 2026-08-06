# Backend Platform — Part 06: SafeFetchService

## 1. Результат

Реализованы подключённые к NestJS `SafeFetchModule` и singleton `SafeFetchService` с внутренними методами `fetchBuffer`, `fetchText` и `fetchJson`. Сервис делает только исходящие `GET` по HTTPS, проверяет точный hostname, все DNS A/AAAA-ответы и каждый redirect, а фактическое TLS-соединение закрепляет за уже проверенным IP.

Ответ принимается потоково с жёстким лимитом размера и content type, timeout охватывает DNS и transport и уничтожает request/response. Реализованы одна повторная попытка, `Retry-After`/backoff и ограниченный process-local last-success LRU cache со статусами `healthy`, `degraded` и `rate_limited`. Cache pipeline исправлен: buffer записывается после transport validation, text — только после strict UTF-8 decode, JSON — только после UTF-8, parse и успешной Zod schema. Невалидный HTTP `200` больше не создаёт cache entry и не заменяет существующий valid stale response.

Реальный необязательный smoke к публичной HTML-странице Казгидромета: **PASS**, HTTP `200`, `108463` bytes. Публичный fetch endpoint, ingestion, PDF parsing, SourceHealth и записи в DB/Storage не создавались.

## 2. Preflight

- Ветка: `feat/backend-platform` — требуемая ветка.
- Исходный commit: `10caf7734355367b3f4ad1a4642478f142a65513` (`feat(api): add immutable source storage cache`).
- Исходный worktree: clean.
- Runtime финального прогона: Node `v20.20.2`, npm `10.8.2`; `PATH` явно закреплялся на Node 20.20.2, потому что новые shell-сессии среды иначе выбирали системный Node 24.
- `npm ci --include=optional`: **PASS**, 1067 packages; npm audit сообщил 6 известных dependency findings (4 moderate, 2 high), автоматическое breaking-обновление не выполнялось.
- Part 05 до начала работы: реализован immutable Supabase Storage source cache; в этом прогоне source DB e2e и реальный private Storage smoke повторно прошли.
- Part 03 production gate: **BLOCKED** ожидаемо, human review `0/2`; validate-only подтвердил `databaseWrites: 0`.

Перед правками изучены Part 01–05 reports, Part 06 TODO, role/roadmap/context, текущие config/common HTTP/SourcesModule, package scripts и archive implementation/tests. `apps/web/**`, Backend 2 и `data/verified/**` не изменялись.

## 3. Изменённые файлы

### Runtime

- `apps/api/src/common/http/safe-fetch.module.ts` — feature module и DI bindings singleton-провайдеров.
- `apps/api/src/common/http/safe-fetch/dns-resolver.port.ts` — узкий DNS port.
- `apps/api/src/common/http/safe-fetch/https-transport.port.ts` — типизированная граница HTTPS transport и injectable request factory.
- `apps/api/src/common/http/safe-fetch/node-dns-resolver.service.ts` — `dns/promises.lookup({all:true, verbatim:true})`.
- `apps/api/src/common/http/safe-fetch/node-https-transport.service.ts` — pinned `https.request`, Host/SNI, streaming и abort cleanup.
- `apps/api/src/common/http/safe-fetch/public-ip.ts` — IPv4/IPv6 special-range guard.
- `apps/api/src/common/http/safe-fetch/response-cache.ts` — bounded last-success LRU cache с copy-on-read/write.
- `apps/api/src/common/http/safe-fetch/retry-policy.ts` — безопасный `Retry-After` и capped jitter backoff.
- `apps/api/src/common/http/safe-fetch/safe-fetch.constants.ts` — DI tokens, redirect/retry limits и поддерживаемые media types.
- `apps/api/src/common/http/safe-fetch/safe-fetch.errors.ts` — стабильные внутренние error codes без raw transport details.
- `apps/api/src/common/http/safe-fetch/safe-fetch.runtime.ts` — injectable clock/random/sleep runtime для детерминированных tests.
- `apps/api/src/common/http/safe-fetch/safe-fetch.service.ts` — orchestration URL/DNS/pin/redirect/retry и validation-before-cache для трёх внутренних fetch API.
- `apps/api/src/common/http/safe-fetch/safe-fetch.types.ts` — policy/result/metadata/Zod types.
- `apps/api/src/common/http/safe-fetch/safe-url.ts` — строгая URL/policy validation и cache fingerprint.
- `apps/api/src/app.module.ts` — подключение `SafeFetchModule`, без REST controller.
- `apps/api/src/config/environment.ts` — validated timeout, user-agent, retry и cache bounds.
- `apps/api/.env.example` — безопасные Part 06 placeholders/defaults.

### Tests и scripts

- `apps/api/test/safe-fetch/safe-url.spec.ts` — URL/policy security cases.
- `apps/api/test/safe-fetch/public-ip.spec.ts` — public/special IPv4/IPv6 classification.
- `apps/api/test/safe-fetch/retry-policy.spec.ts` — Retry-After/backoff/cap.
- `apps/api/test/safe-fetch/response-cache.spec.ts` — LRU bounds, expiry и Buffer isolation.
- `apps/api/test/safe-fetch/safe-fetch.service.spec.ts` — DNS/pin/redirect/retry/cache/text/JSON orchestration, включая запрет cache poisoning невалидным representation.
- `apps/api/test/safe-fetch/node-https-transport.spec.ts` — transport integration boundary, Host/SNI/lookup/stream/abort.
- `apps/api/test/safe-fetch/safe-fetch.module.spec.ts` — Nest DI и singleton scope.
- `apps/api/test/safe-fetch/test-environment.ts` — isolated validated test config.
- `apps/api/test/config.spec.ts` — Part 06 env defaults и negative validation.
- `apps/api/test/set-env.ts` — deterministic test env.
- `scripts/verify-safe-fetch.mjs` — реальный bounded Kazhydromet HTML smoke без логирования URL/body.
- `scripts/verify-api-clean-start.mjs` — Part 06 env для clean compiled/dev startup.
- `apps/api/package.json` — workspace `test:safe-fetch`.
- `package.json` — root SafeFetch unit/smoke scripts.

### Archive/report

- `scripts/create-backend-platform-archive.mjs` — Part 06 smoke allowlist и запрет DNS/body/cache dumps и HAR.
- `scripts/create-backend-platform-archive.test.mjs` — Part 06 inclusion/exclusion regression.
- `docs/backend-platform/part-06-safe-fetch-report.md` — этот единый flat report.

`package-lock.json`, contracts, Prisma schema и migrations не изменялись; новая runtime dependency не понадобилась.

## 4. Architecture

- `SafeFetchModule` — не global feature module; экспортирует ровно `SafeFetchService`. Default Nest scope обеспечивает один service/cache/transport/DNS provider на application context.
- `SafeFetchService` — transport-independent orchestration и единственная внутренняя точка исходящего HTTP для следующих частей.
- `DnsResolverPort` — возвращает все адреса с family; Node adapter использует системный resolver с `all` и `verbatim`.
- `HttpsTransportPort` — получает уже проверенный `PinnedAddress`; Node adapter запрещает повторное DNS-разрешение через custom `lookup`.
- `SafeFetchResponseCache` — process-local `Map` в LRU-порядке, ограниченный числом entries и суммой body bytes.
- Retry policy — максимум две network attempts, задержка через capped `Retry-After` или exponential jitter backoff.
- Representation validator передаётся в общий fetch pipeline: cache write выполняется только после его успешного завершения, а fresh/stale JSON повторно проходит caller schema.
- Архитектура следует feature-module/DI подходу NestJS; тесты подменяют только внешние DNS/transport/runtime границы.

## 5. SSRF protection

- Принимается только `URL`, только `https:`, без credentials, fragment, IP literal, trailing-dot hostname и порта кроме normalised/default `443`.
- Allowlist — точное сравнение lower-case hostname; suffix/wildcard совпадений нет.
- На каждой attempt и каждом redirect резолвятся все A/AAAA. Пустой/невалидный ответ отклоняется; любой private/special адрес блокирует весь hostname.
- Заблокированы unspecified, loopback, RFC1918, CGNAT, link-local, documentation, benchmarking, multicast/reserved IPv4; unspecified/loopback, mapped, NAT64 special, documentation, 6to4, unique-local, link-local/site-local и multicast IPv6.
- Mixed public/private DNS result отклоняется целиком.
- Выбранные address/family передаются custom `lookup`; socket не может повторно разрешить hostname и уйти на rebinding target.
- TLS `servername`, certificate verification и `Host` сохраняют исходный hostname; `rejectUnauthorized=true`.
- Redirects обрабатываются вручную только для `301/302/303/307/308`; каждый URL, hostname, DNS set и pin проверяются заново; четвёртый redirect отклоняется.
- Caller не может передать headers; Cookie, Authorization, Proxy-Authorization и `X-Forwarded-*` не отправляются. Proxy и cookie jar отсутствуют.

## 6. Response safety

- Один `AbortController`/timer ограничивает DNS resolution и соответствующий HTTPS request; после timeout transport уничтожает request/response. Незавершившийся DNS promise не открывает socket.
- Оборванный response stream нормализуется как retryable network failure и закрывает request.
- `Content-Length` выше лимита отклоняется до накопления body; без него bytes считаются на каждом chunk, и stream/request уничтожаются сразу после превышения.
- Content type обязателен и после удаления параметров должен точно входить в policy allowlist; sniff/fallback отсутствует.
- Успех — только `2xx`. `404` и другие non-retryable статусы не повторяются. `408`, `429`, `500`, `502`, `503`, `504`, timeout и network failure допускают ровно одну повторную попытку.
- Raw SDK/socket/TLS error, response body и полный URL/query не логируются и не возвращаются в error message.

## 7. Retry/cache

- Максимум одна повторная попытка, то есть две network attempts; TLS/policy/content/404 errors не retryable.
- `Retry-After` поддерживает целые seconds и HTTP-date, отрицательные/невалидные значения переходят на backoff, задержка ограничена env ceiling.
- Cache key содержит полный URL, sorted exact hosts, expected content types, max bytes и representation; cross-policy reuse запрещён.
- Default bounds: максимум 32 entries и 32 MiB body bytes; env validation ограничивает конфигурацию 128 entries и 64 MiB.
- Fresh hit не делает DNS/network request. Истёкший stale entry используется только после исчерпания retryable network failure.
- Network HTTP `200` обновляет last-success только после успешной validation выбранного representation. Malformed JSON, schema mismatch и invalid UTF-8 не записываются; существующий stale entry при этом остаётся неизменным.
- Stale после `429` возвращает прежний validated response с `sourceStatus=rate_limited`; после timeout/`503` — `degraded`. Без stale cache `429` остаётся `SAFE_FETCH_RATE_LIMITED`, не пустым результатом.
- Cache хранит и возвращает копии `Buffer`; expired entries и LRU entries удаляются в пределах памяти.

## 8. JSON/text

- `fetchText` декодирует strict/fatal UTF-8 и сохраняет исходные whitespace; silent trim отсутствует.
- `fetchJson` сначала strict UTF-8 decode, затем `JSON.parse`; malformed JSON выдаёт `SAFE_FETCH_JSON_INVALID`.
- Любой JSON обязательно проходит caller-provided `z.ZodType<T>`; mismatch выдаёт `SAFE_FETCH_RESPONSE_SCHEMA_INVALID`.
- Cached JSON повторно валидируется каждой предоставленной schema, даже когда network body уже находится в cache.
- Validation происходит до cache mutation; успешные text/JSON дают fresh hit без network, а validation failure вынуждает следующий вызов снова обратиться к network.

## 9. Tests

| Проверка | Результат | Фактический итог |
|---|---:|---|
| `npm run test:safe-fetch` | PASS | 7 suites, 95/95; включая cache-poisoning regressions и 10 transport boundary cases |
| `npm run test:safe-fetch:smoke` | PASS | Kazhydromet HTML: `200`, `108463` bytes |
| `npm run test -w api` | PASS | 19 suites, 247/247 |
| `npm run test:e2e:api` | PASS | 3 suites, 34/34 |
| `npm run test:e2e:api-process` | PASS | 1/1, compiled API остаётся live при недоступной DB |
| `npm run test:api-clean-start` | PASS | clean PostgreSQL, migrate/status/no drift, production+development start |
| `npm run test:sources:clean` | PASS | disposable PostgreSQL, 7/7 |
| `npm run test:supabase:storage` | PASS | private upload, duplicate rejection, signed read, SHA и exact cleanup |
| `npm run test:incidents:clean` | PASS | disposable PostgreSQL, 8/8 |
| `npm run test:seed:clean` | PASS | disposable PostgreSQL, 11/11 |
| `npm run test:prisma:clean` | PASS | disposable PostgreSQL, 10/10 и clean API start |
| `npm run test:supabase:readiness` | PASS | read-only Supabase, 2/2; HTTP `4960ms`, constraints `1210ms` |
| `npm run test:database-guard` | PASS | 3/3 |
| API typecheck/lint/build | PASS | все три команды завершились с code 0 |
| Workspace typecheck/lint/test/build | PASS | API 247/247, contracts 26/26, web typecheck/lint/build PASS |
| Archive tests | PASS | 6/6; clean archive создан из 152 allowlisted files |

Все перечисленные финальные результаты получены на Node `20.20.2`. В раннем промежуточном combined-прогоне один Supabase readiness test превысил Jest timeout 5 секунд; финальный отдельный обязательный прогон на Node 20.20.2 прошёл 2/2, но близость HTTP проверки (`4960ms`) к test timeout зафиксирована честно.

Prisma: `format`, `validate`, `generate`, `migrate status` — **PASS**, schema valid, 5 migrations, remote status up-to-date. Schema/migration diff отсутствует.

## 10. Manual verification

- Compiled NestJS запущен на Node 20.20.2, `PORT=3096`: `SafeFetchModule dependencies initialized`, application started — **PASS**; процесс затем штатно остановлен сигналом.
- `GET /api/health/live` → `200`.
- `GET /api/health/ready` → `200`.
- `GET /api/incidents` → `200`.
- `GET /api/source-documents/doc-kazhydromet-2025-09/open?page=22` → `404 SOURCE_DOCUMENT_NOT_FOUND`, normalized response содержит `requestId`. В текущей DB документ не загружен из-за незавершённого verified production gate; signed URL не выводился.
- Real SafeFetch smoke → `Kazhydromet SafeFetch HTML smoke passed (200, 108463 bytes)`.

## 11. Security limitations

- Exact-host policies пока задаются каждым будущим доверенным adapter/caller; публичного URL input нет.
- Cache process-local и теряется при restart; это осознанный bounded fallback, не provenance storage.
- Proxy, auth, cookies и arbitrary headers не поддерживаются.
- Public REST endpoint для SafeFetch отсутствует.
- DNS resolver API не позволяет отменить уже начатый OS lookup; timeout прекращает operation и гарантирует, что поздний ответ не откроет socket.

## 12. Known limitations

- Kazhydromet adapter/ingestion не реализован — это Part 07.
- GDELT/direct-source adapter и live status не реализованы — это Part 08.
- SourceHealth persistence и DB/Storage cache writes из SafeFetch отсутствуют.
- PDF signature validation, parsing и SourcePage extraction отсутствуют.
- npm audit после clean install сообщает 4 moderate и 2 high dependency findings; их breaking upgrade не входит в Part 06.

## 13. Archive

- Имя: `caspian-trace-backend-platform-clean-2026-08-05T18-16-25-694Z.tar.gz`.
- Состав: 152 allowlisted files.
- Включены Part 01–06 Backend 1 code/tests/TODO/reports и SafeFetch smoke.
- Исключены `.env`, secret areas, DNS debug dumps, response bodies, HAR/cache dumps, temporary downloads, generated Prisma client, `node_modules`, `dist`, coverage, artifacts, frontend и Backend 2 zones.

## 14. Handoff

Part 07 Kazhydromet должен связать существующие границы без обхода policy:

```text
SafeFetchService.fetchBuffer(...)
→ SourcesService.cacheExistingSourceSnapshot(...)
```

Part 08 GDELT/live status должен использовать:

```text
SafeFetchService.fetchJson(...)
→ sourceStatus/cacheStatus
```

Ни один adapter, ingestion endpoint или persistence side effect в Part 06 не начат.

## 15. Git status

Работа выполнена в `feat/backend-platform`. Commit, push, pull, merge, rebase и другие операции изменения Git history не выполнялись. Финальный worktree содержит только Part 06 implementation/config/tests/report/archive-script changes; `artifacts/**` игнорируется.

## 16. Выполненные этапы

## Выполненные этапы Backend 1

- [x] Part 01 — NestJS platform/contracts
- [x] Part 02 — Prisma/Supabase foundation
- [x] Part 03 implementation — verified seed
- [ ] Part 03 production gate — human review `0/2`, BLOCKED без DB writes
- [x] Part 04 — incidents read API
- [x] Part 05 — immutable source cache
- [x] Part 06 — SafeFetchService
- [ ] Part 07 — Kazhydromet ingestion
- [ ] Part 08 — GDELT/live status
