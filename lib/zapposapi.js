/*
* Zappos API module
* v.0.1
*/

var r = require('request');
var pid = require('../config/app_config.js').app_config.zappos.key;
var qs = require('querystring');

function Zapposapi(format) {
	this.base = 'http://api.zappos.com/';
	this.format = format || 'json';
}

/*
* Search for a product by keyword or sku number
* opts object may contain:
*   sort: object with key to sort on and direction(asc/desc)
*   includes: array of fields to be included
*   limit: number of items to return (max is 100)
* query is a string to search
*/
Zapposapi.prototype.search = function(query, opts, cb) {
	var action = 'Search?',
		sort = {"price", "asc"},  //asc or desc
		limit = 20,
		inc = ["dscription", "productRating"],
		url = '';
	if (typeof(opts) === 'function') {
		cb = opts;
		opts = {};
	}
	opts.includes = opts.includes ? opts.includes : inc;
	opts.includes = "["+opts.includes.toString()+"]";
	opts.limit = opts.limit ? opts.limit : limit;
	if (typeof(opts.sort) === 'object') opts.sort = JSON.stringify(opts.sort);
	else if(!opts.sort) opts.sort = JSON.stringify(sort);
	opts.key = pid;
	opts.term = query.replace(/\s+/ig, '+');

	if (!query || typeof(query) !== 'string') return cb(new Error('nothing to search'));
	url = this.base + action + qs.stringify(opts);

	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			if (d.statusCode === '200') return cb(null, d.results);
			else return cb(new Error(d.error))
		} else return cb(err);
	});
}

/*
* query is an object with id type and value. options are:
*   id types:  id(this is the sku), upc, stockId
*      for id, a color id may also be included such as <skuid>:<colorid>
*   values: a string with a single id or an array with multiple ids (strings)
*   for example: {upc: '123456'} or {id: '1234:77788'}
* opts object may contain:
*/
Zapposapi.prototype.product = function(query, opts, cb) {
	var action = 'Product?',
		inc = ["dscription", 
				"productRating", 
				"sizeFit", 
				"widthFit", 
				"archFit", 
				"overallRating", 
				"comfortRating", 
				"lookRating", 
				"styles", 
				"thumbnailImageUrl", 
				"stocks", 
				"measurements"
			   ],
		url = '',
		k = null;

	if (typeof(opts) === 'function') {
		cb = opts;
		opts = {};
	}

	opts.includes = opts.includes ? opts.includes : inc;
	opts.includes = "["+opts.includes.toString()+"]";
	opts.key = pid;
	
	if (typeof(query) === 'string') opts.id = query
	else if (query.length) {
		opts.id = "["+query.toString()+"]";
	} else if (typeof(query) === 'object') {
		k = Object.keys(query)[0];
		opts[k] = (typeof(query[k]) === 'object') ? "["+query[k].toString+"]" : query[k];
	} else return cb(new Error('nothing to search'));

	url = this.base + action + qs.stringify(opts);

	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			if (d.statusCode === '200') return cb(null, d.product);
			else return cb(new Error(d.error))
		} else return cb(err);
	});
}

module.exports = exports = new Zapposapi();