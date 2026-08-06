"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaysRepository = void 0;
const common_1 = require("@nestjs/common");
let ReplaysRepository = class ReplaysRepository {
    scenarios = new Map();
    find(id, fingerprint) {
        const record = this.scenarios.get(id);
        return record === undefined || record.fingerprint !== fingerprint
            ? null
            : structuredClone(record.scenario);
    }
    save(fingerprint, scenario) {
        const snapshot = structuredClone(scenario);
        this.scenarios.set(scenario.id, { fingerprint, scenario: snapshot });
        return structuredClone(snapshot);
    }
};
exports.ReplaysRepository = ReplaysRepository;
exports.ReplaysRepository = ReplaysRepository = __decorate([
    (0, common_1.Injectable)()
], ReplaysRepository);
//# sourceMappingURL=replays.repository.js.map