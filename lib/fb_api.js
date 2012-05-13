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
		this.graph = "https://graph.facebook.com/";
	} else throw new Error('missing arguments');
}

Facebook.prototype.init = function(o) {
	return function init(req, res, next) {
		if (!req.session) console.warn("Express session middleware is required");
		var i = this;
		req._fb = {};
		req._fb.instance = i;
		req.isAuthenticated = this.isAuthenticated;
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

Facebook.prototype.logout = function() {
	
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
			req._fb.error = self._error;
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
					req._fb = {
						access_token: self._access_token,
						expires: Date.now() + (self._expires * 1000),
						code: self._code
					};
					return next();
				} else if (resp.statusCode == 400) {
					var d = '';
					try { d = JSON.parse(body); }
					catch (e) { 
						self._error = new Error('failed to parse error code from Facebook');
						req._fb.error = self._error;
						return next();
					}
					self._error = new Error(d.error.message);
					self._error.type = d.error.type;
					req._fb.error = self._error;
					return next();
				}
			});
		}
	}
}

Facebook.prototype.refresh = function() {

}

Facebook.prototype.isAuthenticated = function(req) {
	if (this.session._fb) {
		if (!this.session._fb.error && this.session._fb.access_token) {
			x = ((Date.now() - req.session._fb.expires) < 0) ? true : false;
			return x;
		} else return false;
	}
}

exports = module.exports = Facebook;
