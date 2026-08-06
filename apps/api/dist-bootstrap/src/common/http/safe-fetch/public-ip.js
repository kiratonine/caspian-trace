"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPublicIpAddress = isPublicIpAddress;
const node_net_1 = require("node:net");
const blockedIpv4 = new node_net_1.BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
]) {
    blockedIpv4.addSubnet(network, prefix, 'ipv4');
}
const blockedIpv6 = new node_net_1.BlockList();
for (const [network, prefix] of [
    ['::', 96],
    ['::ffff:0:0', 96],
    ['64:ff9b::', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 23],
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:20::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
    ['5f00::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8],
]) {
    blockedIpv6.addSubnet(network, prefix, 'ipv6');
}
function isPublicIpAddress(address) {
    const family = (0, node_net_1.isIP)(address);
    if (family === 4)
        return !blockedIpv4.check(address, 'ipv4');
    if (family === 6)
        return !blockedIpv6.check(address, 'ipv6');
    return false;
}
//# sourceMappingURL=public-ip.js.map