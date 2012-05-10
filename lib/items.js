var db = require('./db').db,
	helper = require('./helper.js').helper,
	util = require('util');

exports.items = {
	all: function(params, cb) {
		if (typeof(params) === 'function') {
			cb = params;
			params = {};
		}
		params.view = params.view || 'items/all';
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

	byFbId: function(params, cb) {
		if (typeof(params) === 'function') {
			return cb(new Error('first argument must be document id'));
		} else if (typeof(params) === 'string') {
			var opts = {
				view: 'items/byFbId',
				body: {key: params}
			};
			this._get(opts, function(err, data) {
				err ? cb(err) : cb(null, data);
			});
		}
	},

	save: function(params, cb) {
		if (Object.keys(params).length > 0) {
			this._set()
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