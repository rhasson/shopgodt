/*  Scraper wrapper
	Manages incoming scraping and parsing requests and fires appropriate scraper workers
	EventEmitter interface for both requesters and workers
*/

var util = require('util');
var path = require('path');
var url = require('url');
var ee = require('events').EventEmitter;

function Scraper () {
	this._path = path.join(__dirname, 'scrapers');

	this._pool = require('./pool.js');
	
	this._TPL = path.join(this._path, 'template.js');
	this._MIN_WORKERS = 1;
	this._MAX_WORKERS = 5;
	this._KA_TIMER = 2000;
	this._EXPIRE = 5000;

	this._isInitialized = false;

	this._MODULES = [
		{name: 'zappos.com', file_path: path.join(this._path, 'zappos.js')}
	];

	ee.call(this);
}

util.inherits(Scraper, ee);
/*
* Initialize the worker pool manager
* params:
*	min_workers (int) - minimum number of workers to start with
* 	max_workers (int) - maximum number of workers to allow
*	keepalive (int) - timer value for the keepalive with the template worker (in ms)
*	expire (int) - timer value to determine how long to keep template workers alive after they finished work (in ms)
* events:
*	ready - (count), returns the number of workers that were initialized
*	error - (Error), returns an Error object
*/
Scraper.prototype.init = function (opts) {
	var self = this;

	if (!this._isInitialized) {
			var o = {};
			o.MIN_WORKERS = this._MIN_WORKERS = opts ? (opts.min_workers || this._MIN_WORKERS) : this._MIN_WORKERS;
			o.MAX_WORKERS = this._MAX_WORKERS = opts ? (opts.max_workers || this._MAX_WORKERS) : this._MAX_WORKERS;
			o.KA_TIMER = this._KA_TIMER = opts ? (opts.keepalive || this._KA_TIMER) : this._KA_TIMER;
			o.KA_EXPIRE = this._KA_EXPIRE = opts ? (opts.expire || this._EXPIRE) : this._EXPIRE;
			o.TPL = this._TPL = opts ? (opts.worker_template || this._TPL) : this._TPL;

		this._pool.on('ready', function(count) {
			self.emit('ready', count);
			self._isInitialized = true;
		});
		this._pool.on('error', function(err) {
			self.emit('error', err);
			self._isInitialized = false;
		});
		this._pool.on('remove', function(pid) {
			self.emit('remove', pid);
		});

		this._pool.init(o);
	}
}

/*
* Creates a scraper and returns a error and child objects
* params:
*	(string) href: fully qualified URL to parse
*	(object) args: optional arguments to pass to the parser
*	(object) opts: optional options to pass to the child object
*	(function) cb: callback receiving error and child objects
* events - child:
*	data - (data), returns data from the parser
*	error - (Error), returns Error object if parsing failed
*/ 
Scraper.prototype.create = function(href, args, opts, cb) {
	var self = this;
	var hn = url.parse(href).hostname.replace(/^[www.]+/, '');
	var _path = '';

	for (var i=0; i<self._MODULES.length; i++) {
		if (self._MODULES[i].name === hn) {
			_path = self._MODULES[i].file_path;
		}
	}

	if (typeof(args) === 'function') {
		cb = args;
		args = {};
	} else if (typeof(opts) === 'function') {
		cb = opts;
		opts = {};
	}
	
	args = args || {};
	args.url = args.url || href;

	var o = {
		path: _path,
		args: args || {},
		opts: opts || {}
	};

	self._pool.create(o, function(err, child) {
		if (!err) return cb(null, child);
		else return cb(err);
	});
}

Scraper.prototype.addModule = function(mod) {
	for (var i=0; i < this._MODULES.length; i++) {
		if (mod.name === this._MODULES[i].name) return true;
		else {
			this._MODULES.push(mod);
			return true;
		}
	}
	return false;
}

Scraper.prototype.removeModule = function(name) {
	for (var i=0; i < this._MODULES.length; i++) {
		if (name === this._MODULES[i].name) {
			this._MODULES.remove(i);
			return true;
		}
	}
	return false;
}

module.exports = exports = new Scraper();