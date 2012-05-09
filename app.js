
/**
 * Module dependencies.
 */

var express = require('express'),
    util = require('util'),
    app_config = require('./config/app_config').app_config,
    routes = require('./routes'),
    passport = require('passport'),
    db = require('./lib/db').db,
    FacebookStrategy = require('passport-facebook').Strategy;

var app = module.exports = express.createServer();

console.log(app_config)
db.init(app_config.db);

/* Passport and Facebook Connect Configuration */

//handles serialization to store session state
passport.serializeUser(function(user, done) {
    db.save({body: user})

  cache.set(user, function(err, id){
    if (!err) done(null, id);
    else done(err);
  });
});

//handles deserialization to retreive session state
passport.deserializeUser(function(id, done) {
  cache.get(id, function(err, user) {
    if(!err) done(null, user);
    else done(err);
  });
});

passport.use(new FacebookStrategy({
    clientID: app_config.fb.app_id,
    clientSecret: app_config.fb.app_secret,
    callbackURL: "http://codengage.com/auth/facebook/callback"
  }, routes.auth.passport_cb));

/* Server Configuration */
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'testing this stuff'}));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
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
app.get('/logout', routes.auth.logout);
app.get('/register', routes.register);

// Access API Routes
app.get('/api/v1/item/create', routes.auth.requiresAuth, routes.v1.create);
app.get('/api/v1/domains/info', routes.v1.domains_info);
app.get('/api/v1/util/embed', routes.v1.embed);

// Facebook connect Routes
app.get('/auth/facebook', 
        passport.authenticate('facebook', {scope: ['email']}),
        routes.auth.fb_redirect);
app.get('/auth/facebook/callback', 
        passport.authenticate('facebook', {failureRedirect: '/login?error='+encodeURIComponent("Facebook login failed")}),
        routes.auth.facebook_cb);


app.listen(app_config.server.port, app_config.server.host, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
