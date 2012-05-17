//routes
var auth = require('../lib/auth').auth,  //handle authentication
	items = require('../lib/items').items,  //handle access to items posted
	profile = require('../lib/profiles').profiles,  //handle access to user profiles
	db = require('../lib/db').db,
	util = require('util'),
	cache = require('redis').createClient();

exports.index = function(req, res){
	if (req.isAuthenticated()) {		
		items.byFbId(req.session.fb.user.id, function(err, posts) {
			if (!err) {
				res.render('index', {locals: {posts: posts}});
			} else {
				res.render('error', {locals: {error: err}});
			}
		});
	} else {
		items.all(function(err, posts){
			if (!err) {
				res.render('index', {locals: {posts: posts}});
			} else {
				res.render('error', {locals: {error: err}});
			}
		});
	}
};

exports.auth = {
	facebook_cb: function(req, res, next) {
		if (req.isAuthenticated()) {		
			profile.create(req.session.fb.user, function(err2, doc) {
				if (!err2) {
					//id = profile_doc_id : fb_id : access_token
					cache.hset('sessions', req.sessionId, doc+':'+req.session.fb.access_token, function(err) {
						if (req._fb.return_uri) {
							var u = req._fb.return_uri
							req._fb.return_uri = null;
							res.redirect(u);
						} else res.redirect('/');
					});
/*					req.session.user = {
						profile_id: doc,
						access_token: req.session.fb.access_token
					};
*/
				}
			});
		}
	},
	fb_redirect: function(req, res, next) {
	},

	login: function(req, res) {
		res.render('login');
	},
	logout: function(req, res) {
		cache.hdel('sessions', req.sessionId);
		res.redirect('/auth/facebook/logout');
	},
	requiresAuth: function(req, res, next) {
		if (req.isAuthenticated()) return next();
		req._fb.return_uri = req.url;
		res.render('login_api', {layout: false});
	}
};

exports.register = function(req, res){
	res.render('register');
};

exports.v1 = {
	embed: function(req, res) {
		console.log("EMBED: ",req.query);
	},
	
	create: function(req, res) {
		cache.hget('sessions', req.sessionId, function(err, value) {
			var v = value.split(':');
			var l = {
				fb_id: v[1],
				profile_id: v[0],
				type: 'item',
				private: false,
				media: req.query.media,
				url: req.query.url,
				title: req.query.title,
				desc: req.query.description,
				is_video: req.query.is_video,
				via: req.query.via || ''
			};
			items.save(l, function(err, r){
				if (!err) {
					res.render('success', {layout: false});
				} else {
					res.render('error', {locals: {error: err}, layout: false});
				}
			});
		});
	},

	domains_info: function(req, res) {
		/* req.query
			url: original url of page being viewed by user
			callback: callback method for jsonp respons

			response:
			res.json({pinnable: true|false})
		*/
		console.log(req.url+" : "+req.query);
		res.header('Content-Type', 'application/json');
	  	res.header('Charset', 'utf-8');
	  	res.send(req.query.callback + '({"pinnable": true})');
	}
};
