/*
* Shopstyle API module
* v.0.1
*/

var r = require('request');
var pid = require('../config/app_config.js').shopstyle.id;
var qs = require('querystring');

function Shopstyle(format) {
	this.base = 'http://api.shopstyle.com/action/';
	this.format = format || 'json';
}

Shopestyle.prototype.search = function(query, opt, cb) {
	var action = 'apiSearch?',
		url = '',
		min = 0,
		count = 20,
		format = this.format;
	if (typeof(opt) === 'function') {
		cb = opt;
		opt = null;
	}
	if (opt) {
		min = opt.min;
		count = opt.count;
		format = opt.format;
	}
	if (!query || typeof(query) !== 'string') return cb(new Error('nothing to search'));

	url = this.base + action + qs.stringify({
		pid: pid,
		fts: query,
		min: min,
		count: count,
		format: format
	});

	r.request(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			return cb(null, body);
		} else return cb(err);
	});
}

Shopstyle.prototype.getBrands = function(cb) {
	var action = 'apiGetBrands?',
		url = '';

	url = this.base + action + qs.stringify({
		pid: pid,
		format: this.format
	});

	r.request(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			return cb(null, body);
		} else return cb(err);
	});
}

Shopstyle.prototype.getRetailers = function(cb) {
	var action = 'apiGetRetailers?',
		url = '';

	url = this.base + action + qs.stringify({
		pid: pid,
		format: this.format
	});

	r.request(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			return cb(null, body);
		} else return cb(err);
	});
}

Shopestyle.prototype.getTrends = function(category, skipSample, cb) {
	var action = 'apiGetTrends?',
		url = '';

	q = {
		pid: pid,
		format: this.format;
	}
	if (category) q.cat = category;
	q.products = skipSample ? 1 : 0;
	url = this.base + action + qs.stringify(q);

	r.request(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			return cb(null, body);
		} else return cb(err);
	});
}

module.exports = exports = new Shopstyle();