exports.helper = {
	uuid: function() {
		function S4() {
		   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
		}
		return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
	},

	copy: function(src, dst) {
		dst = dst || {};
		if (typeof(src) === 'object') {
			for (i in src) {
				if(src.hasOwnProperty(i)) dst[i] = src[i];
			}
			return dst;
		} else return src;
	}
}