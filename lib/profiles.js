var db = require('./db').db,
	helper = require('./helper.js').helper,
	util = require('util');		

exports.profiles = {
	create: function(user, cb) {
		/* 1. check if fb_id is in local db
		   2. if not create a new document with profile detail and return doc_id/rev
		   3. if it is, update db with profile detail and return doc_id/rev
		   4. call done() with doc_id/rev
		*/
		var p = {
			type: 'profile',
			fb_id: user.id,
		    name: user.name,
		    first_name: user.first_name,
		    last_name: user.last_name,
		    fb_link: user.link,
		    birthday: user.birthday,
		    location: user.location,
		    gender: user.gender,
		    relationship_status: user.relationship_status,
		    email: user.email,
		    timezone: user.timezone,
		    locale: user.locale,
		    fb_updated_time: user.updated_time
		};

		db.view({
			view: 'profiles/byFbId',
			body: {key: p.fb_id}
		}, function(err, doc) {
			if (err) return cb(err);
			else if (doc.length  === 0) {
				db.save({body: p}, function(err2, newDoc) {
					if (err2) return cb(err2);
					else if (newDoc.ok) return cb(null, newDoc.id+':'+p.fb_id);
				});
			}
			else if (doc.length > 0) {
				db.update({id: doc[0].id, body: p}, function(err3, upDoc) {
					if (err3) return done(err3);
					else if (upDoc.ok) return cb(null, upDoc.id+':'+p.fb_id);
				});
			} else return cb(new Error('Error with log in and registration process'));
		});
	},

	get: function(id, cb) {
		if (typeof(id) === 'object') {
			id = id.fbId ? id.fbId : id.userId ? id.userId : null;
		}
	}
}
