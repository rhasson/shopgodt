//9acd2cac05f546406218e4ca6868f628

/*
* Gilt API
* v0.1
*/

var r = require('request');
var conf = null; //require('../config/app_config.js').app_config.gilt;
var qs = require('querystring');

function Gilt(opts) {
	if (opts) {
		this.key = opts.key ? opts.key : conf ? conf.key : null;
		this.url = opts.url ? opts.url : conf ? conf.url : 'https://api.gilt.com/v1';
		this.affid = opts.affid ? opts.affid : conf ? conf.affid : null;
		this.format = opts.format ? opts.format : conf ? conf.format : 'json';
	}
	this.stores = ['men', 'women', 'kids', 'home'];
}

/*
* get the active and upcoming sales
* type: "active", "upcoming" or "detail" (for sale_key searches)
* store: men, women, kids or home
* sale_key: sale_key to narrow the sale to
* cb: callback
* returns: JSON object with the list of sales
*/
Gilt.prototype.sales = function(type, store, sale_key, cb) {
	var href = {};
	var url = '';

	
	if (!type || type === '') return cb(new Error('first paramter must be active or upcoming'));
	if (typeof(store) === 'function') {
		cb = store;
		strore = null;
	}
	if (typeof(sale_key) === 'function') {
		cb = sale_key;
		sale_key = null;
	}

	href.resource = type;
	href.path = '/sales';
	
	if (store && this.stores.indexOf(store) !== -1) {
		href.store = store;
		if (sale_key) {
			href.sale_key = sale_key;
			if (href.resource !== 'detail') href.resource = 'detail';
		}
	}

	url = this.makeUrl(href);
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			return cb(null, d.sales);
		} else return cb(err);
	});
}

Gilt.prototype.products = function() {
	var href = {};
	var url = '';

	var args = Array.prototype.slice.call(arguments);

	href.path = '/products';

	args.forEach(function(arg, i) {
		if (typeof(arg) === 'function') cb = arg;
		else {

		}
	});


	if (!id) href.resource = 'categories';
	else {
		href.store = id;
		href.resource = 'detail';
	}

	url = this.makeUrl(href);
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			return cb(null, d.sales);
		} else return cb(err);
	});	
}
Gilt.prototype.getProduct = function(url, cb) {
	if (!url || url === '') return cb(new Error('Product URL must be provided'));

	url += '?apikey=' + this.key;
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			return cb(null, d);
		} else return cb(err);
	});
}

Gilt.prototype.search = function(query, store, sql, cb) {

}

Gilt.prototype.makeUrl = function(href) {
	var self = this;
	var url = '';

	href.apikey = 'apikey=' + self.key;

	if (href.store) {
		href.path += '/' + href.store + '/';
		if (href.sale_key && href.resource === 'detail') href.path += href.sale_key + '/';
	} else href.path += '/';

	if (href.resource !== 'josql') href.resource = href.resource + '.' + self.format;

	url = self.url
		+ href.path
		+ href.resource
		+ '?'
		+ href.apikey;
	if (href.sql && href.resource === 'josql') url += '&q=' + encodeURIComponent(href.sql);

	return url;
}

module.exports = exports = Gilt;