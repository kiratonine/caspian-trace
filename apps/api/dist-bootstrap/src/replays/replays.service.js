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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaysService = void 0;
const common_1 = require("@nestjs/common");
const investigations_service_1 = require("../investigations/investigations.service");
const replay_mapper_1 = require("./replay.mapper");
const replays_repository_1 = require("./replays.repository");
let ReplaysService = class ReplaysService {
    investigations;
    repository;
    constructor(investigations, repository) {
        this.investigations = investigations;
        this.repository = repository;
    }
    async start(id) {
        const stored = await this.investigations.getStored(id);
        const fingerprint = `${stored.result.rulesetVersion}:${stored.result.inputHash}`;
        const existing = this.repository.find(stored.investigationId, fingerprint);
        if (existing !== null)
            return existing;
        return this.repository.save(fingerprint, (0, replay_mapper_1.toReplayScenario)(stored));
    }
};
exports.ReplaysService = ReplaysService;
exports.ReplaysService = ReplaysService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [investigations_service_1.InvestigationsService,
        replays_repository_1.ReplaysRepository])
], ReplaysService);
//# sourceMappingURL=replays.service.js.map