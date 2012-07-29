//Facebook API

var r = require('request'),
	qs = require('querystring'),
	util = require('util'),
	cache = require('redis').createClient(),
	path = require('path');

function Facebook(o) {
	if (Object.keys(o).length) {
		this.app_id = o.app_id;
		this.app_secret = o.app_secret;
		this.redirect_uri = o.redirect_uri;
		this.scope = o.scope || null;
		this.state = o.state || "";

		this.oauth_url = "https://www.facebook.com/dialog/oauth?";
		this.token_url = "https://graph.facebook.com/oauth/access_token?";
		this.logout_url = "https://www.facebook.com/logout.php?";
		this.graph = "https://graph.facebook.com/";

		this._name = "fb_session";

		this._local_domain = 'http://codengage.com'

	} else throw new Error('missing arguments');
}

Facebook.prototype.init = function(o) {
	var self = this;
	return function init(req, res, next) {
		var i = self;
		//self._fb = {};
		if (!req.session.fb) req.session.fb = {};

		self._setupReq(req);

		next();
	}
}

Facebook.prototype.login = function(o, cb) {
	var self = this,
		s = '',
		url = '',
		e = null;
		
	if (typeof(o) === 'function') {
		cb = o;
		o = null;
	}

	s = o ? o.scope : self.scope;
	if (util.isArray(s)) s = s.join();
	self.redirect_uri = o ? o.redirect_uri : self.redirect_uri;
	url = self.oauth_url + qs.stringify({
		client_id: self.app_id,
		redirect_uri: self.redirect_uri,
		scope: s,
		state: o ? o.state : self.state
	});
	return cb(null, url);
}

Facebook.prototype.logout = function(req, o, cb) {
	var self = this,
		back = '',
		url = '',
		e = null;

	if (typeof(o) === 'function') {
		cb = o;
		o = null;
	}
	back = o ? o.redirect_uri : self._local_domain;
	if (req.session.fb) {
		url = self.logout_url + qs.stringify({
				next: back,
				access_token: req.session.fb.access_token
		});
		cache.hdel('friends', req.session.fb.fb_id, function(err){
			if (err) console.log('REDIS DEL ERROR: ', err);
		});
		req.session.destroy(function(err2) {
			if (err2) console.log('failed to destroy session', err2)
		});
		return cb (null, url);
	} else {
		e = new Error();
		e.message = "failed to logout";
		return cb(e);
	}
}

Facebook.prototype.profile = function(token, cb) {
	var url = this.graph + 'me?' + qs.stringify({access_token: token});
	var self = this;
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			var d = '';
			try { d = JSON.parse(body); }
			catch (e) { 
				self._error = new Error('failed to parse error code from Facebook');
				return cb(self._error);				
			}
			return cb(null, d);
		} else {
			if (err) return cb(new Error(err));
			else return cb(new Error(JSON.parse(body).error.message));
		}
	});
}

Facebook.prototype.redirect = function(req, cb) {
	var self = this;
	var q = '';
	var url = '';
	//TODO: add support for success and failure redirects or callbacks

	self._error = null;
	if (req.query.hasOwnProperty('error')) {
		self._error = new Error(req.query.error);
		self._error.reason = req.query.error_reason;
		self._error.description = req.query.error_description.replace('+', ' ');
		req.session.fb = self._error;
		return cb(self._error);
	} else {
		req.session.fb.code = req.query.code;
		url = self.token_url + qs.stringify({
			client_id: self.app_id,
			redirect_uri: self.redirect_uri,
			client_secret: self.app_secret,
			code: req.session.fb.code
		});
		r(url, function(err, resp, body) {
			var d = '';
			if (!err && resp.statusCode === 200) {
				q = qs.parse(body);
				req.session.fb.access_token = q.access_token;
				req.session.fb.expires = q.expires;
				self.profile(req.session.fb.access_token, function(err2, user) {
					if (!err2 ) {
						req.session.fb.expires = Date.now() + (req.session.fb.expires * 1000);
						req.session.fb.user = user;
						return cb(null, user);
					} else {
						self._error = req.session.fb = new Error(err2);
						return cb(self._error);
					}
				});
			} else {//if (resp.statusCode === 400) {
				try { d = JSON.parse(body); }
				catch (e) { 
					req.session.fb = self._error = new Error('failed to parse error code from Facebook');
					return cb(self._error);
				}
				console.log('FB ERROR: ', d);
				self._error = new Error(d.error.message);
				self._error.type = d.error.type;
				req.session.fb = self._error;
				return cb(self._error);
			}
		});
	}
}

Facebook.prototype.getFriends = function(req, cb) {
	var self = this,
		url = '';

	url = self.graph + 'me/friends?' + qs.stringify({limit: 1000, access_token: req.session.fb.access_token});
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode === 200) {
			cache.hset('friends', req.session.fb.fb_id, body);
			if (cb) return cb(null, JSON.parse(body));
			else return;
		} else {
			if (cb) return cb(err);
			else return;
		}
	});
}

Facebook.prototype.getComments = function(req, post_id, cb) {
	var self = this;
	var d = '';
	var url = self.graph + post_id + '?' + qs.stringify({access_token: req.session.fb.access_token});

	r(url, function(err, resp, body) {
console.log('COMMENTS: ', err, body);
		try { d = JSON.parse(body); }
		catch (e) {	
			console.log('Failed to get comments for post id: ', post_id);
			return cb(e);
		}
		if (!err && !d.error && resp.statusCode === 200) {
			cache.hset('comments', post_id, JSON.stringify(d.comments.data));
			return cb(null, d.comments.data);
		} else if (err) {
			return cb(new Error(err));
		} else {
			return cb(d);
		}

	});
}

Facebook.prototype.post = function(req, q, cb) {
	var self = this;
	cache.hget('pins', req.session.fb.fb_id, function(err2, item) {
		if (!err2) {
			var d = '';
			var l = JSON.parse(item);
			var url = self.graph + path.join(q.to_id, 'feed');
			var body = qs.stringify({
				access_token: req.session.fb.access_token,
				app_id: self.app_id,
				picture: self._local_domain + l.img_src,  //picture: l.media,
				name: 'ShopGodt Question',
				caption: l.parsed_name,
				message: q.question,
				type: 'link',
				link: self._local_domain + '/item/' + l.item_id
			});
			url += '?' + body;

			console.log(url);

			r.post({url: url}, function(err, resp, b) {
				console.error('POST: ', err, b);
				try { d = JSON.parse(b); }
				catch (e) {
					return cb(new Error('FB post response parse error'));
				}
				if (!err && !d.error && resp.statusCode === 200) {
					return cb(null, d.id);
				} else if (err) {
					return cb(new Error(err));
				} else {
					return cb(d);
				}
			});
		}
	});
}

Facebook.prototype._setupReq = function(req) {
	var name = this._name;
	req.isAuthenticated = function() {
		if (this.session.fb) {
			if (this.session.fb instanceof Error) return false;
			else if (this.session.fb.access_token) {
				var x = ((Date.now() - this.session.fb.expires) < 0) ? true : false;
				return x;
			} else return false;
		} /*else if (this._fb) {
			if (!this._fb.error && this._fb.access_token) {
				var x = ((Date.now() - this._fb.expires) < 0) ? true : false;
				return x;
			} else return false;
		}*/
	};
	req.getToken = function() {
		if (this.session.fb) {
			return this.session.fb.access_token || null;
		}
	};
}

exports = module.exports = Facebook;
