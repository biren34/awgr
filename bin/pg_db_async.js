
var fs = require('fs');
var pg = require('pg');
var dbg = require('debug')('db');
var util = require('./util.js');

var TIMEOUT_MS = 30*1000;

var db_config;
var db_pool;

exports.init = init;
exports.end = end;
exports.escape = escape;

exports.startTransaction = startTransaction;
exports.query = query; 
exports.rollback = rollback;
exports.commit = commit;

exports._release = null;

function init( db_config )
{
    dbg('pg_db init');
    db_config.multipleStatements = true;
    db_config.timezone = 'UTC';
    db_config.debug = false;

    var credentials = JSON.parse( fs.readFileSync( db_config.credentials_file, 'utf8') );
    db_config.user = credentials.user,
    db_config.password = credentials.password;
    db_config.idleTimeoutMillis = 0;
    db_config.connectionTimeoutMillis = 0;

    exports.db_pool = db_pool = new pg.Pool(db_config);
    
}

function end()
{
    dbg('db ends');
    if( exports._release )
    {
        exports._release();
    }

    db_pool.end();
}

async function startTransaction( connection )
{
    if( connection )
    {
        return [ null, connection ];
    }
    let err;
    [ err, connection ] = await _getConnection();
    if( err ) { return [ err ]; }

    let sql = 'START TRANSACTION;';
    [ err ] = await _query( connection, sql );
    if( err )
    {
        _release( connection );
        return [ util.createError( err, 500, 'Start transaction error' ) ]
    }
    return [ null, connection ];
}

async function query( sql, options = { values: [], connection: null } )
{
    let connection = options.connection, err;
    if( !connection )
    {
        [ err, connection ] = await _getConnection();
        if( err ) { return [ util.createError( err, 500, 'Error getting database connection' ) ]; }
    }

    [ err, results ] = await _query( connection, sql, options );
    if( err )
    {
        if( options.connection )
        {
            [ rollback_err ] = await rollback( options.connection );
        }
        return [ err ];
    }

    //If connection is passed in, will leave the connection alive--otherwise, just one off this query and release the connection
    if( !options.connection )
    {
        _release( connection );
    }

    return [ null, results ];
}

async function rollback( connection )
{
    if( !connection )
    {
        return [ null ];
    }

    let sql = 'ROLLBACK;';
    let [ err ] = await _query( connection, sql );
    if( err ) { [ util.createError( err, 500, 'Rollback error' ) ]; }
    
    [ err ] = _release( connection );
    if( err ) { [ util.createError( err, 500, 'Error releasing connection' ) ]; }

    return [ null ];
}

async function commit( connection )
{
    let sql = 'COMMIT;';
    let [ err ] = await _query( connection, sql );
    _release( connection );
    if( err ) { return [ util.createError( err, 500, 'Commit error' ) ] }
    return [];
}

async function _query( connection, sql, options = {} )
{
    const values = options.values || [];
    let p = new Promise( ( resolve, reject ) => {
        try {
            connection.query(sql, values, function( err, results )
            {
                if( err ) { return reject( err ); }
                return resolve( results );
            });        
        } catch( err )
        {
            return reject( err );
        }
    })
    .then( ( results ) => [ null, results ] )
    .catch( ( err ) => {
        return [ util.createError( err, 500, 'sql that failed: ' + sql ), null ];
    });
    return p;
}

async function _getConnection()
{
    let p = new Promise( ( resolve, reject ) => {
        try {
            db_pool.connect(function(err,connection,releaseFunc)
            {
                if( err )
                {
                    return reject( err );
                }
                exports._release = releaseFunc;
                return resolve( connection );
            });
        } catch( err )
        {
            return reject( err );
        }
    })
    .then( ( connection ) => [ null, connection ] )
    .catch( ( err ) => [ util.createError( err, 500, 'Error getting database connection' ), null ] );
    return p;
}

function _release(connection)
{
    if( !exports._release )
    {
        return;
    }
    try
    {
        exports._release();
    }
    catch( e )
    {
        return [ util.createError( e, 500, 'Error releasing connection' ) ];
    }
    return [ null ];
}

function locked_function(lock_name,func,all_done)
{
    var connection = false;
    async.series([
    function(done)
    {
        var sql = "SELECT GET_LOCK(?,0) AS lock_result";
        queryFromPoolWithConnection(sql,lock_name,function(err,results,new_conn)
        {
            connection = new_conn;
            if( !err )
            {
                if( results.length == 0 )
                {
                    err = 'lock_failed'
                }
                else if( results[0].lock_result == 0 )
                {
                    err = 'lock_contend';
                }
                else if( results[0].lock_result != 1 )
                {
                    err = 'lock_failed';
                }
            }
            done(err);
        });
    },
    function(done)
    {
        func(done);
    }],
    function(err,results)
    {
        if( connection )
        {
            var sql = "SELECT RELEASE_LOCK(?)";
            query(connection,sql,lock_name,function()
            {
                release(connection);
                all_done(err);
            });
        }
    });
}

function escape( value )
{
    if( Array.isArray( value ) )
    {
        throw 'Cannot escape arrays';
    }
    if( value === null || value == 'NULL' || value == undefined )
    {
        return 'NULL';
    }
    if( typeof value === 'string')
    {
        return "'{0}'".format( value );
    }
    if( !isNaN( value * 1 ) )
    {
        return value * 1;
    }
    console.trace();
    throw 'Could not escape value: ' + value ;
}
