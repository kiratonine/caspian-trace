"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeBootstrapError = void 0;
class RuntimeBootstrapError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = RuntimeBootstrapError.name;
    }
}
exports.RuntimeBootstrapError = RuntimeBootstrapError;
//# sourceMappingURL=runtime-bootstrap.errors.js.map