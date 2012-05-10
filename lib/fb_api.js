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

Facebook.prototype.login = function(req, res, next, o) {
	this.redirect_uri = o.redirect_uri || this.redirect_uri;
	var url = this.oauth_url + qs.stringify({
		client_id: this.app_id,
		redirect_uri: this.redirect_uri,
		scope: o.scope || this.scope,
		state: o.state || this.state
	});
	return res.redirect(url);
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

Facebook.prototype.redirect = function(req, res, next) {
	if ('error' in req.query) {
		this._error = new Error(req.query.error);
		this._error.reason = req.query.error_reason;
		this._error.description = req.query.error_description.replace('+', ' ');
		return next(this._error);
	} else {
		this._code = req.query.code;
		var url = this.token_url + qs.stringify({
			client_id: this.app_id,
			redirect_uri: this.redirect_uri,
			client_secret: this.app_secret,
			code: this._code
		});
		var self = this;
		r(url, function(err, resp, body) {
			if (!err && resp.statusCode == 200) {
				var q = qs.parse(body);
				self._access_token = q.access_token;
				self._expires = q.expires;
				return next({access_token: self._access_token, expires: self._expires, code: self._code})
			} else if (resp.statusCode == 400) {
				var d = '';
				try { d = JSON.parse(body); }
				catch (e) { 
					self._error = new Error('failed to parse error code from Facebook');
					return next(self._error);
				}
				self._error = new Error(d.error.message);
				self._error.type = d.error.type;
				return next(self._error);
			}
		});
	}
}

Facebook.prototype.refresh = function() {

}

module.exports = Facebook;