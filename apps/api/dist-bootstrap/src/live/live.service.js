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
exports.LiveService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@caspian-trace/contracts");
const source_health_service_1 = require("../sources/source-health/source-health.service");
const live_mapper_1 = require("./live.mapper");
let LiveService = class LiveService {
    sourceHealth;
    constructor(sourceHealth) {
        this.sourceHealth = sourceHealth;
    }
    async getStatus() {
        const rows = await this.sourceHealth.getAll();
        return contracts_1.LiveStatusSchema.parse({
            sources: (0, live_mapper_1.mapLiveHealth)(rows),
        });
    }
};
exports.LiveService = LiveService;
exports.LiveService = LiveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [source_health_service_1.SourceHealthService])
], LiveService);
//# sourceMappingURL=live.service.js.map