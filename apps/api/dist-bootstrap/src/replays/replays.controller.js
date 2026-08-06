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
exports.ReplaysController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const replays_service_1 = require("./replays.service");
let ReplaysController = class ReplaysController {
    replays;
    constructor(replays) {
        this.replays = replays;
    }
    start(id) {
        return this.replays.start(id);
    }
};
exports.ReplaysController = ReplaysController;
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, swagger_1.ApiOperation)({ summary: 'Return an immutable deterministic replay scenario' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReplaysController.prototype, "start", null);
exports.ReplaysController = ReplaysController = __decorate([
    (0, swagger_1.ApiTags)('replays'),
    (0, common_1.Controller)('replays'),
    __metadata("design:paramtypes", [replays_service_1.ReplaysService])
], ReplaysController);
//# sourceMappingURL=replays.controller.js.map