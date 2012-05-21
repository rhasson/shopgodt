var util = require('util');
var c = require('cradle');

exports.db = {
	init: function(conf) {
		if (!this._cradle) {
			c.setup({
				host: conf.host,
				port: conf.port,
				auth: conf.auth,
				cache: true,
				raw: false
			});
		}
		this._cradle = this._cradle || new(c.Connection);
		this._db = this._db || this._cradle.database('shopgodt');
	},

	get: function(params, cb) {
		if ('id' in params) {
			params.rev ? this._db.get(params.id, params.rev, back) : this._db.get(params.id, back);
		} else cb(new Error('first argument must be a document id'));
		
		function back (err, data) {
			var error = null;
			if (!err) {
				try { var d = JSON.parse(data); }
				catch (e) { error = new Error(e); }
				error ? cb(error) : cb(null, d);
			} else {
				return cb(new Error(err.error+" : "+err.reason));
			}
		}
	},

	save: function(params, cb) {
		if ('id' in params) {
			params.rev ? this._db.save(params.id, params.rev, params.body, back) : this._db.save(params.id, params.body, back);
		} else {
			this._db.save(params.body, back);
		}

		function back (err, data) {
			var error = null;
			if (!err) {
				try { var d = JSON.parse(data); }
				catch (e) { error = new Error(e); }
				error ? cb(error) : cb(null, d);
			} else {
				return cb(new Error(err.error+" : "+err.reason));
			}
		}
	},

	update: function(params, cb) {
		if ('id' in params) {
			this._db.merge(params.id, params.body, back);
		} else return cb(new Error('first argument must contain a document id'));
		
		function back (err, data) {
			var error = null;
			if (!err) {
				try { var d = JSON.parse(data); }
				catch (e) { error = new Error(e); }
				error ? cb(error) : cb(null, d);
			} else {
				return cb(new Error(err.error+" : "+err.reason));
			}
		}
	},

	remove: function(params, cb) {
		if ('id' in params) {
			params.rev ? this._db.remove(params.id, params.rev, back) : this_db.remove(params.id, back);
		} else return cb(new Error('first argument must contain a document id'));

		function back (err, data) {
			var error = null;
			if (!err) {
				try { var d = JSON.parse(data); }
				catch (e) { error = new Error(e); }
				error ? cb(error) : cb(null, d);
			} else {
				return cb(new Error(err.error+" : "+err.reason));
			}
		}
	},

	view: function(params, cb) {
		if ('view' in params) {
			params.key ? this._db.view(params.view, params.key, back) : this._db.view(params.view, back);
		} else return cb(new Error('first argument must be a valid view name'));

		function back (err, data) {
			var error = null;
			if (!err) {
				try { var d = JSON.parse(data); }
				catch (e) { error = new Error(e); }
				error ? cb(error) : cb(null, d);
			} else {
				return cb(new Error(err.error+" : "+err.reason));
			}
		}
	}, 

	//need a way to have only one callback function for all methods. 
	//figure out if we can pass local cb into this call and maintain its err/data params
	_cb: function() {
		var args = Array.prototype.slice.call(arguments),
			err = args.shift();
			data = args.shift();
			cb = args.shift();		
	}
};