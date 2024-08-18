

var moment = require('moment-timezone');

var dbg = require('debug')('server');
var util = require('../../bin/util.js');


exports.addRoutes = function(app,prefix)
{
    app.get(prefix, index);
};

function index( req, res )
{
    var params = {
    };
    console.log('home params:', params, req );
    res.render('home',params);
}

