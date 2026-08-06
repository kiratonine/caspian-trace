"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePgConnectionString = normalizePgConnectionString;
function normalizePgConnectionString(databaseUrl) {
    const parsed = new URL(databaseUrl);
    if (parsed.searchParams.get('sslmode') === 'require' &&
        !parsed.searchParams.has('uselibpqcompat')) {
        parsed.searchParams.set('uselibpqcompat', 'true');
    }
    return parsed.toString();
}
//# sourceMappingURL=prisma-connection.js.map