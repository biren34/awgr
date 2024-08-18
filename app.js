
var AUTO_QUERY_REFRESH_MS = 10*60*1000;

// Grrr node-pg and timezone dumbness
process.env.TZ = 'UTC';

var global_inc = require('./bin/global_inc.js');

var express = require('express');

var http = require('http');
var path = require('path');
var cookie_parser = require('cookie-parser')
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var morgan = require('morgan');

var api = require('./routes/api');
var pages = require('./routes/pages');

var config = require('./config.js')();
//var customer = require('./customer.js');


var app = express();

app.enable('trust proxy')


if( app.get('env') == 'dev')
{
    app.use(morgan('[:date] :method :url :status :res[content-length] - :response-time ms'));
}
else
{
    app.use(morgan(':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :response-time(ms) ":referrer" ":user-agent"'));
}

app.set('port', config.port );
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({limit: '50mb'}));

app.use(methodOverride());
app.use(cookie_parser());

var less_opts = {
    compiler: {
        sourceMap: true,
        sourceMapBasepath: 'static/css',
    },
};
//app.use(less_middleware('static',less_opts));

app.use(express.static(path.join(__dirname, 'static')));
//app.use( customer.checkSession );

app.use(throw_handler);
//app.use(customer.errorHandler(throw_handler));

var db = require('./bin/pg_db_async.js');
console.log(db);
db.init( config.db );

app.use(function (req, res, next) 
{
    req.db = db; //todo eliminate this, once all direct db calls are removed from controllers
    next();
});

api.addRoutes(app,'/api/1');
pages.addRoutes(app,'');

app.get('/status_check',function(req,res) { res.status( 200 ).send(); } );



http.createServer(app).listen(app.get('port'), function()
{
    console.log("Express server listening on port:",app.get('port'));
});

function throw_handler(err,req,res,next)
{
    if( !err )
    {
        return express.errorHandler()(err,req,res,next);
    }
    else
    {
        if( err.code && err.body && typeof err.code === 'number' )
        {
            res.header("Cache-Control", "no-cache, no-store, must-revalidate");
            res.header("Content-Type","text/plain");
            res.status(err.code).send(err.body.toString());
        }
        else
        {
            return errorHandler()(err,req,res,next);
        }
    }
}

