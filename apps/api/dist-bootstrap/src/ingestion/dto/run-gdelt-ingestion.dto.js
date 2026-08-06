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
exports.RunGdeltIngestionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const ingestion_types_1 = require("../ingestion.types");
class RunGdeltIngestionDto {
    from;
    to;
    regions;
    maxRecords;
    maxArticles;
    includeDirectFallback;
}
exports.RunGdeltIngestionDto = RunGdeltIngestionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-01T00:00:00Z' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/),
    __metadata("design:type", String)
], RunGdeltIngestionDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-30T23:59:59Z' }),
    (0, class_validator_1.IsISO8601)({ strict: true, strictSeparator: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/),
    __metadata("design:type", String)
], RunGdeltIngestionDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ingestion_types_1.KAZHYDROMET_REGIONS, isArray: true, example: ['atyrau'] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsIn)(ingestion_types_1.KAZHYDROMET_REGIONS, { each: true }),
    __metadata("design:type", Array)
], RunGdeltIngestionDto.prototype, "regions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 25, default: 25 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(25),
    __metadata("design:type", Number)
], RunGdeltIngestionDto.prototype, "maxRecords", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 10, default: 3 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], RunGdeltIngestionDto.prototype, "maxArticles", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RunGdeltIngestionDto.prototype, "includeDirectFallback", void 0);
//# sourceMappingURL=run-gdelt-ingestion.dto.js.map