//routes
var auth = require('../lib/auth').auth;  //handle authentication
var items = require('../lib/items').items;  //handle access to items posted

exports.index = function(req, res){
	if (req.isAuthenticated()) {
		items.all({body: {key: req.user.id}}, function(err, posts) {
			console.log("ERROR: ", err);
			console.log("DATA: ", posts);

			if (!err) {
				res.render('index', {locals: {posts: posts}});
			} else {
				res.render('error', {locals: {error: err}});
			}
		});
	} else {
		items.all(function(err, posts){
					console.log("ERROR2: ", err);
					console.log("DATA2: ", posts);
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
console.log(profile);/*
		db.view({
			view: 'profiles/byFbId',
			body: {key: profile.id}
		}, function(err, doc) {
			if (err) return done(err);
			else if (doc.length  === 0) {
				db.save({body: profile}, function(err2, newDoc) {
					if (err2) return done(err2);
					else if (newDoc.ok) return done(null, newDoc.id+':'+newDoc.rev);
				});
			}
			else if (doc.length > 0) {
				db.update({body: profile}, function(err3, upDoc) {
					if (err3) return done(err3);
					else if (upDoc.ok) return done(null, upDoc.id+':'+upDoc.rev);
				});
			} else return done(new Error('Error with log in and registration process'));
		});*/
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
