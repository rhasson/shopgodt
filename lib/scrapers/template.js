var path = require('path');
var util = require('util');
var Stream = require('stream').Stream();

var parser = null;
var args = null;
var int_id = null;

//if (!int_id) int_id = setInterval(_keepalive, 2000);

process.on('message', function(m) {
	if (process.pid === m.pid) {
		if (typeof(m.msg) === 'string') {
			if (m.msg === 'keepalive') {
				
			} else if (m.msg === 'cleanup') {
				_cleanup();
			}
		} else {
			parser = require(m.msg.path);
			args = m.msg.args;

			parser.parse(args.url, function(e, data) {
				if (!e) {

					//console.log(JSON.stringify(data));
					//process.stdin.write(JSON.stringify(data), 'utf8');
					process.send({pid: process.pid, msg: JSON.stringify(data)});
					process.nextTick(function() {
						//process.stdout.emit('close');
						//_cleanup();
					});

				} else process.disconnect();
			});
		}
	}
});

process.on('disconnect', function(){
	parser = null;
	args = null;
	if (int_id) clearInterval(int_id);
	int_id = null;
});

process.on('exit', function(code, signal) {
	parser = null;
	args = null;
	if (int_id) clearInterval(int_id);
	int_id = null;	
	//process.send({pid: process.pid, msg: 'exit'});
});

function _keepalive() {
	//console.log('KEEPALIVE');
	process.send({pid: process.pid, msg: 'keepalive'});
}

function _cleanup() {
	parser = null;
	args = null;
	if (int_id) clearInterval(int_id);
	int_id = null;
	process.send({pid: process.pid, msg: 'cleanup'});
}