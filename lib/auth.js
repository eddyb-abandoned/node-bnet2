var fs = require('fs'), crypto = require('./crypto');
var hmac_sha256 = crypto.hmac('sha256');
var channel = exports.channel = 0;
var s2c = {
    COMPLETE: 0,
    CHALLENGE: 2
};
var c2s = {
    CHALLENGE: 0,
    PROOF: 2,
    CHALLENGE_WOW_POST_MOP: 5
};
var clientHandlers = exports.clientHandlers = [];
clientHandlers[s2c.CHALLENGE] = function(pkt) {
    var moduleCount = pkt.u(3), modules = [], responses = [];
    for(var i = 0; i < moduleCount; i++) {
        pkt.alignToNextByte();
        var module = {
            type: pkt.fourCC(),
            locale: pkt.fourCC(),
            hash: pkt.bytes(32).toString('hex'),
            data: pkt.buffer(10)
        };
        if(module.type == 'auth' && fs.existsSync(__dirname+'/modules/'+module.hash+'.js')) {
            module.handler = require('./modules/'+module.hash+'.js').client;
            module.response = module.handler.handleData.call(this, module);
            if(module.response)
                responses.push(module.response);
        } else
            this.emit('parseError', 'Unknown module', module);
    }
    this.modules = modules;
    this.sendAuthProof(responses);
};
clientHandlers[s2c.COMPLETE] = function(pkt) {
    if(pkt.bool()) { // bFail.
        var hasOptModule = pkt.bool(), failType = pkt.u(2), error = pkt.u(16), unk = pkt.u(32);
        this.emit('error', 'Auth error '+hasOptModule+' '+failType+' '+error+' '+unk);
    } else {
        var moduleCount = pkt.u(3), modules = [];
        for(var i = 0; i < moduleCount; i++) {
            pkt.alignToNextByte();
            var module = {
                type: pkt.fourCC(),
                locale: pkt.fourCC(),
                hash: pkt.bytes(32).toString('hex'),
                data: pkt.buffer(10)
            };
            if(!this.modules)
                continue;
            for(var i = 0; i < this.modules.length; i++) {
                var storedModule = this.modules[i];
                if(storedModule.hash != module.hash || !storedModule.handler)
                    continue;
                storedModule.data = module.data;
                storedModule.handler.handleData.call(this, storedModule);
            }
        }
        delete this.modules;
        
        var pingTimeout = pkt.u(32)+(1 << 31), hasOptSegment = pkt.bool(), choice = pkt.bool();
        var shapeTreshold = pkt.u(32), shapeRate = pkt.u(32);
        var holderFirst = pkt.buffer(8).toString('utf8'), holderLast = pkt.buffer(8).toString('utf8');
        var region = pkt.u(8), unk1 = pkt.u(8);
        pkt.skip(12*8); // HACK TODO find reason.
        var accountLen = pkt.u(5)+1, account = pkt.bytes(accountLen).toString('utf8');
        var unk2 = pkt.u(64), unk3 = pkt.u(32);
        this.account = account;

        setTimeout(function ping() {
            this.sendControlPingRequest();
            setTimeout(ping.bind(this), pingTimeout/2);
        }.bind(this), pingTimeout/2);
        
        var c2sKey = hmac_sha256(this.K, new Buffer([0xDE, 0xA9, 0x65, 0xAE, 0x54, 0x3A, 0x1E, 0x93, 0x9E, 0x69, 0x0C, 0xAA, 0x68, 0xDE, 0x78, 0x39]));
        var s2cKey = hmac_sha256(this.K, new Buffer([0x68, 0xE0, 0xC7, 0x2E, 0xDD, 0xD6, 0xD2, 0xF3, 0x1E, 0x5A, 0xB1, 0x55, 0xB1, 0x8B, 0x63, 0x1E]));
        this.sendControlEnabledEncryption();
        this.setEncryption(true, c2sKey, s2cKey);
        this.emit('authenticated');
    }
};

var clientSenders = exports.clientSenders = {};
clientSenders.challenge = function() {
    var wowPostMoP = this.components.WoW && this.components.WoW.base > 15595; /* 4.3.4 */;
    var pkt = this.packet(channel, wowPostMoP ? c2s.CHALLENGE_WOW_POST_MOP : c2s.CHALLENGE);
    pkt.fourCC(this.program).fourCC(this.platform).fourCC(this.locale);
    var components = [];
    for(var name in this.components) {
        var versions = this.components[name];
        for(var locale in versions)
            components.push([name, locale, versions[locale]]);
    }
    pkt.u(6, components.length);
    for(var i = 0; i < components.length; i++)
        pkt.fourCC(components[i][0]).fourCC(components[i][1]).u(32, components[i][2]);
    pkt.bool(true); // bHasAccount.
    // WARNING the byte at end is presumed to be a NUL byte, but it may be not.
    pkt.u(9, this.username.length-3).cString(this.username);
    pkt.send();
};
clientSenders.proof = function(responses) {
    if(!responses)
        responses = [];
    var pkt = this.packet(channel, c2s.PROOF).u(3, responses.length);
    for(var i = 0; i < responses.length; i++)
        pkt.buffer(10, responses[i]);
    pkt.send();
};

var serverHandlers = exports.serverHandlers = [];
serverHandlers[c2s.CHALLENGE] = serverHandlers[c2s.CHALLENGE_WOW_POST_MOP] = function(pkt) {
    var data = {
        program: pkt.fourCC(),
        platform: pkt.fourCC(),
        locale: pkt.fourCC(),
        components: []
    }, numComponents = pkt.u(6);
    for(var i = 0; i < numComponents; i++)
        data.components.push({
            name: pkt.fourCC(),
            locale: pkt.fourCC(),
            version: pkt.u(32)
        });
    var hasAccount = pkt.bool();
    if(hasAccount) {
        var accountLen = pkt.u(9)+3;
        data.account = pkt.bytes(accountLen).toString('ascii');
        data.unknown = pkt.u(8);
    }
    this.emit('authChallenge', data);
};