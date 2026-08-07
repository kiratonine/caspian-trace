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
exports.InvestigationIdDto = exports.ListIncidentsDto = void 0;
exports.toIncidentFilters = toIncidentFilters;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
class ListIncidentsDto {
    status;
    region;
    from;
    to;
    limit = 50;
}
exports.ListIncidentsDto = ListIncidentsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['L0', 'L1', 'L2', 'L3'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['L0', 'L1', 'L2', 'L3']),
    __metadata("design:type", String)
], ListIncidentsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['atyrau', 'mangystau'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['atyrau', 'mangystau']),
    __metadata("design:type", String)
], ListIncidentsDto.prototype, "region", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-01-01', format: 'date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN),
    IsIsoCalendarDate(),
    __metadata("design:type", String)
], ListIncidentsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-12-31', format: 'date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN),
    IsIsoCalendarDate(),
    IsOnOrAfter('from'),
    __metadata("design:type", String)
], ListIncidentsDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, minimum: 1, maximum: 100 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Object)
], ListIncidentsDto.prototype, "limit", void 0);
class InvestigationIdDto {
    id;
}
exports.InvestigationIdDto = InvestigationIdDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current Investigation.id' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    (0, class_validator_1.Matches)(/^\S(?:.*\S)?$/),
    __metadata("design:type", String)
], InvestigationIdDto.prototype, "id", void 0);
function toIncidentFilters(query) {
    return {
        status: query.status,
        region: query.region,
        generatedFrom: query.from ? startOfUtcDate(query.from) : undefined,
        generatedBefore: query.to ? nextUtcDate(query.to) : undefined,
        limit: query.limit,
    };
}
function startOfUtcDate(value) {
    return new Date(`${value}T00:00:00.000Z`);
}
function nextUtcDate(value) {
    const date = startOfUtcDate(value);
    date.setUTCDate(date.getUTCDate() + 1);
    return date;
}
function IsIsoCalendarDate(validationOptions) {
    return (object, propertyName) => {
        (0, class_validator_1.registerDecorator)({
            name: 'isIsoCalendarDate',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value) {
                    if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
                        return false;
                    }
                    return startOfUtcDate(value).toISOString().slice(0, 10) === value;
                },
            },
        });
    };
}
function IsOnOrAfter(relatedPropertyName, validationOptions) {
    return (object, propertyName) => {
        (0, class_validator_1.registerDecorator)({
            name: 'isOnOrAfter',
            target: object.constructor,
            propertyName,
            constraints: [relatedPropertyName],
            options: validationOptions,
            validator: {
                validate(value, arguments_) {
                    if (typeof value !== 'string')
                        return true;
                    const related = arguments_.object[relatedPropertyName];
                    return typeof related !== 'string' || value >= related;
                },
            },
        });
    };
}
//# sourceMappingURL=list-incidents.dto.js.map