exports.auth = {
	authorize: function(params, cb) {
		this._getUser(params.login, function(err, user) {
			if (!err) {
				if (user.login === params.login && user.password === params.password) {
					cb(null, user.id);
				} else {
					var e = new Error('authorization failed');
					e.code = 2;
					cb(e);
				}
			}
		});
	}, 

	_getUser: function(username, cb) {
		users.forEach(function(user) {
			if (user.login === username) return cb(null, user);
			else return cb(new Error('username not found'));
		});
	}
};
