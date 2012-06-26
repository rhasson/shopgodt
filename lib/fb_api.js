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

Facebook.prototype.login = function(o) {
	var self = this;
	return function login(req, res, next) {
		var s = o ? o.scope : self.scope;
		if (util.isArray(s)) s = s.join();
		self.redirect_uri = o ? o.redirect_uri : self.redirect_uri;
		var url = self.oauth_url + qs.stringify({
			client_id: self.app_id,
			redirect_uri: self.redirect_uri,
			scope: s,
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
			cache.hdel('friends', req.session.fb.fb_id, function(err){
				if (err) console.log('REDIS DEL ERROR: ', err);
			});
			req.session.destroy(function(err2) {
				if (err2) console.log('failed to destroy session', err2)
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

Facebook.prototype.redirect = function(o) {
	var self = this;
	//TODO: add support for success and failure redirects or callbacks
	return function redirect (req, res, next) {
		self._error = null;
		if (req.query.hasOwnProperty('error')) {
			self._error = new Error(req.query.error);
			self._error.reason = req.query.error_reason;
			self._error.description = req.query.error_description.replace('+', ' ');
			req.session.fb = self._error;
			next();
		} else {
			var q = '';
			req.session.fb.code = req.query.code;
			var url = self.token_url + qs.stringify({
				client_id: self.app_id,
				redirect_uri: self.redirect_uri,
				client_secret: self.app_secret,
				code: req.session.fb.code
			});
			r(url, function(err, resp, body) {
				if (!err && resp.statusCode === 200) {
					q = qs.parse(body);
					req.session.fb.access_token = q.access_token;
					req.session.fb.expires = q.expires;
					self.profile(req.session.fb.access_token, function(err2, user) {
						if (!err2 ) {
							req.session.fb.expires = Date.now() + (req.session.fb.expires * 1000);
							req.session.fb.user = user;
							next();
						} else {
							self._error = req.session.fb = new Error(err2);
							next();
						}
					});
				} else {//if (resp.statusCode === 400) {
					var d = '';
					try { d = JSON.parse(body); }
					catch (e) { 
						self._error = new Error('failed to parse error code from Facebook');
						req.session.fb = self._error;
						next();
					}
					console.log('FB ERROR: ', d);
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
		var url = self.graph + 'me/friends?' + qs.stringify({limit: 1000, access_token: req.session.fb.access_token});
		r(url, function(err, resp, body) {
			if (!err && resp.statusCode === 200) {
				cache.hset('friends', req.session.fb.fb_id, body);
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
						var url = self.graph + path.join(q.to_id, 'feed');
						var body = qs.stringify({
							access_token: req.session.fb.access_token,
							app_id: self.app_id,
							picture: l.img_src,  //picture: l.media,
							caption: 'ShopGodt Question',
							message: q.question,
							type: 'link',
							link: 'http://codengage.com/item/'+l.item_id
						});
						url += '?' + body;
						var d = '';
						r.post({url: url}, function(err, resp, b) {
							try { d = JSON.parse(b); }
							catch (e) {
								req.session.fb.wall_post = new Error('FB post response parse error');
								next();
							}
							if (!err && !d.error && resp.statusCode === 200) {
								req.session.fb.wall_post = d.id;
								next();
							} else if (d.error) {
								if (d.error.type === 'OAuthException') {
									switch (d.error.code) {
								 		case 190: 
								 			if (d.error.error_subcode === 467) {
												req.session.fb = {};
												req.session.return_uri = req.url;
												res.render('login_api', {layout: false});
											}
										case 200:
											//user didn't authorize the application to post
											req.session.fb.wall_post = new Error(d.error.message);
											next();
									}
								} else {
									req.session.fb.wall_post = new Error(d.error.message);
									next();
								}
							} else {
								req.session.fb.wall_post = new Error(err);
								next();
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
