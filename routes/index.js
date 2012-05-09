//routes
var auth = require('../lib/auth').auth,  //handle authentication
	items = require('../lib/items').items,  //handle access to items posted
	db = require('../lib/db').db;

exports.index = function(req, res){
	if (req.isAuthenticated()) {
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
	facebook_cb: function(req, res) {
		res.redirect('/');
	},
	fb_redirect: function(req, res) {
		/* this should never be called since request will be redirected to facebook for login */
	},
	passport_cb: function(accessToken, refreshToken, profile, done) {
		/* 1. check if fb_id is in local db
		   2. if not create a new document with profile detail and return doc_id/rev
		   3. if it is, update db with profile detail and return doc_id/rev
		   4. call done() with doc_id/rev
		*/
		profile = profile._json;
		var p = {
			type: 'profile',
			fb_id: profile.id,
		    name: profile.name,
		    first_name: profile.first_name,
		    last_name: profile.last_name,
		    fb_link: profile.link,
		    birthday: profile.birthday,
		    location: profile.location,
		    gender: profile.gender,
		    relationship_status: profile.relationship_status,
		    email: profile.email,
		    timezone: profile.timezone,
		    locale: profile.locale,
		    fb_updated_time: profile.updated_time
		};

		db.view({
			view: 'profiles/byFbId',
			body: {key: p.fb_id}
		}, function(err, doc) {
			if (err) return done(err);
			else if (doc.length  === 0) {
				db.save({body: p}, function(err2, newDoc) {
					if (err2) return done(err2);
					else if (newDoc.ok) return done(null, newDoc.id+':'+p.fb_id);
				});
			}
			else if (doc.length > 0) {
				db.update({id: doc[0].id, body: p}, function(err3, upDoc) {
					if (err3) return done(err3);
					else if (upDoc.ok) return done(null, upDoc.id+':'+p.fb_id);
				});
			} else return done(new Error('Error with log in and registration process'));
		});
	},
	login: function(req, res) {
		res.render('login');
	},
	logout: function(req, res) {
		req.logout();
		res.redirect('/');
	},
	requiresAuth: function(req, res, next) {
		if (req.isAuthenticated()) return next();
		res.redirect('login');
	}
};

exports.register = function(req, res){
	res.render('register');
};

exports.v1 = {
	embed: function(req, res) {
		console.log(req.query);
	},
	
	create: function(req, res) {
		var l = {
			media: req.query.media,
			url: req.query.url,
			title: req.query.title,
			desc: req.query.description,
			is_video: req.query.is_video,
			via: req.query.via || ''
		};
		items.save(l, function(err, r){
			
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
