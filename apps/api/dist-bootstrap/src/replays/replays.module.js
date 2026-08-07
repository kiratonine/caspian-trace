"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaysModule = void 0;
const common_1 = require("@nestjs/common");
const investigations_module_1 = require("../investigations/investigations.module");
const replays_controller_1 = require("./replays.controller");
const replays_repository_1 = require("./replays.repository");
const replays_service_1 = require("./replays.service");
let ReplaysModule = class ReplaysModule {
};
exports.ReplaysModule = ReplaysModule;
exports.ReplaysModule = ReplaysModule = __decorate([
    (0, common_1.Module)({
        imports: [investigations_module_1.InvestigationsModule],
        controllers: [replays_controller_1.ReplaysController],
        providers: [replays_service_1.ReplaysService, replays_repository_1.ReplaysRepository],
        exports: [replays_service_1.ReplaysService],
    })
], ReplaysModule);
//# sourceMappingURL=replays.module.js.map