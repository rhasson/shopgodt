var ee = require('events').EventEmitter;
var util = require('util');
var fork = require('child_process').fork;
var Stream = require('stream').Stream;

function Pool (opts) {
	this._pool = {};
	this._pool.workers = [];
	this._pool.idle_workers = [];
	this._pool.active_workers = [];
	this._pool.queue_workers = [];

	this.TPL = '';
	this._MIN_WORKERS = 1;
	this._MAX_WORKERS = 5;
	this._KA_TIMER = 2000;
	this._KA_EXPIRE = 5000;

	this._keepalive = null;

	ee.call(this);

	/* Need to find a better place for this function */
	Array.prototype.remove = function(from, to) {
  		var rest = this.slice((to || from) + 1 || this.length);
  		this.length = from < 0 ? this.length + from : from;
  		return this.push.apply(this, rest);
	};
}

util.inherits(Pool, ee);

Pool.prototype.init = function(o) {
	this._TPL = o.TPL || this._TPL;
	this._MIN_WORKERS = o.MIN_WORKERS || this._MIN_WORKERS;
	this._MAX_WORKERS = o.MAX_WORKERS || this._MIN_WORKERS;
	this._KA_TIMER = o.KA_TIMER || this._KA_TIMER;
	this._KA_EXPIRE = o.KA_EXPIRE || this._KA_EXPIRE;


	if (this._pool.idle_workers.length < this._MIN_WORKERS && this._MIN_WORKERS > 0) this._initWorkers();
	else this.emit('ready', this._pool.idle_workers.length);
}

Pool.prototype._initWorkers = function() {
	var self = this;
	var count = -1;

	for (var i=0; i < self._MIN_WORKERS; i++){
		self.addWorker(self._TPL, function(err, child) {
			if (!(child instanceof Error) && !err) {
				child.once('exit', function(code, signal) {
					_exitHandler(self, this, code, signal);
				});
				child.once('disconnect', function() {
					_disconnectHandler(self, this);
				});
				child.once('close', function() {
					_exitHandler(self, this);
				});
				child.on('message', function(msg, sendHandle) {
					_msgHandler(self, this, msg, sendHandle);
				});
				//child.send({pid: child.pid, msg: 'keepalive'});
			} else self.emit('error', new Error('Failed to initialize workers'));
			count = self.idleCount();
			if (count === self._MIN_WORKERS) self.emit('ready', count);
			else self.emit('error', new Error('Failed to initialize requested number of workers: '+count));
		});
	}
}

Pool.prototype.create = function(o, cb) {
	var self = this;
	var x = null;

	if (arguments.length > 0) self._pool.queue_workers.push({task: o, cb: cb});

	if (self._pool.idle_workers.length > 0) {  //check if an idle worker is available to use
		x = self._pool.queue_workers.shift();
		self._use(x.task, function(err, child) {
			x.cb(err, child);
		});
	} else if (self.workerCount() < self._MAX_WORKERS) { //no idle worker available, see if we didn't exceed MAX_WORKERS
		x = self._pool.queue_workers.shift();
		self._create(x.task, function(err, child) {
			x.cb(err, child);
		});
	} else { //no idle workers, at max allowed workers, queue request until is worker becomes available
		self.on('remove', function() {
			self.create();
		});
	}
}

Pool.prototype.addWorker = function(o, cb) {
	var w = null;
	var self = this;

	if (self.workerCount() < self._MAX_WORKERS) {
		if (typeof(o) === 'string') w = fork(o, [], {silent: true});
		else w = fork(o.path, o.args, {silent: true});
		if (w) {
			self._pool.workers.push(w);
			self._pool.idle_workers.push(w.pid);
			self.emit('add', w.pid);
			if (cb) return cb(null, w);
		} else {
			var e = new Error('Failed to add worker');
			self.emit('add', e);
			self.emit('error', e);
			if (cb) return cb(e);
		}
	} else {
		var e = new Error('Exceeded the maximum number of allowed workers');
		self.emit('add', e);
		self.emit('error', e);
		if (cb) return cb(e);
	}
	return;
}

