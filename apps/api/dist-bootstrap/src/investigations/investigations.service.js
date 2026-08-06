"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationsService = void 0;
const common_1 = require("@nestjs/common");
const investigation_core_1 = require("@caspian-trace/investigation-core");
const evidence_mapper_1 = require("./evidence.mapper");
const investigation_ports_1 = require("./investigation.ports");
let InvestigationsService = class InvestigationsService {
    inputReader;
    resultWriter;
    constructor(inputReader, resultWriter) {
        this.inputReader = inputReader;
        this.resultWriter = resultWriter;
    }
    async recompute(investigationId) {
        const loadedInput = await this.inputReader.loadInput(investigationId);
        if (loadedInput === null)
            throw investigationNotFound(investigationId);
        const input = (0, investigation_core_1.canonicalizeInvestigationInput)(loadedInput);
        const result = (0, investigation_core_1.runInvestigation)(input);
        const current = await this.resultWriter.findCurrent(input.incident.id);
        if (current?.result.inputHash === result.inputHash &&
            current.result.rulesetVersion === result.rulesetVersion) {
            return current;
        }
        return this.resultWriter.saveVersioned(input.incident.id, input, result);
    }
    async getEvidenceGraph(investigationId) {
        return (0, evidence_mapper_1.toEvidenceGraph)(await this.getStored(investigationId));
    }
    async getCurrentResult(investigationId) {
        return (await this.getStored(investigationId)).result;
    }
    async getStored(investigationId) {
        const current = await this.resultWriter.findCurrent(investigationId);
        if (current === null)
            throw investigationNotFound(investigationId);
        return current;
    }
};
exports.InvestigationsService = InvestigationsService;
exports.InvestigationsService = InvestigationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(investigation_ports_1.INVESTIGATION_INPUT_READER)),
    __param(1, (0, common_1.Inject)(investigation_ports_1.INVESTIGATION_RESULT_WRITER)),
    __metadata("design:paramtypes", [Object, Object])
], InvestigationsService);
function investigationNotFound(id) {
    return new common_1.NotFoundException({
        code: 'INVESTIGATION_NOT_FOUND',
        message: `Investigation ${id} was not found`,
    });
}
//# sourceMappingURL=investigations.service.js.map