

/*
* Gilt API
* v0.1
*/

var r = require('request');
var conf = require('../config/app_config.js').app_config.gilt;
var qs = require('querystring');

function Gilt(opts) {
	if (opts) {
		this.key = opts.key || null;
		this.url = opts.url || 'https://api.gilt.com/v1';
		this.affid = opts.affid || null;
		this.format = opts.format || 'json';
	} else if (conf) {
		this.key = conf.key || null;
		this.url = conf.url || 'https://api.gilt.com/v1';
		this.affid = conf.affid || null;
		this.format = conf.format || 'json';
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

	
	if (!type || type === '') return cb(new Error('first paramter must be active, upcoming or detail'));
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
	
	this.makeRequest(url, cb);

}

/*
* products api
* id: product id
*/
Gilt.prototype.products = function(id, cb) {
	var href = {};
	var url = '';

	href.path = '/products';

	if (typeof(id) === 'function') return id(new Error('First argument must be a product ID'));
	else {
		href.store = id;
		href.resource = 'detail';
	}

	url = this.makeUrl(href);

	this.makeRequest(url, cb);
}

/*
* Gets a list of product categories
*/
Gilt.prototype.categories = function(cb) {
	var href = {};
	var url = '';

	href.path = '/products';
	href.resource = 'categories';

	url = this.makeUrl(href);

	this.makeRequest(url, cb);
}

/*
* Gets the product object by providing the product url received from sales api
* URL: product url received from sales api
*/
Gilt.prototype.getProductByUrl = function(url, cb) {
	if (!url || url === '') return cb(new Error('Product URL must be provided'));

	url += '?apikey=' + this.key;

	this.makeRequest(url, cb);
}

/*
* Search Gilt via josql
* type: 'sales' or 'products'
* query: josql WHERE clause (not including the WHERE keyword)
*   make sure to single quote search terms
*/
Gilt.prototype.search = function(type, query, cb) {
	var href = {};
	var url = '';

	href.path = '/' + type;
	href.resource = 'josql';
	href.sql = query;

	url = this.makeUrl(href);

	this.makeRequest(url, cb);
}

/*
*  creates the proper URL to be used in api call
*  href: object containing all necessary parts to create the url
*  returns: formatted URL
*/
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
	if (href.sql && href.resource === 'josql') url += '&q="' + encodeURIComponent(href.sql) + '"';

	return url;
}

/*
* make api request
* url: the url to use for the request
* returns: object containing the returned data or Error object with api defined error or request error
*/
Gilt.prototype.makeRequest = function(url, cb) {
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = JSON.parse(body);
			if (d.message && d.message.indexOf('Error')) {
				var e = new Error();
				e.message = d.message;
				e.code = d.id;
				return cb(e);
			} else {
				if ('sales' in d) return cb(null, d.sales);
				else return cb(null, d);
			}
		} else return cb(err);
	});
}

module.exports = exports = Gilt;