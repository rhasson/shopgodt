//routes
var auth = require('../lib/auth').auth,  //handle authentication
//	items = require('../lib/items').items,  //handle access to items posted
//	profile = require('../lib/profiles').profiles,  //handle access to user profiles
	Access = require('../lib/access');
	db = require('../lib/db').db,
	util = require('util');
//	cache = require('redis').createClient();

var items = new Access('item');
var profiles = new Access('profile');
var questions = new Access('question');

exports.index = function(req, res){
	if (req.isAuthenticated()) {	
		items.view({view: 'byFbId', key: req.session.fb.user.id}, function(err, posts) {
			if (!err) {
				res.render('index', {locals: {user: req.fb.user.name, posts: posts}});
			} else {
				res.render('error', {locals: {user: 'Visitor', error: err}});
			}
		});
	} else {
		items.view({view: 'all'}, function(err, posts){
			if (!err) {
				res.render('index', {locals: {user: 'Visitor', posts: posts}});
			} else {
				res.render('error', {locals: {user: 'Visitor', error: err}});
			}
		});
	}
};

exports.auth = {
	facebook_cb: function(req, res, next) {
		if (req.isAuthenticated()) {		
			profiles.create(req.session.fb.user, function(err2, doc) {
				if (!err2) {
					//id = profile_doc_id : fb_id : access_token
					
					req.session.fb.profile_id = doc.doc_id;
					req.session.fb.fb_id = doc.fb_id;
//					cache.hset('sessions', req.sessionId, doc+':'+req.session.fb.access_token, function(err) {
					if (req.session.fb.return_uri) {
						var u = req.session.fb.return_uri
						req.session.fb.return_uri = null;
						res.redirect(u);
					} else res.redirect('/');
//					});
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
		res.render('login', {locals: {user: 'Visitor'}});
	},
	logout: function(req, res) {
		//cache.hdel('sessions', req.sessionId);
		req.session.destroy();
		res.redirect('/auth/facebook/logout');
	},
	requiresAuth: function(req, res, next) {
		if (req.isAuthenticated()) return next();
		req.session.fb.return_uri = req.url;
		res.render('login_api', {layout: false});
	}
};

exports.register = function(req, res){
	res.render('register', {locals: {user: 'Visitor'}});
};

exports.v1 = {
	embed: function(req, res) {
		console.log("EMBED: ",req.query);
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
	},

	item: {
		create: function(req, res) {
//			cache.hget('sessions', req.sessionId, function(err, value) {
//				var v = value.split(':');
				var l = {
					fb_id: req.session.fb.fb_id,//v[1],
					profile_id: req.session.fb.profile_id,//v[0],
					type: 'item',
					private: false,
					media: req.query.media.trim(),
					url: req.query.url,
					title: req.query.title,
					desc: req.query.description,
					is_video: req.query.is_video,
					via: req.query.via || ''
				};
				items.create(l, function(err, r){
					if (!err) {
						var friends = [];
						if (req.session.fb.friends) {
							req.session.fb.friends.forEach(function(i){
								friends.push(i.name);
							});
						}
						res.render('api_item_prev', {locals: {
							item: {
								id: r.id, 
								title: l.title, 
								media: l.media,
								friends: friends
							}}, layout: false});
					} else {
						res.render('error', {locals: {error: err}, layout: false});
					}
				});
//			});
		}
	}, 

	ask: {
		create: function(req, res) {
//			cache.hget('sessions', req.sessionId, function(err, value) {
//				var v = value.split(':');
				var l = {
					fb_id: req.session.fb.fb_id,//v[1],
					profile_id: req.session.fb.profile_id,//v[0],
					item_id: req.params.item_id,
					type: 'question',
					private: false,
					to: req.body.to,
					question: req.body.question
				};
				questions.create(l, function(err, r) {
					if (!err) {
						res.render('success', {layout: false});
					} else {
						res.render('error', {locals: {error: err}, layout: false});
					}
				});
//			});
		}
	}
};
