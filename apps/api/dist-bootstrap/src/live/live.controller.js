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
exports.LiveController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const live_service_1 = require("./live.service");
let LiveController = class LiveController {
    live;
    constructor(live) {
        this.live = live;
    }
    getStatus() {
        return this.live.getStatus();
    }
};
exports.LiveController = LiveController;
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Read public source health and durable cache availability' }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            type: 'object', required: ['sources'],
            properties: {
                sources: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'name', 'lastSuccessAt', 'cacheAvailable', 'status'],
                        properties: {
                            id: { type: 'string' }, name: { type: 'string' },
                            lastSuccessAt: { type: 'string', format: 'date-time', nullable: true },
                            cacheAvailable: { type: 'boolean' },
                            status: { type: 'string', enum: ['never_run', 'healthy', 'degraded', 'rate_limited', 'failed'] },
                        },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiInternalServerErrorResponse)({ description: 'Normalized internal failure' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LiveController.prototype, "getStatus", null);
exports.LiveController = LiveController = __decorate([
    (0, swagger_1.ApiTags)('live sources'),
    (0, common_1.Controller)('live'),
    __metadata("design:paramtypes", [live_service_1.LiveService])
], LiveController);
//# sourceMappingURL=live.controller.js.map