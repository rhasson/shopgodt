var redis = require('redis');
var util = require('util');

function Cache(o) {
	if (o.port && o.host && o.opts) {
		this.client = redis.createClient(o.port, o.host, o.opts);
	} else {
		this.client = redis.createClient();
	}

	this.client.on('error', function(err) {
		console.error('REDIS CACHE ERROR: ', util.inspect(err,true,null));
	});
};

Cache.prototype.set(h, k, v, cb) {
	if (typeof(v) === 'function') {
		cb = v;
		v = '';
	}
	if (h) {
		this.client.hset(h, k, v, function(err, res) {
			if (!err) return cb(null, res);
			else return cb(err);
		});
	} else {
		this.client.set(k, v, function(err, res) {
			if (!err) return cb(null, res);
			else return cb(res);
		});
	}
};

Cache.prototype.get(h, k, cb) {
	if (typeof(k) === 'function') {
		cb = k;
		k = null;
	if (!k) {
		this.client.hkeys(h, function(err, keys){
			if (!err) return cb(null, keys);
			else return cb(err);
		});
	} else {
		this.client.hget(h, k, function(err, res) {
			if (!err) return cb(null, res);
			else return cb(err);
		});
	}
};

exports = module.exports = Cache