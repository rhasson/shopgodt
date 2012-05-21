var db = require('./db').db,
	helper = require('./helper.js').helper,
	util = require('util');

/** Class for managing database access.  Can be extended to meet the needs to Item, Profiles, Questions, etc. **/
function Access(o) {
	if (typeof(o) === 'string') {
		this._type = o;
		o = {};
	} else if (typeof(o) === 'object') {
		this._type = o.type ? o.type : throw Error('first argument must be a type to create, Items, Profiles, etc.');
	} else {
		throw Error('first argument must be a type to create, Items, Profiles, etc.');
	}
	this._views = {};
	this._views.all = this._type+'/all';
	this._views.
}

exports.questions = {
	all: function(params, cb) {
		if (typeof(params) === 'function') {
			cb = params;
			params = {};
		}
		params.view = params.view || 'questions/all';
		this._get(params, function(err, data) {
			err ? cb(err) : cb(null, data);
		});
	},

	byId: function(params, cb) {
		var opts = {};
		if (typeof(params) === 'function') {
			return cb(new Error('first argument must be document id'));
		} else if (typeof(params) === 'string' || params instanceof Array) {
			opts.id = params;
		}
		helper.copy(params, opts);

		this._get(opts, function(err, data) {
			err ? cb(err) : cb(null, data);
		});
	},

	byItemId: function(params, cb) {
		if (typeof(params) === 'function') {
			return cb(new Error('first argument must be document id'));
		} else if (typeof(params) === 'string') {
			var opts = {
				view: 'questions/byItemId',
				body: {key: params}
			};
			this._get(opts, function(err, data) {
				err ? cb(err) : cb(null, data);
			});
		}
	},

	save: function(params, cb) {
		if (Object.keys(params).length > 0) {
			this._set(params, function(err, doc) {
				if (err) return cb(err);
				return cb(null, doc)
			})
		}
	},

	update: function(params, cb) {

	},

	remove: function(params, cb) {

	},

	_get: function(params, cb) {
		params.view ? db.view(params, back) : db.get(params, back);
		
		function back(err, data) {
			if (!err) {
				cb (null, data);
			} else {
				cb(new Error('db read error - '+err.error));
			}
		};
	},

	_set: function(params, cb) {
		var opts = {
			body: params
		};
		db.save(opts, function(err, data) {
			if (!err) {
				cb(null, data);
			} else {
				error = new Error('db write error - '+err.error);
			}
		});
	}

};