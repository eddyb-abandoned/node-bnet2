if(process.argv.length < 4) {
    console.log('Usage: '+process.argv[1]+' <server or portal> <username>');
    process.exit();
}

var server = process.argv[2], username = process.argv[3];

var BNet2ClientSocket = require('../lib/ClientSocket'), util = require('../lib/util');
var socket = new BNet2ClientSocket;
socket.on('error', console.log.bind(console));
socket.on('parseError', console.log.bind(console));
console.log('Please enter password:');
util.readPassword(function(password) {
    socket.connect(server, username, password, 'WoW', 16057);
});
