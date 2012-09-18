var events = require('events'), net = require('net');
var crypto = require('./crypto'), util = require('./util');

var channelsByName = {auth: require('./auth'), control: require('./control')};

// HACK-ish.
var channels = [];
for(var i in channelsByName)
    (channels[channelsByName[i].channel] = channelsByName[i]).name = i;

function Socket() {
    events.EventEmitter.call(this);

    this._socket = new net.Socket({type: 'tcp4'});
    this._socket.on('error', this.emit.bind(this, 'error'));
    this._socket.on('close', this.emit.bind(this, 'close', 'Socket closed.'));
    this._socket.on('data', this.processPackets.bind(this));
    this._socket.on('connect', this.sendAuthChallenge.bind(this));
}

util.inherits(Socket, events.EventEmitter);

for(var i in channelsByName)
    for(var j in channelsByName[i].clientSenders)
        Socket.prototype['send'+util.upperCaseFirst(i)+util.upperCaseFirst(j)] = channelsByName[i].clientSenders[j];

Socket.prototype.setDefaults = function setDefaults(program, version, locale) {
    var programNames = {wow: 'WoW'};
    this.program = programNames[program.toLowerCase()] || program;
    this.platform = 'Win';
    this.locale = locale;
    // NOTE Component order can be rather important.
    this.components = {};
    var programComponent = this.components[this.program] = {};
    programComponent[this.platform] = version;
    programComponent.base = version;
    programComponent[this.locale] = version;
    // NOTE These should be kept to the latest version.
    this.components.Tool = {};
    this.components.Tool[this.platform] = 1113;
    this.components.Bnet = {};
    this.components.Bnet[this.platform] = 28544;
};

Socket.prototype.connect = function connect(server, username, password, program, version, locale) {
    this.username = username;
    this.password = password;
    
    server = server.toLowerCase().split(':');
    var port = server[1] || 1119;
    server = server[0];
    if(!/\./.test(server))
        server = server+'.logon.battle.net';
    
    if(!locale) {
        if(server == 'us.logon.battle.net')
            locale = 'enUS';
        else if(server == 'eu.logon.battle.net')
            locale = 'enGB';
        else
            throw new Error('Can\'t guess locale!');
    }
    this.setDefaults(program, version, locale);

    // Attempt to find local IP.
    if(this.ip = util.findLocalIPv4())
        this.ip = this.ip.split('.').map(function(x){return +x;});
    else {
        console.warn('Can\'t find local IPv4!');
        this.ip = [10, 0, 0, 1];
    }
    
    this._socket.connect(port, server);
};

Socket.prototype.encryption = false;

Socket.prototype.setEncryption = function setEncryption(encryption, c2s, s2c) {
    this.cipher = new crypto.RC4(c2s);
    this.decipher = new crypto.RC4(s2c);
    this.encryption = !!encryption;
};

Socket.prototype.processPackets = function processPackets(data) {
    if(this.encryption)
        data = this.decipher.update(data);
    if(this._pending)
        data = util.concatBuffers(this._pending, data);
    for(var start = 0; start < data.length;) {
        try {
            var length = this.processPacket(data, start);
            // HACK ignore unknown packets, hope the next recv will start with a clean packet.
            if(length === false) {
                this._pending = null;
                return;
            }
            start += length;
        } catch(e) {
            this._pending = data.slice(start);
            console.error(e, this._pending);
            return;
        }
    }
    this._pending = null;
};

Socket.prototype.processPacket = function processPacket(data, start) {
    var pkt = new util.BitReader(data, start*8), op = pkt.u(6), channel = 0;
    if(pkt.bool()) // hasChannel
        channel = pkt.u(4);
    data = data.slice(start);
    if(!(channel in channels))
        return this.emit('parseError', 'Unknown channel '+channel+', op '+op+' '+data.inspect()+' '+data.toString('ascii')), false;
    var handler = channels[channel].clientHandlers[op];
    if(!handler)
        return this.emit('parseError', 'Unknown '+channels[channel].name+' op '+op+' '+data.inspect()+' '+data.toString('ascii')), false;
    handler.call(this, pkt);
    pkt.alignToNextByte()
    return pkt._pos - start;
};

Socket.prototype.packet = function packet(channel, op) {
    var pkt = new util.BitWriter;
    pkt.u(6, op).bool(true).u(4, channel);
    var self = this;
    pkt.send = function write() {
        var data = this.end();
        if(self.encryption)
            data = self.cipher.update(data);
        self._socket.write(data);
    };
    return pkt;
};

module.exports = Socket;
