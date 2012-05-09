exports.register = {
	register: function (user, cb) {
		var self = this;
		self._userExists(user, function(err, data) {
			if (!err) {
				if (data) return cb(new Error('user already exists'));
				else {
					self._validateUser(user, function(err2, valid) {
						if (!err) {
							if (!valid) {  //if validation return null it means no errors, otherwise an error array
								self._saveUser(user, function(err3, u) {
									if (!err3) return cb(null, u);
									else return (err3);
								});
							}
						} else return cb(err2);
					});
				}
			} else return cb(err);
		});
	}, 

	_userExists: function(user, cb) {
		return cb(null, false);
	}, 

	_saveUser: function(user, cb) {
			user.id = //create a random string
			users.push(user);
			var data = JSON.stringify(users);
			var path = process.cwd() + '/config/users';
			fs.fileExistsSync(path, function(e) {
				
			})
			fs.writeFile(process.cwd() + '/config/users', data);
	}, 

	_validateUser: function(user, cb) {
		return cb(null, null);
	}
};