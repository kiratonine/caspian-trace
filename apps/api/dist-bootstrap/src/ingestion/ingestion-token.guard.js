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
exports.IngestionTokenGuard = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let IngestionTokenGuard = class IngestionTokenGuard {
    expectedDigest;
    constructor(config) {
        this.expectedDigest = digest(config.getOrThrow('INGESTION_TOKEN'));
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const value = request.headers['x-ingestion-token'];
        const supplied = typeof value === 'string' ? value : '';
        const accepted = (0, node_crypto_1.timingSafeEqual)(this.expectedDigest, digest(supplied));
        if (!accepted || typeof value !== 'string') {
            throw new common_1.UnauthorizedException({
                code: 'INGESTION_UNAUTHORIZED',
                message: 'Invalid ingestion credentials',
            });
        }
        return true;
    }
};
exports.IngestionTokenGuard = IngestionTokenGuard;
exports.IngestionTokenGuard = IngestionTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], IngestionTokenGuard);
function digest(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest();
}
//# sourceMappingURL=ingestion-token.guard.js.map