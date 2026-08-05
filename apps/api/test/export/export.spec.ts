import { DossierSchema } from '@caspian-trace/contracts'

import { ExportService } from '../../src/export/export.service'
import { escapeHtml } from '../../src/export/html.renderer'
import { FileInvestigationRepository } from '../../src/investigations/file-investigation.repository'
import { InvestigationsService } from '../../src/investigations/investigations.service'

describe('ExportService', () => {
  it('builds schema-valid JSON and safe printable HTML', async () => {
    const repository = new FileInvestigationRepository()
    const investigations = new InvestigationsService(repository, repository)
    const exporter = new ExportService(investigations)
    await investigations.recompute('inv-atyrau-2025-09')
    const model = DossierSchema.parse(
      await exporter.buildDossierModel('inv-atyrau-2025-09'),
    )

    expect(DossierSchema.parse(JSON.parse(exporter.renderJson(model)))).toEqual(model)
    const html = exporter.renderHtml(model)
    expect(html).toContain('@media print')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })

  it('escapes every HTML metacharacter', () => {
    expect(escapeHtml(`<script>alert('x') & "y"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;) &amp; &quot;y&quot;&lt;/script&gt;',
    )
  })
})
