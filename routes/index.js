//routes
var auth = require('../lib/auth').auth,  //handle authentication
	db = require('../lib/db').db,
	util = require('util'),
	app_config = require('../config/app_config').app_config,
	Access = require('../lib/access'),
	accessext = require('../lib/accessext.js'),
	cache = require('redis').createClient(),
	path = require('path'),
	Facebook = require('../lib/fb_api'),
	scraper = require('../lib/scraper'),
	async = require('async'),

	DOMAIN = 'http://codengage.com',
	THUMB_PATH = '/img/user_thumbs',

	items = new Access('item'),
	profiles = new Access('profile'),
	questions = new Access('question'),

	fb = new Facebook({
	  app_id: app_config.fb.app_id,
	  app_secret: app_config.fb.app_secret,
	  redirect_uri: app_config.fb.redirect_uri,
	  scope: app_config.fb.scope
	});

scraper.init();

exports.index = function(req, res){
	if (req.isAuthenticated()) {	
		items.view({view: 'byFbIdShared', key: req.session.fb.user.id}, function(err, posts) {
			if (!err) {
				res.render('index', {locals: {user: req.session.fb.user.name, id: req.session.fb.fb_id, posts: posts}});
			} else {
				res.render('error', {locals: {user: 'Visitor', id: null, error: err}});
			}
		});
	} else {
		items.view({view: 'allNotShared'}, function(err, posts){
			if (!err) {
				res.render('index', {locals: {user: 'Visitor', posts: posts}});
			} else {
				res.render('error', {locals: {user: 'Visitor', id: null, error: err}});
			}
		});
	}
};

