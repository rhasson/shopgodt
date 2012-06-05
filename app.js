
/**
 * ShopGodt main application
 * v.0.0.1
 */

var express = require('express'),
    util = require('util'),
    app_config = require('./config/app_config').app_config,
    routes = require('./routes'),
    Facebook = require('./lib/fb_api'),
    db = require('./lib/db').db,
    RedisStore = require('connect-redis')(express);

var app = module.exports = express.createServer();

db.init(app_config.db);

var fb = new Facebook({
  app_id: app_config.fb.app_id,
  app_secret: app_config.fb.app_secret,
  redirect_uri: "http://codengage.com/auth/facebook/callback",
  scope: ['email', 'publish_actions', 'read_stream']
});

/* Server Configuration */
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'testing this stuff', store: new RedisStore}));
  app.use(express.methodOverride());
  app.use(fb.init());
  app.use(app.router);
  app.enable("jsonp callback");
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('local', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Basic Routes
app.get('/', routes.index);  //render a login page instead of index
app.get('/login', routes.auth.login);
app.get('/logout', fb.logout());
app.get('/register', routes.register);

/** Access API Routes **/
// item routes
app.get('/api/v1/item/preview', routes.auth.requiresAuth, routes.v1.item.preview, fb.getFriends());
app.post('/api/v1/item', routes.auth.requiresAuth, routes.v1.item.create);
app.get('/api/v1/item/:item_id', routes.get);
//question routes
app.post('/api/v1/ask/:item_id', routes.auth.requiresAuth, routes.v1.ask.create, fb.post(), routes.v1.notify.ask);
//utility routes
app.get('/api/v1/domains/info', routes.v1.domains_info);
app.get('/api/v1/util/embed', routes.v1.embed);

// Facebook connect Routes
app.get('/auth/facebook', fb.login(), routes.auth.fb_redirect);
app.get('/auth/facebook/callback', fb.redirect(), routes.auth.facebook_cb);
app.get('/auth/facebook/logout', fb.logout());


app.listen(app_config.server.port, app_config.server.host, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
