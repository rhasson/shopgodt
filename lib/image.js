var gm = require('gm');
var fs = require('fs');
var r = require('request');


function Image() {
	var this.tmp_path = __dirname + '/tmp/';
	var this.img_path = __dirname + '/public/img/user_thumbs/';
}

Image.prototype.resize(url, w, h, cb) {
	var self = this;
	var name = Math.floor(Math.random()*9E9).toString();

	var file = fs.createWriteStream(self.tmp_path+name);
	file.on('close', function() {
        gm(fs.createReadStream(self.tmp_path+name))
        .resize(w, h)
        .stream(function(err, stdout, stderr) {
        	var ws = fs.createWriteStream(self.img_path+name+'-thumb.png');
//            stdout.pipe(ws);
         	
	        var i = [];
			stderr.on('error', function(e) {
	            console.log(e);
	            return cb(e);
	        });

	        stdout.on('data', function(data) {
	        	i.push(data);
	        });

	        stdout.on('close', function() {
	            var img = Buffer.concat(i);
	            ws.write(img);
	            //ws.write(img.toString('base64'), 'base64');
	            ws.end();
	            //var img_src = "data:image/png;base64,"+img.toString('base64')
	            fs.unlink(self.tmp_path+name);
	            return cb(null, name+'-thumb.png');
	        });
		});
		r(url).pipe(file);
	});
};


module.exports = exports = new Image();