Pool.prototype.removeWorker = function(pid) {
	var self = this;
	var flag = false;

	for (var i=0; i < self._pool.workers.length; i++) {
		if (pid === self._pool.workers[i].pid) {
			self._pool.workers[i].kill();
			self._pool.workers.remove(i);
			flag = true;
		}
	}
	for (var i=0; i < self._pool.idle_workers.length; i++) {
		if (pid === self._pool.idle_workers[i]) {
			self._pool.idle_workers.remove(i);
			flag = true;
		}
	}
	for (var i=0; i < self._pool.active_workers.length; i++) {
		if (pid === self._pool.active_workers[i]) {
			self._pool.active_workers.remove(i);
			flag = true;
		}
	}
	if (flag) self.emit('remove', pid);

	return flag;
}

Pool.prototype.cleanupWorker = function(child) {
	var self = this;
	var int_id = null;
	
	console.log('CLEANUP');
	child.stdin.end();
	
	for (var i=0; i < self._pool.active_workers.length; i++) {
		if (child.pid === self._pool.active_workers[i]) {
			self._pool.idle_workers.push(child.pid);
			self._pool.active_workers.remove(i);
			if (self._pool.idle_workers.length > self._MIN_WORKERS) self.removeWorker(child.pid);
			//else child.send({pid: child.pid, msg: 'keepalive'});
		}
	}
	return;
}

Pool.prototype.getWorker = function(pid) {
	var self = this;
	for (var i=0; i < self._pool.workers.length; i++) {
		if (pid === self._pool.workers[i].pid) return self._pool.workers[i];
	}
	return false;
}

Pool.prototype.getActiveWorkers = function() {
	return this._pool.active_workers;
}

Pool.prototype.getIdleWorker = function() {
	var self = this;

	var pid = self._pool.idle_workers.shift();
	if (pid) {
		for (var i=0; i < self._pool.workers.length; i++) {
			if (pid === self._pool.workers[i].pid) {
				self._pool.active_workers.push(pid);
				return self._pool.workers[i];
			} else return false;
		}
	} else return false;
}

Pool.prototype._create = function(o, cb) {
	var self = this;

	console.log('INSIDE CREATE', o);

	self.addWorker(self._TPL, function(err, child) {
		if (!err && child) {
			child.send({pid: child.pid, msg: {path: o.path, args: o.args}});
			return cb(null, child);
		} else return cb(err);
	});
}

Pool.prototype._use = function(o, cb) {
	var self = this;

	console.log('INSIDE USE', o);

	var child = self.getIdleWorker();
	if (child) {
		child.send({pid: child.pid, msg: {path: o.path, args: o.args}});
		return cb(null, child);
	} else return cb(new Error('Failed to activate idle worker'));
}

Pool.prototype.idleCount = function() {
	return this._pool.idle_workers.length;
}

Pool.prototype.activeCount = function() {
	return this._pool.active_workers.length;
}

Pool.prototype.workerCount = function() {
	return this._pool.idle_workers.length + this._pool.active_workers.length;
}

_msgHandler = function(self, child, m, sh) {
	if (child && child.pid === m.pid) {
		if (typeof(m.msg) === 'string') {
			if (m.msg === 'keepalive') {
				self._keepalive = true;
			} else if (m.msg === 'cleanup') {
				self._keepalive = false;
				self.cleanupWorker(child);
			} else {
				child.emit('msg', m.msg);
			}
		} else if (m.msg instanceof Error) {
			self._keepalive = false;
			child.emit('error', m.msg);
			self.removeWorker(child.pid);
		}
	}
}

_exitHandler = function(self, child, code, signal) {
	console.log('EXIT: ', code);
	self.cleanupWorker(child.pid);
}

_disconnectHandler = function(self, child) {
	console.log('DISCONNECT');
	self.removeWorker(child.pid);
}

_remove = function(self, pid) {
	self.removeWorker(pid);
}

_keepalive = function(child) {
	child.send({pid: child.pid, msg: 'keepalive'});
}

module.exports = exports = new Pool();