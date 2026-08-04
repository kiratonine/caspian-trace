# Prisma schema request — Backend Investigation

Статус: ожидает общий `PrismaService`, generated client и migration от Backend
Platform P2. Этот документ фиксирует минимальный контракт; отдельный
`PrismaClient` и локальная migration в investigation-ветке не создаются.

## InvestigationResultVersion

- `id: String @id`
- `investigationId: String`
- `inputHash: String`
- `rulesetVersion: String`
- `evidenceLevel: EvidenceLevel`
- `conclusion: String`
- `corridorUpstreamStationId: String?`
- `corridorDownstreamStationId: String?`
- `generatedAt: DateTime @default(now())`
- `isCurrent: Boolean @default(false)`
- unique: `(investigationId, inputHash, rulesetVersion)`
- index: `(investigationId, isCurrent)`

## InvestigationEvidenceStatement

- `id: String @id`
- `resultVersionId: String`
- `code: String`
- `kind: EvidenceKind`
- `text: String`
- `generatedBy: EvidenceGenerator`
- `sortOrder: Int`
- unique: `(resultVersionId, sortOrder)`
- many-to-many links к `Measurement` и `SourceDocument`

## InvestigationUnknown

- `id: String @id`
- `resultVersionId: String`
- `code: String`
- `text: String`
- unique: `(resultVersionId, code)`

## InvestigationObjectDisposition

- `id: String @id`
- `resultVersionId: String`
- `candidateObjectId: String`
- `disposition: ObjectDispositionKind`
- many-to-many links к evidence statements
- unique: `(resultVersionId, candidateObjectId)`

## Требуемая transaction boundary

`PrismaInvestigationRepository.saveVersioned` выполняет одной
`prisma.$transaction`:

1. повторно проверяет unique `(investigationId, inputHash, rulesetVersion)`;
2. снимает `isCurrent` с предыдущей версии;
3. создаёт новую result version;
4. создаёт statements и measurement/source links;
5. создаёт unknowns и object dispositions;
6. устанавливает новой версии `isCurrent=true`;
7. возвращает полный immutable snapshot.

Unique constraint должен превращать конкурентные одинаковые recompute в чтение
одной версии, а не в две записи. Любая ошибка на шагах 2–6 откатывает всю
операцию.

## Adapter contract

Adapter реализует существующие порты
`InvestigationInputReader`/`InvestigationResultWriter` из
`apps/api/src/investigations/investigation.ports.ts` и регистрируется через
`useExisting`. Fixture adapter остаётся только для автономного demo/test mode.
