var BigNum = exports.BigNum = require('bignum');
var _util = require('util');
for(var i in _util)
    exports[i] = _util[i];

var bits = require('./bits');
exports.BitReader = bits.BitReader;
exports.BitWriter = bits.BitWriter;

exports.readPassword = function readPassword(cb) {
    var stdin = process.stdin, stdout = process.stdout;
    stdin.setRawMode(true);
    stdin.resume();
    
    var password = '';
    function char(c) {
        c = c + '';
        switch(c) {
            case '\n': case '\r': case '\x04':
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', char);
                stdout.write('\n');
                cb(password);
                break
            case '\b':
                stdout.write('\b \b');
                password = password.slice(0, -1);
                break;
            case '\x03':
                process.exit();
                break;
            default:
                stdout.write('*');
                password += c;
                break;
        }
    }
    stdin.on('data', char);
};

exports.upperCaseFirst = function upperCaseFirst(x) {
    return x[0].toUpperCase() + x.slice(1);
};

exports.ensureSize = function ensureSize(buf, size, fill) {
    if(buf.length > size)
        return buf.slice(0, size);
    if(buf.length == size)
        return buf;
    var b = Buffer(size);
    b.fill(fill || 0, buf.length, size);
    buf.copy(b);
    return b;
};

exports.findLocalIPv4 = function findLocalIPv4() {
    var ifaces = require('os').networkInterfaces();
    for(var dev in ifaces)
        for(var iface = ifaces[dev], i = 0; i < iface.length; i++)
            if(!iface[i].internal && iface[i].family == 'IPv4')
                return iface[i].address;
};

BigNum.prototype.toLE = function toLE() {
    var hex = this.toString(16), len = Math.ceil(hex.length / 2);
    while(hex.length < 2 * len) hex = '0' + hex;
    var b = new Buffer(len);
    for(var i = len-1; i>=0; i--)
        b[i] = parseInt(hex.slice(0, 2), 16), hex = hex.slice(2);
    return b;
};
BigNum.fromLE = function fromLE(b) {
    var hex = '', v;
    for(var i = b.length-1; i>=0; i--)
        if((v = b[i]) < 16)
            hex += '0'+v.toString(16);
        else
            hex += v.toString(16);
        return BigNum(hex, 16);
};

exports.concatBuffers = function concatBuffers(x) {
    if(!arguments.length)
        return new Buffer(0);
    if(arguments.length === 1)
        return Buffer.isBuffer(x) ? x : new Buffer(x);
    var list = [], len = 0;
    for(var i = 0; i < arguments.length; i++) {
        var b = arguments[i];
        // HACK don't send random data.
        if(typeof b === 'number') {
            b = new Buffer(b);
            b.fill(0);
        }
        if(!Buffer.isBuffer(b))
            b = new Buffer(b);
        list.push(b);
        len += b.length;
    }
    return Buffer.concat(list, len);
};
