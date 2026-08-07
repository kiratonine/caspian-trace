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
exports.InvestigationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const investigations_service_1 = require("./investigations.service");
let InvestigationsController = class InvestigationsController {
    investigations;
    constructor(investigations) {
        this.investigations = investigations;
    }
    getEvidence(id) {
        return this.investigations.getEvidenceGraph(id);
    }
};
exports.InvestigationsController = InvestigationsController;
__decorate([
    (0, common_1.Get)(':id/evidence'),
    (0, swagger_1.ApiOperation)({ summary: 'Return the complete evidence graph' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InvestigationsController.prototype, "getEvidence", null);
exports.InvestigationsController = InvestigationsController = __decorate([
    (0, swagger_1.ApiTags)('investigations'),
    (0, common_1.Controller)('investigations'),
    __metadata("design:paramtypes", [investigations_service_1.InvestigationsService])
], InvestigationsController);
//# sourceMappingURL=investigations.controller.js.map