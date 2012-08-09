var r = require('request');
var c = require('cheerio');
var u = require('util');

function Zappos () {
	
}

Zappos.prototype.parse = function(url, cb) {
	var self = this;
	var o = {};
	if (typeof(url) === 'function') {
		cb = url;
		return cb (new Error('first argument must be a URL to parse'));
	}
	r(url, function(err, resp, body) {
		if (err) return cb(err);
		
		var $ = c.load(body);
		
		o.title = $('title').text();
		o.keywords = $("meta[name='keywords']").attr('content').split(',');
		o.metaDesc = $("meta[name='description']").attr('content');

		o.name = $('#productStage h1').text();
		o.sku = $('span#sku').text().match(/[^SKU ].+/ig).toString();
		o.prodId = $('form#prForm').find("input[name='productId']").attr('value');

		if ($('#productStage').find('#rating').length > 0) {
			o.rating = {}
			o.rating.star = $('#productStage').find('#rating a').children('span').attr('class').match(/[0-9]/ig).toString();
			o.rating.reviews = $('#productStage').find('#rating a').children('em').text().match(/[0-9]+/ig).toString();
		}

		o.image = $('#productStage').find('img#detailImage').attr('src');

		o.description = [];
		$('#productStage').find('#prdInfoText ul').children().each(function(i, el) {
			if ($(this).children('a#video-description').length === 0) o.description.push($(this).text());
		});
		
		o.price = {};
		o.prodAttributes = {};
		$('#productForm').find('form#prForm ul').children().each(function(i, el) {
			var id = $(this).attr('id');
			if (id) {
				if (id === 'priceSlot') {
					if ($(this).children('span.price').length > 0) {
						o.price.amount = $(this).children('span.price').text();
						o.price.sale = false;
					} else if ($(this).children('span.salePrice').length > 0) {
						o.price.amount = $(this).children('span.salePrice').text();
						o.price.sale = true;
					}
				}

				if ($(this).attr('id') === 'colors') {
					o.prodAttributes.colors = [];
					$(this).children('select').children().each(function(x, opt) {
						o.prodAttributes.colors.push({name: $(this).text(), id: $(this).attr('value'), selected: $(this).attr('selected') ? true : false});
					});
				}
			} else {
				if ($(this).children('label').attr('id') === 'labelsize') {
					o.prodAttributes.sizes = [];
					$(this).children('select').children().each(function(x, opt) {
						if ($(this).attr('value') !== '-1_size') o.prodAttributes.sizes.push({name: $(this).text(), id: $(this).attr('value')});
					});
				} else if ($(this).children('label').attr('id') === 'labelwidth') {
					o.prodAttributes.widths = {name: $(this).children('p').text(), id: $(this).children('input').attr('value')};
				}
			}
		});
		
		var initial_reviews = parseReviews($, $('#productReviews').children('.review'));

		if ($('#productReviews').find('.additionalReviewsButton').length > 0) {
			var href = $('#productReviews').find('.additionalReviewsButton').attr('href');
			r('http://zappos.com'+href, function(err2, status2, body2) {
				var x = c.load(body2);
				var more_reviews = parseReviews(x, x('.teethWhiteInner').children('.review'));

				o.reviews = initial_reviews.concat(more_reviews);

				return cb(null, o);
			});
		} else return cb(null, o);
	});
}

function parseReviews($, list) {
	var reviews = [];
	$(list).each(function(i, review) {
		var rev = {};
		rev.rating = {};
		rev.helpful = $(this).find('.reviewHelpful').children('span').text();
		var name = '';
		if ($(this).find('.reviewRatings').length > 0) {
			$(this).find('.reviewRatings').children('span.stars').each(function(x, s) {
				switch(x) {
					case 0: 
						name = 'overall';
						break;
					case 1:
						name = 'comfort';
						break;
					case 2:
						name = 'style';
						break;
				}
				rev.rating[name] = $(this).attr('class').split(' ')[1].match(/[0-9]$/).toString();
			});
		} else if ($(this).find('.productRatings').length > 0) {
			$(this).find('.productRatings').children('p').each(function(y, p) {
				var name = $(this).children('strong').text();
				var star = $(this).children('span').attr('class').split(' ')[1].match(/[0-9]$/).toString();
				rev.rating[name] = star;
			});
		}
		if ($(this).find('.reviewText').length > 0) rev.content = $(this).find('p.reviewSummary').text();
		else if ($(this).find('.reviewContent').length > 0) rev.content = $(this).find('.reviewContent').text();

		if ($(this).find('.productFeel').length > 0) {
			rev.feel = {};
			
			if ($(this).find('.productShoeSize').length > 0) rev.feel.shoeSize =  $(this).find('.productShoeSize').children('p.feelIndicator').attr('class').match(/[0-9]/ig).toString();
			if ($(this).find('.productShoeWidth').length > 0) rev.feel.shoeWidth = $(this).find('.productShoeWidth').children('p.feelIndicator').attr('class').match(/[0-9]/ig).toString();
			if ($(this).find('.productShoeArch').length > 0) rev.feel.shoeArch = $(this).find('.productShoeArch').children('p.feelIndicator').attr('class').match(/[0-9]/ig).toString();
		}
		if ($(this).find('li.reviewDate').length > 0) rev.created_on = $(this).find('li.reviewDate').text();
		else if ($(this).find('div.reviewDate').length > 0) rev.created_on = $(this).find('div.reviewDate').children('p').text();

		reviews.push(rev);
	});
	return reviews;
}

module.exports = exports = new Zappos();