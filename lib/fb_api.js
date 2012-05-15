//Facebook API

var r = require('request'),
	qs = require('querystring');

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
		req._fb = {};
		req._fb.instance = i;

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
		return res.redirect(url);
	}
}

Facebook.prototype.logout = function(o) {
	var self = this;
	return function logout(req, res, next) {
		var back = o.redirect_uri || "http://codengage.com/";
		var url = self.logout_url + qs.stringify({
				next: back,
				access_token: req.session.fb.access_token
		});
		delete req.session.fb
		res.redirect(url);
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
	})
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
			return next();
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
							req._fb = {
								access_token: self._access_token,
								expires: Date.now() + (self._expires * 1000),
								code: self._code,
								user: user
							};
							req.session.fb = self._fb;
							return next();
						} else {
							self._error = req.session.fb = err2;
							return next();
						}
					});
				} else if (resp.statusCode == 400) {
					var d = '';
					try { d = JSON.parse(body); }
					catch (e) { 
						self._error = new Error('failed to parse error code from Facebook');
						req.session.fb = self._error;
						return next();
					}
					self._error = new Error(d.error.message);
					self._error.type = d.error.type;
					req.session.fb = self._error;
					return next();
				}
			});
		}
	}
}

Facebook.prototype.refresh = function() {

}

Facebook.prototype._setupReq = function(req) {
	var name = this._name;
	req.isAuthenticated = function(req) {
		var s = null;
		if (s = req.session.fb) {
			if (s instanceof Error) return false;
			else if (s.access_token) {
				var x = ((Date.now() - s.expires) < 0) ? true : false;
				return x;
			} else return false;
		} else if (req._fb) {
			if (!req._fb.error && req._fb.access_token) {
				var x = ((Date.now() - req._fb.expires) < 0) ? true : false;
				return x;
			} else return false;
		}
	};
	req.getToken = function(req) {
		var s = null;
		if (s = req.session.fb) {
			return s.access_token || this._fb.access_token || null;
		}
	};
}

exports = module.exports = Facebook;
