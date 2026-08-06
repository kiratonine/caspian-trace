import { Injectable } from '@nestjs/common'

import type { Dossier } from '@caspian-trace/contracts'

import { InvestigationsService } from '../investigations/investigations.service'
import { toDossier } from './dossier.mapper'
import { renderDossierHtml } from './html.renderer'

@Injectable()
export class ExportService {
  constructor(private readonly investigations: InvestigationsService) {}

  async buildDossierModel(id: string): Promise<Dossier> {
    return toDossier(await this.investigations.getStored(id))
  }

  renderJson(model: Dossier): string {
    return `${JSON.stringify(model, null, 2)}\n`
  }

  renderHtml(model: Dossier): string {
    return renderDossierHtml(model)
  }
}
