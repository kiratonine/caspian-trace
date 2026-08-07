export class IncidentDataInvalidError extends Error {
  constructor() {
    super('Incident data is inconsistent')
    this.name = 'IncidentDataInvalidError'
  }
}
