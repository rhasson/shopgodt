/*
* Extenssions to Access module
*/

var shopstyle = require('./shopstyle.js');
var zapi = require('./zapposapi.js');
var natural = require('natural');
var _score = require('underscore');

function AccessExt() {
	
}

AccessExt.prototype.getPrices = function(name, cb) {
	var prod = [],
		ary = [],
		saved = {},
		count = 3,
		coef = 0;
	if (typeof(cb) !== 'function') throw(new Error('Missing a callback function'));
	else if (!name || typeof(name) === 'function') return cb(new Error('First argument must be a product name'));
	shopstyle.search(name, function(err, data) {
		if (!err) {
			if (data.totalCount > 0) {
				data.products.forEach(function(item, i) {
					//TODO: improve for better results
					coef = natural.DiceCoefficient(item.name, name);
					if (coef > 0.56) {
						saved.coef = coef;
						saved.name = item.name;
						saved.retailer = item.retailer;
						saved.price = item.price;
						saved.instock = item.inStock;
						saved.url = item.url;
						prod.push(saved);
					}
					saved = {};
				});
			}
			return cb(null, _score.last(_score.sortBy(prod, 'coef'), count));
		} else return cb(err);
	});
}

AccessExt.prototype.getProductDetails = function(info, cb) {
	var self = this;
	if (typeof(info) === 'function') return info(new Error('first argument must be an object with name or id to search'));
	if (info.id) {
		zapi.product(info.id, function(err, data) {
			var name = null
				d = null;
			if (!err) {
				name = data.product[0].brandName + " " + data.product[0].productName;
				d = {
					name: name,
					results: data.product
				}
				return cb(null, d);
			}
			else return cb(err);
		});
	} else if (info.name) {
		console.log('SEARCHING')
		zapi.search(info.name, function(err, data) {
			console.log('INSIDE SEARCHING')
			var temp = null,
				name = null,
				d = null;
			if (!err) {
				if (data.results.length === 0) {
					temp = info.name.split(' ');
					temp.pop();
					info.name = temp.join(' ');
					self.getProductDetails(info, cb);
				} else {
					name = data.term.replace(/(^|\s)([a-z])/g, function(m,p1,p2) { return p1+p2.toUpperCase() });
					d = {
						name: name,
						results: data.results
					}
					return cb(null, d);
				}
			}
			else return cb(err);
		});
	}
}

module.exports = exports = new AccessExt();