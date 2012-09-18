function BitReader(buffer, start) {
    if(!(this instanceof BitReader))
        return new BitReader(buffer, start);
    start = start || 0;
    this._buffer = buffer.slice(Math.floor(start/8));
    this._pos = start%8;
    this._numBits = this._buffer.length*8;
}
BitReader.prototype.need = function need(n) {
    if(this._numBits < this._pos+n)
        throw new RangeError('BitReader: Out of bounds');
};
BitReader.prototype.skip = function skip(n) {
    this.need(n);
    this._pos += n;
};
BitReader.prototype.alignToNextByte = function alignToNextByte() {
    this._pos = (this._pos+7) & ~7;
};
BitReader.prototype.i = function i(n) {
    var r = 0;
    while(n > 0) {
        this.need(n);

        var bitsToRead = 8 - (this._pos & 7);
        if(bitsToRead >= n)
            bitsToRead = n;

        var v = this._buffer[this._pos >>> 3] >>> (this._pos & 7);
        n -= bitsToRead;
        this._pos += bitsToRead;

        r |= (((1 << bitsToRead) - 1) & v) << n;
    }
    return r;
};
BitReader.prototype.u = function u(n) {
    var r = this.i(n);
    if(r < 0) // HACK fixes JS signed i32 behavior.
        r += 0x100000000;
    return r;
};
BitReader.prototype.bool = function bool() {
    return !!this.i(1);
};
BitReader.prototype.fourCC = function fourCC() {
    var bytes = new Buffer(4);
    bytes.writeUInt32BE(this.u(32), 0);
    return bytes.toString('ascii').replace(/^\0+/, '');
};
BitReader.prototype.bytes = function bytes(n) {
    this.alignToNextByte();
    var pos = this._pos >>> 3, slice = this._buffer.slice(pos, pos+n);
    this._pos += n*8;
    return slice;
};
BitReader.prototype.cString = function cString() {
    this.alignToNextByte();
    var pos = this._pos >>> 3;
    for(var i = pos; i < this._buffer.length && this._buffer[i]; i++);
    var str = this._buffer.slice(pos, i).toString('ascii');
    // Skip the \0.
    if(i < this._buffer.length)
        i++;
    this._pos = i*8;
    return str;
};
BitReader.prototype.buffer = function buffer(n) {
    return this.bytes(this.u(n));
};

function BitWriter() {
    if(!(this instanceof BitWriter))
        return new BitWriter;
    this._data = [];
    this._byte = 0;
    this.length = 0;
}
BitWriter.prototype.alignToNextByte = function alignToNextByte() {
    if(!(this.length & 7))
        return this;
    this.length = (this.length+7) & ~7;
    this._data.push(new Buffer([this._byte]));
    this._byte = 0;
    return this;
};
BitWriter.prototype.end = function end() {
    this.alignToNextByte();
    return Buffer.concat(this._data, this.length >>> 3);
};
BitWriter.prototype.u = function u(n, value) {
    while(n > 0) {
        var bitsInByte = (this.length & 7);
        var bitsToWrite = 8 - bitsInByte;
        if(bitsToWrite >= n)
            bitsToWrite = n;
        n -= bitsToWrite;
        
        var mask = (1 << bitsToWrite)-1;
        var currentMask = ~(mask << bitsInByte) & 0xff;
        var newBits = ((mask & (value >>> n)) << bitsInByte) & 0xff;
        
        this._byte = this._byte & currentMask | newBits;
        this.length += bitsToWrite;
        if(bitsInByte + bitsToWrite >= 8) {
            this._data.push(new Buffer([this._byte]));
            this._byte = 0;
        }
    }
    return this;
};
BitWriter.prototype.i = function i(n, value) {
    if(value < 0) // HACK fixes JS signed i32 behavior.
        value += 0x100000000;
    return this.u(n, value);
};
BitWriter.prototype.bool = function bool(value) {
    return this.u(1, value ? 1 : 0);
};
BitWriter.prototype.fourCC = function fourCC(value) {
    var bytes = new Buffer([0, 0, 0, 0]);
    bytes.write(value, 4-value.length);
    return this.u(32, bytes.readUInt32BE(0));
};
BitWriter.prototype.bytes = function bytes(n, slice) {
    if(Buffer.isBuffer(n))
        slice = n, n = slice.length;
    else if(typeof n !== 'number')
        throw new TypeError('First argument should be a Buffer or a number.');
    if(!Buffer.isBuffer(slice)) {
        slice = new Buffer(n);
        slice.fill(0);
    }
    if(slice.length !== n)
        throw new RangeError('Length mismatch, something went wrong.');
    this.alignToNextByte();
    this._data.push(slice);
    this.length += n*8;
    return this;
};
BitWriter.prototype.cString = function cString(str) {
    this.alignToNextByte();
    str = new Buffer(str, 'ascii');
    this._data.push(str, /*\0*/new Buffer([0]));
    this.length += (str.length+1)*8;
    return this;
};
BitWriter.prototype.buffer = function buffer(n, buf) {
    return this.u(n, buf.length).bytes(buf);
};

exports.BitReader = BitReader;
exports.BitWriter = BitWriter;
