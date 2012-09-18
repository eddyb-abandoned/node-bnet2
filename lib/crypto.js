var crypto = require('crypto');
for(var i in crypto)
    exports[i] = crypto[i];

exports.hash = function hash(algo) {
    return function() {
        var h = crypto.createHash(algo);
        for(var i = 0; i < arguments.length; i++)
            h.update(arguments[i]);
        return new Buffer(h.digest('hex'), 'hex');
    };
}

exports.hmac = function hmac(algo) {
    return function(key) {
        var h = crypto.createHmac(algo, key);
        for(var i = 1; i < arguments.length; i++)
            h.update(arguments[i]);
        return new Buffer(h.digest('hex'), 'hex');
    };
}

/// http://en.wikipedia.org/wiki/RC4
exports.RC4 = function RC4(key) {
    if(!(this instanceof RC4))
        return new RC4(key);

    // State.
    var S = new Buffer(256), i = 0, j = 0;

    function swap() {
        var t = S[i];
        S[i] = S[j];
        S[j] = t;
    }

    // Key-scheduling algorithm (KSA).
    for(i = 0; i < 256; i++)
        S[i] = i;
    for(i = j = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) & 255;
        swap();
    }
    
    // Pseudo-random generation algorithm (PRGA).
    function next() {
        i = (i + 1) & 255;
        j = (j + S[i]) & 255;
        swap();
        return S[(S[i] + S[j]) & 255];
    }

    i = j = 0;
    this.discard = function discard(n) {
        for(var i = 0; i < n; i++)
            next();
    }
    this.update = function update(data) {
        var out = new Buffer(data.length);
        for(var i = 0; i < data.length; i++)
            out[i] = data[i] ^ next();
        return out;
    };
};
