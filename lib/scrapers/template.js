var path = require('path');
var util = require('util');

var parser = null;
var args = null;
var int_id = null;

process.on('message', function(m) {
	if (process.pid === m.pid) {
		if (typeof(m.msg) === 'string') {
			if (m.msg === 'keepalive') {
				
			} else if (m.msg === 'cleanup') {

			}
		} else {
			parser = require(m.msg.path);
			args = m.msg.args;

			parser.parse(args.url, function(e, data) {
				if (!e) {
					console.log(JSON.stringify(data));
					//process.send({pid: process.pid, msg: data});
					process.nextTick(function() {
						_cleanup();
					});

				} else process.disconnect();
			});
		}
	}
});

process.on('disconnect', function(){
	parser = null;
	args = null;
});

process.on('exit', function(code, signal) {
	parser = null;
	args = null;	
	//process.send({pid: process.pid, msg: 'exit'});
});

_keepalive = function () {
	process.send({pid: process.pid, msg: 'keepalive'});
}

_cleanup = function () {
	parser = null;
	args = null;
	process.send({pid: process.pid, msg: 'cleanup'});
}