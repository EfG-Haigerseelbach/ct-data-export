var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
const exphbs  = require('express-handlebars');
const bodyParser = require('body-parser');
const expressSession = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
var config = require('config');

var indexRouter = require('./routes/index');

var app = express();

// view engine setup
//app.engine('handlebars', exphbs({defaultLayout: 'main'}));
//app.set('view engine', 'handlebars');
app.engine('handlebars', exphbs.engine({ extname: '.hbs', defaultLayout: "main"}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));


app.use(logger('dev'));
//app.use(express.json());
app.use(bodyParser.json());
//app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());



/**
 * --------------- Session Management ---------------
 */
app.use(expressSession({
  secret: 'secret', // TODO use another secret
  resave: false,
  saveUninitialized: true
}));
// init passport on every route call
app.use(passport.initialize());
// allow passport to use "express-session"
app.use(passport.session());

app.use("/", express.static(path.join(__dirname, 'public')));
app.use(favicon(__dirname + '/public/favicon.ico'));

// Serve cronstrue 
app.use("/cronstrue", express.static(path.join(__dirname, 'node_modules/cronstrue/dist')));

app.use('/', indexRouter);

// The "authUser" is a function that we will define later will contain the steps to authenticate a user, and will return the "authenticated user".
passport.use(new LocalStrategy(authUser));

function authUser(user, password, done) {
  console.log("authUser");
  if(password == config.get('adminToken')) {
    let authenticated_user = { id: 1, name: "Admin"};
    return done(null, authenticated_user); //done(error, user);
  } else {
    return done(null, false, { message: "Invalid admin token"});
  }
}

passport.serializeUser( (userObj, done) => {
  done(null, userObj)
});

/*
WHAT DOES SERIALIZE USER MEAN?
1. "express-session" creates a "req.session" object, when it is invoked via app.use(session({..}))
2. "passport" then adds an additional object "req.session.passport" to this "req.session".
3. All the serializeUser() function does is,
receives the "authenticated user" object from the "Strategy" framework, and attach the authenticated user to "req.session.passport.user.{..}"
In above case we receive {id: 123, name: "Kyle"} from the done() in the authUser function in the Strategy framework, 
so this will be attached as 
req.session.passport.user.{id: 123, name: "Kyle"}

3. So in effect during "serializeUser", the PassportJS library adds the authenticated user to end of the "req.session.passport" object.
This is what is meant by serialization.
This allows the authenticated user to be "attached" to a unique session. 
This is why PassportJS library is used, as it abstracts this away and directly maintains authenticated users for each session within the "req.session.passport.user.{..}"
*/

passport.deserializeUser((userObj, done) => {
  done (null, userObj )
});

/*
WHAT DOES DE SERIALIZE USER MEAN?
1. Passport JS conveniently populates the "userObj" value in the deserializeUser() with the object attached at the end of "req.session.passport.user.{..}"
2. When the done (null, user) function is called in the deserializeUser(), Passport JS takes this last object attached to "req.session.passport.user.{..}", and attaches it to "req.user" i.e "req.user.{..}"
In our case, since after calling the done() in "serializeUser" we had req.session.passport.user.{id: 123, name: "Kyle"}, 
calling the done() in the "deserializeUser" will take that last object that was attached to req.session.passport.user.{..} and attach to req.user.{..} 
i.e. req.user.{id: 123, name: "Kyle"}
3. So "req.user" will contain the authenticated user object for that session, and you can use it in any of the routes in the Node JS app. 
eg. 
app.get("/dashboard", (req, res) => {
res.render("dashboard.ejs", {name: req.user.name})
})
*/


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  //console.error(req);
  var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  console.error('Did not find any handler for request with URL: '+fullUrl);
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  console.log(err);
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
