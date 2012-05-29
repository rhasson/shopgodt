//Facebook API

var r = require('request'),
	qs = require('querystring'),
	cache = require('redis').createClient();

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

	} else throw new Error('missing arguments');
}

Facebook.prototype.init = function(o) {
	var self = this;
	return function init(req, res, next) {
		var i = self;
		self._fb = {};

		self._setupReq(req);

		next();
	}
}

Facebook.prototype.login = function(o) {
	var self = this;
	return function login(req, res, next) {
		self.redirect_uri = o ? o.redirect_uri : self.redirect_uri;
		var url = self.oauth_url + qs.stringify({
			client_id: self.app_id,
			redirect_uri: self.redirect_uri,
			scope: o ? o.scope : self.scope,
			state: o ? o.state : self.state
		});
		res.redirect(url);
	}
}

Facebook.prototype.logout = function(o) {
	var self = this;
	return function logout(req, res, next) {
		var back = o ? o.redirect_uri : "http://codengage.com/";
		if (req.session.fb) {
			var url = self.logout_url + qs.stringify({
					next: back,
					access_token: req.session.fb.access_token
			});
			delete req.session.fb;
			req.session.destroy(function(err) {
				console.log('session destroy: ', err);
			});
			res.redirect(url);  //may need to move this into the destroy callback
		} else {
			var e = new Error();
			e.message = "failed to logout";
			res.render('error', {locals: {user: 'Visitor', error: e}});
		}
	}
}

Facebook.prototype.profile = function(token, cb) {
	var url = this.graph + 'me?' + qs.stringify({access_token: token});
	r(url, function(err, resp, body) {
		if (!err && resp.statusCode == 200) {
			var d = '';
			try { d = JSON.parse(body); }
			catch (e) { 
				self._error = new Error('failed to parse error code from Facebook');
				return cb(self._error);				
			}
			return cb(null, d);
		}
	});
}

Facebook.prototype.redirect = function(o) {
	var self = this;
	//TODO: store temporary session to redis key on req.sessionId
	//TODO: add support for success and failure redirects or callbacks
	return function redirect (req, res, next) {
		if ('error' in req.query) {
			self._error = new Error(req.query.error);
			self._error.reason = req.query.error_reason;
			self._error.description = req.query.error_description.replace('+', ' ');
			req.session.fb = self._error;
			next();
		} else {
			self._code = req.query.code;
			var url = self.token_url + qs.stringify({
				client_id: self.app_id,
				redirect_uri: self.redirect_uri,
				client_secret: self.app_secret,
				code: self._code
			});
			r(url, function(err, resp, body) {
				if (!err && resp.statusCode == 200) {
					var q = qs.parse(body);
					self._access_token = q.access_token;
					self._expires = q.expires;
					self.profile(self._access_token, function(err2, user) {
						if (!err2 ) {
							self._fb.access_token = self._access_token;
							self._fb.expires = Date.now() + (self._expires * 1000);
							self._fb.code = self._code;
							self._fb.user = user;
							req.session.fb = self._fb;
							next();
						} else {
							self._error = req.session.fb = err2;
							next();
						}
					});
				} else if (resp.statusCode == 400) {
					var d = '';
					try { d = JSON.parse(body); }
					catch (e) { 
						self._error = new Error('failed to parse error code from Facebook');
						req.session.fb = self._error;
						next();
					}
					self._error = new Error(d.error.message);
					self._error.type = d.error.type;
					req.session.fb = self._error;
					next();
				}
			});
		}
	}
}

Facebook.prototype.refresh = function() {

}

Facebook.prototype.getFriends = function() {
	var self = this;
	return function getFriends (req, res, next) {
		var url = self.graph + 'me/friends?' + qs.stringify({access_token: req.session.fb.access_token});
		r(url, function(err, resp, body) {
			if (!err && resp.statusCode == 200) {
				var d = '';
				try { d = JSON.parse(body); }
				catch (e) { 
					self._error = new Error('failed to parse error code from Facebook');
					req.session.fb.friends = self._error;
					next();
				}
				req.session.fb.friends = d.data;
				next();
			}
		});
	}
}

Facebook.prototype.post = function() {
	var self = this;
	return function post(req, res, next) {
		cache.hget('questions', req.session.fb.fb_id, function(err, question) {
			if (!err) {
				cache.hget('pins', req.session.fb.fb_id, function(err2, item) {
					if (!err2) {
						var q = JSON.parse(question);
						var l = JSON.parse(item);
						var url = path.join(self.graph, q.to_id, 'feed');
						var body = qs.stringify({
							picture: l.media,
							message: q.question,
							link: 'http://codengage.com/api/v1/item/'+l.item_id,
							type: 'link'
						});
						r.post({url: url, body: body}, function(err, resp, b) {
							if (!err && resp.statusCode === 200) {
								var d = '';
								try {
									console.log('FB POST RESP: ', b);
									d = JSON.parse(b);
									req.session.fb.wall_post = d;
									next();
								} catch(e) { 
									req.session.fb.wall_post = new Error('failed to parse wall post response');
									next();
								}
							}
						});
					}
				});
			}
		});
	}
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
		} else if (this._fb) {
			if (!this._fb.error && this._fb.access_token) {
				var x = ((Date.now() - this._fb.expires) < 0) ? true : false;
				return x;
			} else return false;
		}
	};
	req.getToken = function() {
		if (this.session.fb) {
			return this.session.fb.access_token || this._fb.access_token || null;
		}
	};
}

exports = module.exports = Facebook;
