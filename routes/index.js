//routes
var auth = require('../lib/auth').auth,  //handle authentication
	items = require('../lib/items').items,  //handle access to items posted
	profile = require('../lib/profiles').profiles,  //handle access to user profiles
	db = require('../lib/db').db,
	util = require('util');

var cache = {};

exports.index = function(req, res){
	if (req.fb.isAuthenticated()) {
		
		var id = req.user.split(':')[1];
		items.byFbId(id, function(err, posts) {
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
		var fb = req.session.fb.instance;
		if (fb.isAuthenticated(req)) {
			fb.profile(req.session.fb.access_token, function(err, user) {
				if (!err) {
					profile.create(user, function(err2, doc) {
						if (!err2) {
							cache[req.sessionId] = {
								id: doc,
								access_token: req.session.fb.access_token
							};
							res.redirect('/')
						}
					});

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
		req.logout();
		res.redirect('/');
	},
	requiresAuth: function(req, res, next) {
		if (req.fb.isAuthenticated()) return next();
		res.render('login_api', {locals: {}, layout: false});
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
		var id = req.user.split(':');
		var l = {
			fb_id: id[1],
			profile_id: id[0],
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
				res.render('success', {locals: {posts: posts}, layout: false});
			} else {
				res.render('error', {locals: {error: err}, layout: false});
			}
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
