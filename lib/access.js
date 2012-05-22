var db = require('./db').db,
	util = require('util');

/** Class for managing database access.  Can be extended to meet the needs to Item, Profiles, Questions, etc. **/
function Access(o) {
	if (typeof(o) === 'string') {
		this._type = o;
		o = {};
	} else if (typeof(o) === 'object') {
		if (o.type) this._type = o.type;
		else throw new Error('first argument must be a type to create, Items, Profiles, etc.');
	} else throw new Error('first argument must be a type to create, Items, Profiles, etc.');
	this._views = [];
}

Access.prototype.addView = function(name, view_cb) {
	if (typeof(name) !== 'string') throw new Error('first argument must be a view name to add');
	if (typeof(view_cb) !== 'function') throw new Error('second argument must be a callback to assign');
	name =  name.match('/') ? name : this._type+'/'+name;
	this._views[name] = view_cb;
}
/*
	params: a string view name or an object with view name and/or key
	  - view: view name, in the form of a name or a collection/name
	  - key: key to pass to the view
	cb: callback function if a listener was not provided via addView method
*/
Access.prototype.view = function(params, cb) {
	var opts = {};
	if (typeof(params) === 'string') opts.view = params.match('/') ? params : this._type+'/'+params;
	if (params.view) {
		opts.view = params.view.match('/') ? params.view : this._type+'/'+params.view;
		if (params.key) opts.key = params.key;
	}
	
	cb = cb || this._views[opts.view];
	_get(opts, function(err, data) {
		if (!cb) throw new Error('callback function was not provided.  Dropping data');
		err ? cb(err) : cb(null, data);
	});
};

/*
	params: a string document id or an object with id and/or rev
	  - id: document id
	  - rev: optional revision
	cb: callback function
*/
Access.prototype.get = function(params, cb) {
	var opts = {};

	if (typeof(params) === 'string') opts.id = params;
	else if(params.id) {
		opts.id = params.id;
		if (params.rev) opts.rev = params.rev;
	}
	_get(opts, function(err, data) {
		err ? cb(err) : cb(null, data);
	});
};

Access.prototype.create = function(params, cb) {
	if (!params.type) params.type = this._type;
	var self = this;
	switch (params.type) {
		case 'profile':
			params.fb_id = params.id;
			delete params.id;

			this.view({
				view: 'byFbId',
				body: {key: params.fb_id}
			}, function(err, doc) {
				if (err) return cb(err);
				else if (doc.length  === 0) {
					self.save({body: params}, function(err2, newDoc) {
						if (err2) return cb(err2);
						else if (newDoc.ok) return cb(null, {doc_id: newDoc.id, fb_id: params.fb_id});//newDoc.id+':'+params.fb_id);
					});
				}
				else if (doc.length > 0) {
					self.update({id: doc[0].id, body: params}, function(err3, upDoc) {
						if (err3) return done(err3);
						else if (upDoc.ok) return cb(null, {doc_id: upDoc.id, fb_id: params.fb_id});//upDoc.id+':'+params.fb_id);
					});
				} else return cb(new Error('Error with log in and registration process'));
			});
			break;
		default:
			self.save(params, function(err, doc) {
				if (err) return cb(err);
				else if (doc.ok) return cb(null, doc);
			});
			break;
	};
}

/*
	params: object containing id, rev and body or just data to be saved
*/
Access.prototype.save = function(params, cb) {
	if (Object.keys(params).length > 0) {
		_set(params, function(err, doc) {
			if (err) return cb(err);
			return cb(null, doc)
		});
	}
};

Access.prototype.update = function(params, cb) {
	var opts = {};
	if (Object.keys(params).length > 0) {
		if (params.id) opts.id = params.id;
		else return cb(new Error('missing id'));
		if (params.rev) opts.rev = params.rev;
		if (params.body) opts.body = params.body;
		else return cb(new Error('missing a body to update'));

		db.update(opts, function(err, data) {
			err ? cb(err) : cb(null, data);
		});
	}

};

Access.prototype.remove = function(params, cb) {
	var opts = {};
	if (params.id) opts.id = params.id;
	else return cb(new Error('missing id'));
	if (params.rev) opts.rev = params.rev;

	db.remove(opts, function(err) {
		err ? cb(err) : cb();
	});
};

var _get = function(params, cb) {
	params.view ? db.view(params, back) : db.get(params, back);
	
	function back(err, data) {
		if (!err) {
			cb (null, data);
		} else {
			cb(new Error('db read error - '+err.error));
		}
	};
};

var _set = function(params, cb) {
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
};

exports = module.exports = Access;