exports.auth = {
	facebook_cb: function(req, res, next) {
		if (!(req.session.fb instanceof Error)) {
			console.log('CALLBACK: ', req.session.fb.profile_id);
			if (!req.session.fb.profile_id) {
				profiles.create(req.session.fb.user, function(err2, doc) {
					if (!err2) {					
						req.session.fb.profile_id = doc.id;
						req.session.fb.fb_id = doc.fb_id;
						if (req.session.return_uri) {
							var u = req.session.return_uri
							req.session.return_uri = null;
							res.redirect(u);
						} else res.redirect('/');
					}
				});
			} else {
				if (req.session.return_uri) {
					var u = req.session.return_uri
					req.session.return_uri = null;
					res.redirect(u);
				} else res.redirect('/');
			}
		}
	},
	fb_redirect: function(req, res, next) {
		fb.redirect(req, function(err, user) {
			if (!err && user) next();
		});
	},

	login: function(req, res) {
		res.render('login', {locals: {user: 'Visitor'}});
	},
	fb_login: function(req, res) {
		fb.login(function(err, url) {
			console.log('URL: ', url);
			if (!err) res.redirect(url);
		});
	},
	logout: function(req, res) {
		//fb.logout(req, opt, cb)
		fb.logout(req, function(err, url) {
			if (!err) res.redirect(url);
			else res.render('error', {locals: {user: 'Visitor', error: err}});
		});
		//res.redirect('/auth/facebook/logout');
	},
	requiresAuth: function(req, res, next) {
		if (req.isAuthenticated()) next();
		else {
			req.session.return_uri = req.url;
			res.render('login_api', {layout: false});
		}
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
		var info = scraper.getIdFromUrl(req.url);
		console.log('INFO: ',info);
		req.session.fb._info = info;
		res.header('Content-Type', 'application/json');
	  	res.header('Charset', 'utf-8');
	  	res.send(req.query.callback + '({"pinnable": true})');
	},

	item: {
		preview: function(req, res, next) {
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
			console.log('IN HERE: ', req.session.fb.fb_id);
			cache.hset('pins', req.session.fb.fb_id, JSON.stringify(l));
			res.render('api_item_prev', {locals: { item: { media: l.media }	}, layout: false});
			fb.getFriends(req);
		},

		create: function(req, res, next) {
			cache.hget('pins', req.session.fb.fb_id, function(e, data) {
				if (!e) {
					var l = JSON.parse(data);
					l.category = req.body.category;
					l.tags = req.body.tags || '';

					var image = require('../lib/image');
					image.resize(l.media, 260, 180, function(re_err, re_img){
						l.img_src = path.join(THUMB_PATH, re_img);
						if (req.body.next === 'share') l.shared = true;
						else l.shared = false;
						items.create(l, function(err, r){
							if (!err && r.ok) {
								l.item_id = r.id;
								cache.hset('pins', req.session.fb.fb_id, JSON.stringify(l));
								var f = [], d = '';
								var friends = '';
								cache.hget('friends', req.session.fb.fb_id, function(err2,body) {
									if (!err2 && body) {
										d = JSON.parse(body).data;
										d.forEach(function(i){
											f.push(i.name); 
										});
										friends = JSON.stringify(f);
									}
									if (req.body.next === 'share') {
										image = null;
										res.render('api_item_ask', {locals: {
											item: {
												id: r.id, 
												title: l.title, 
												media: l.media,
												friends: friends
											}}, layout: false});
										next();
									} else {
										image = null;
										res.render('success', {layout: false});
										next();
									}
								});
							} else {
								image = null;
								res.render('error', {locals: {error: err}, layout: false});
							}
						});
					});
				}
			});
		},

		get: function(req, res, next) {
			var user = 'Visitor';
			var prodItem = {};
			async.waterfall([
				function(cb) {
					items.get(req.params.item_id, function(err, item) {
						if (!err) {
							if (req.session.fb && req.session.fb.user) user = req.session.fb.user.name;
							prodItem.item = item;
							cb(null, item);
						} else cb(err);
					});
				},
				function(item, cb) {
					if (item.question_id) {
						questions.get(item.question_id, function(err, question) {
							if (!err) {
								prodItem.question = question;
								cb(null, question, item);
							} else cb(err);
						});
					} else return cb(null, {}, item)
				},
				function(question, item, cb) {
					if (req.session.fb && Object.keys(req.session.fb).length && Object.keys(question).length) {
						if (item.fb_id === req.session.fb.fb_id) {
							fb.getComments(req, question.fb_post_id, function(err, c) {
								if ((!err || !err.error) && c) {
									console.log('COMMENTS: ', c);
									prodItem.question.comments = c;
									cb(null, item);
								} else cb(err);
							});
						}
					} else { 
						prodItem.question = { comments: [] };
						cb(null, item);
					}
				},
				function(item, cb) {
					accessext.getPrices(item.parsed_data.name, function(err, prices) {
						if (!err) {
							prodItem.prices = prices;
							cb(null, item);
						} else cb(err);
					});
				}
			], function(err, result) {
				console.log('WATERFALL: ', err, prodItem);
				if (!err && result) {
					res.render('item', {locals: {
						user: user,
						id: prodItem.item.fb_id,
						item: prodItem.item,
						question: prodItem.question,
						prices: prodItem.prices,
						comments:  prodItem.comments}
					});
				} else {
					res.render('error', {locals: {user: user, id: null, error: err}});
				}
			});
		},

		scrape: function(req, res, next) {
			cache.hget('pins', req.session.fb.fb_id, function(err, pin) {
				var info = req.session.fb._info,
					u = '';

				if (!err && pin !== null) {
					u = JSON.parse(pin);
					accessext.getProductDetails(info, function(e, data) {
						if (!e) {
							u.parsed_data = data;
							var params = {
								id: u.item_id,
								body: u
							};
							items.update(params, function(err2, doc){
								//if (u.parsed_data.reviews) delete u.parsed_data.reviews;
								if (!err2 && doc.ok) cache.hset('pins', req.session.fb.fb_id, JSON.stringify(u));
							});
						} else console.log('PRODUCT API: ', e);
					});
				}

/*				var u  = '';

				if (!err && pin !== null) {
					u = JSON.parse(pin);
					if (scraper.isReady()) {
						_scrape(u.url, function(e, d) {
							var params = null;
							if (!e) {
								u.parsed_data = d;
								params = {
									id: u.item_id,
									body: u
								};
								items.update(params, function(err2, doc){
									if (u.parsed_data.reviews) delete u.parsed_data.reviews;
									if (!err2 && doc.ok) cache.hset('pins', req.session.fb.fb_id, JSON.stringify(u));
								});
							} else console.log('_SCRAPE ERR: ', e);
						});
					} else {
						scraper.on('ready', function(count) {
							_scrape(u.url, function(e, d) {
								if (!e) {
									u.parsed_data = d
									params = {
										id: u.item_id,
										body: u
									};
									items.update(params, function(err2, doc){
										if (u.parsed_data.reviews) delete u.parsed_data.reviews;
										if (!err2 && doc.ok) cache.hset('pins', req.session.fb.fb_id, JSON.stringify(u));
									});
								}
							});
						});
						scraper.init();
					}
				}
*/
			});
/*
			function _scrape(url, cb) {
				scraper.create(url, function(err, child) {
					var data = null;
					console.log('SCRAPER CREATE: ', err);
					if (!err) {
                        child.stderr.once('data', function(e) {
                        	console.log('SCRAPER ERROR: ', e.toString());
                        	return cb(e);
                        });
                        child.once('msg', function(d) {
                        	console.log('SCRAPER DATA: ', d);
                        	var z = JSON.parse(d);
                        	return cb(null, z);
                        });
                        child.once('error', function(e) {
                        	console.log('CHILD ERROR: ', e);
                        	return cb(e);
                        });
					}
				});
			}
*/
		}	
	}, 

	ask: {
		create: function(req, res, next) {
			var l = {
				fb_id: req.session.fb.fb_id,
				profile_id: req.session.fb.profile_id,
				item_id: req.params.item_id,
				type: 'question',
				private: false,
				to: req.body.to,
				question: req.body.question
			};
			var friends = null;
			var ret = false;
			
			cache.hget('friends', req.session.fb.fb_id, function(err, body) {
				if (body) {
					friends = JSON.parse(body).data;
					for (var x=0, y, len = friends.length; x < len; x++) {
						y = friends[x];
						if (y.name === l.to) {
							l.to_id = y.id;
							break;
						}
					}
				}

				fb.post(req, l, function(e, post_id) {
					if (!e) {
						l.fb_post_id = post_id;
						//req.session.fb.wall_post = post_id;
					} else if (e instanceof Error) {
						console.log('Failed to post question to FB');
					} else {
						if (e.error.type === 'OAuthException') {
							switch (e.error.code) {
						 		case 190: 
						 			if (e.error.error_subcode === 467) {
										req.session.fb = {};
										req.session.return_uri = req.url;
										ret = true;
									}
								case 200:
									//user didn't authorize the application to post
									//req.session.fb.wall_post = new Error(e.error.message);
							}
						} else {
							//req.session.fb.wall_post = new Error(e.error.message);
						}
					}
					questions.create(l, function(err, r) {
						var params;
						if (!err && r.ok) {
							l.question_id = r.id;
							items.get(l.item_id, function(err2, item) {
								if (!err2) {
									params = {
										id: l.item_id,
										body: {question_id: l.question_id}
									}
									items.update(params, function(e, doc) {
										//if (!e && doc.ok)
									});
								}
							})
							cache.hset('questions', req.session.fb.fb_id, JSON.stringify(l));
							if (ret) {
								res.render('login_api', {layout: false});
								ret = false
							} else res.render('success', {layout: false});
						} else {
							res.render('error', {locals: {error: err}, layout: false});
						}
					});
				});
			});
		}
	},

	notify: {
		ask: function(req, res, next) {
			/*
			if (!(req.session.fb.wall_post instanceof Error)) {
				cache.hget('questions', req.session.fb.fb_id, function(err, data) {
					if (!err) {
						var d = JSON.parse(data);
						res.render('api_item_notify', {locals: {item_id: d.item_id, question_id: d.question_id}, layout: false});
					}
				});
			} else {
				res.render('success', {layout: false});
			}
			
			cache.hget('questions', req.session.fb.fb_id, function(err, data) {
				if (!err && data) {
					var q = JSON.parse(data);
					if (req.session.fb.wall_post instanceof Error) {
						q.fb_post_id = null;
					} else {
						q.fb_post_id = req.session.fb.wall_post;
					}
					questions.update({id: q.question_id, body: q}, function(e, doc) {
						if (!e) {
							if (q.fb_post_id) {
								res.render('success', {layout: false});
								cache.hset('questions', req.session.fb.fb_id, JSON.stringify(q));
							}
							else res.render('error', {locals: {error: req.session.fb.wall_post.message}, layout: false});
						}
					});
				}
			}); */
		}
	}
};
