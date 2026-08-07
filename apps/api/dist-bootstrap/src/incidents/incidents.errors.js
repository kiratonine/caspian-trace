"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentDataInvalidError = void 0;
class IncidentDataInvalidError extends Error {
    constructor() {
        super('Incident data is inconsistent');
        this.name = 'IncidentDataInvalidError';
    }
}
exports.IncidentDataInvalidError = IncidentDataInvalidError;
//# sourceMappingURL=incidents.errors.js.map