var crypto = require('./crypto'), BigNum = require('./util').BigNum;
function SrpClient(g, N, k, H) {
    this.g = BigNum.fromLE(g);
    this.N = BigNum.fromLE(N);
    this.k = BigNum.fromLE(k);
    this.HgXorHN = H(g);
    for(var i = 0, HN = H(N); i < HN.length; i++)
        this.HgXorHN[i] ^= HN[i];
    this.H = H;
    this.a = BigNum.fromLE(crypto.randomBytes(N.length));
    this.secondChallenge = crypto.randomBytes(N.length);
    this.A = this.g.powm(this.a, this.N);
    this._A = this.A.toLE();
}
SrpClient.prototype.setUserPass = function setUserPass(username, password) {
    username = username.toUpperCase()
    this.HUser = this.H(username);
    this.HUserPass = this.H(username, ':', password.toUpperCase());
};
SrpClient.prototype.challenge = function challenge(s, _B, secondChallenge) {
    var B = BigNum.fromLE(_B);
    
    var u = BigNum.fromLE(this.H(this._A, _B));
    var x = BigNum.fromLE(this.H(s, this.HUserPass));
    var v = this.g.powm(x, this.N);
    var S = B.sub(v.mul(this.k)).powm(this.a.add(u.mul(x)), this.N);

    // Interleaved hash to get the session key (K).
    S = S.toLE();
    if(S.length & 1)
        S = S.slice(1)
    
    var halfLength = S.length >>> 1, even = new Buffer(halfLength), odd = new Buffer(halfLength);
    for(var i = 0; i < halfLength; i++) {
        even[i] = S[i * 2];
        odd[i] = S[i * 2 + 1];
    }
    even = this.H(even);
    odd = this.H(odd);
    
    this.K = new Buffer(even.length+odd.length);
    for(var i = 0; i < this.K.length; i++)
        this.K[i] = (i & 1 ? odd : even)[i >>> 1];
    
    this.M1 = this.H(this.HgXorHN, this.HUser, s, this._A, _B, this.K);
    this.M2 = this.H(this._A, this.M1, this.K);
};
exports.SrpClient = SrpClient;
