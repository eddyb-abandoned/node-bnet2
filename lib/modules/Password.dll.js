var crypto = require('../crypto'), util = require('../util'), SrpClient = require('../srp').SrpClient;
var ops = {
    CHALLENGE: 0,
    PROOF: 2
};
module.exports = function(options) {
    var H = crypto.hash(options.hash), k = H(options.N, options.g);
    return {
        client: {
            handleData: function(module) {
                var data = module.data, op = data[0], response;
                data = data.slice(1)
                if(op == ops.CHALLENGE) {
                    var pos = 0;
                    var userSeed = data.slice(pos, pos += options.sBytes);
                    var s = data.slice(pos, pos += options.sBytes);
                    var B = data.slice(pos, pos += options.N.length);
                    var secondChallenge = data.slice(pos, pos += options.N.length);
                    
                    var srp = new SrpClient(options.g, options.N, k, H);
                    srp.setUserPass(userSeed.toString('hex'), this.password);
                    delete this.password;
                    srp.challenge(s, B, secondChallenge);
                    this.K = module.K = srp.K;
                    module.M2 = srp.M2;
                    response = util.concatBuffers([ops.PROOF], srp._A, srp.M1, srp.secondChallenge);
                } else if(op == ops.PROOF) {
                    console.log('TODO S->C Password.dll proof', module.data);
                }
                return response;
            },
        },
    };
};
