var channel = exports.channel = 1;
var s2c = {
    PING_RESPONSE: 0,
    ERROR: 1,
    UNKNOWN: 4
};
var c2s = {
    PING_REQUEST: 0,
    ENABLED_ENCRYPTION: 5
};
var clientHandlers = exports.clientHandlers = [];
clientHandlers[s2c.PING_RESPONSE] = function(pkt) {
};
clientHandlers[s2c.ERROR] = function(pkt) {
    this.emit('error', 'Control error '+pkt.u(16));
};
clientHandlers[s2c.UNKNOWN] = function(pkt) {
    var data = pkt.bytes(12);
    this.emit('parseError', 'Unknown data after auth', data);
};

var clientSenders = exports.clientSenders = {};
clientSenders.pingRequest = function() {
    this.packet(channel, c2s.PING_REQUEST).send();
};
clientSenders.enabledEncryption = function() {
    this.packet(channel, c2s.ENABLED_ENCRYPTION).send();
};