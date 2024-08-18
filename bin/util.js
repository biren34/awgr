var crypto = require('crypto');
var util = require('util');
var fs = require('fs');
var Buffer = require('buffer').Buffer;
var Readable = require('stream').Readable;
var moment = require('moment-timezone');
var dbg = require('debug')('util');

//var AWS = require('aws-sdk');

var config = require('../config.js')();

/*if( config.aws )
{
    AWS.config.update(config.aws);
}
AWS.config.region = config.aws_region;
*/

exports.roundFloat = roundFloat;
exports.parameterizeString = parameterizeString;
exports.insertSqlFromObjectList = insertSqlFromObjectList;
exports.safeValueFromValue = safeValueFromValue;
exports.safeValueListFromValueList = safeValueListFromValueList;
exports.safeValueListFromObjectList = safeValueListFromObjectList;

exports.fileExists = fileExists;
exports.jsonFromDelimFile = jsonFromDelimFile;
exports.writeS3Object = writeS3Object;
exports.streamS3Object = streamS3Object;
exports.getFileMd5 = getFileMd5;
exports.createError = createError;
exports.log = log;
exports.paramsFromRequest = paramsFromRequest;
exports.deepClone = deepClone;
exports.validateEmail = validateEmail;
exports.uppercaseWords = uppercaseWords;

exports.isEmpty = isEmpty;


async function safeValueListFromObjectList( db, object_list, property_name, options )
{
    let promise_list = [], safe_value_list = [], value;
    let opts = Object.assign( { property_name: property_name  }, options );
    for( obj of object_list )
    {
        promise_list.push( safeValueFromValue( db, obj[ property_name ], opts ) );
    }
    let promise_result_list = await Promise.all( promise_list );
    for( [ err, safe_value ] of promise_result_list )
    {
        if( err ) { return [ err ] };
        safe_value_list.push( safe_value );
    }
    return [ null, safe_value_list ];
}

async function safeValueListFromValueList( db, value_list, options )
{
    //console.log('safeValueListFromValueList, {0}: {1}'.format( options.property_name, value_list ) );
    let promise_list = [], safe_value_list = [];
    for( value of value_list )
    {
        promise_list.push( safeValueFromValue( db, value, options ) );   
    }
    let promise_result_list = await Promise.all( promise_list );
    for( [ err, safe_value ] of promise_result_list )
    {
        if( err ) { return [ err ] };
        safe_value_list.push( safe_value );
    }
    return [ null, safe_value_list ];
}

/*
options
    - error_on_null - true if null values are not allowed
    - data_type: float / int, whatever
    - property_name: the name of the database field corresponding to the value (if exists_in_table or not_exists_in_table are set, will be used as the field to check) 
    - exists_in_table: null | name of the table to check for existing record, returns error if no record found
    - not_exists_in_table: null | name of the table to check for existing record, retuns error a record is found
    - return_escaped: whether the escaped value or unescaped value should be returned, no effect for int or float
*/
async function safeValueFromValue( db, value, raw_options = {} )
{   
    let options = Object.assign( { error_on_null: false, property_name: null, data_type: 'string', return_escaped: true, exists_in_table: null, not_exists_in_table: null }, raw_options );
    if( value === null || value === undefined ) 
    {
        if( options.error_on_null )
        {
            let v = value === null ? 'null' : 'undefined';
            const message = options.property_name ? "Invalid value for {0}: {1}".format( options.property_name, v ) : "Invalid value: " + value ;
            return [ createError( null, 400,  message ) ];
        }
        return [ null, null ];
    }

    let unescaped_safe_value
    switch( options.data_type )
    {   
        case 'int':
        case 'float':
            if( isNaN( value * 1 ) )
            {
                return [ createError( null, 400, 'Invalid value: ' + value ) ];
            }
            unescaped_safe_value = value * 1 ;
            break;
        case 'string':
            if( typeof value !== 'string' )
            {
                return [ createError( null, 400, 'Invalid value: ' + value ) ];
            }
            unescaped_safe_value = value;
            break;
        case 'bool':
            switch( value )
            {
                case true:
                case 1:
                case 'true':
                    unescaped_safe_value = 1;
                    break;
                case false:
                case 0:
                case 'false':
                    unescaped_safe_value = 0;
                    break;
                default:
                    return [ createError( null, 400, 'Invalid value: ' + value ), null ];       
            }
            break;
        case 'email':
            let v = value;
            let is_valid_email = typeof v === 'string';
            if( is_valid_email )
            {
                v = value.toLowerCase().trim();
                is_valid_email = validateEmail( v );
            }
            if( !is_valid_email )
            {
                return [ createError( null, 400, 'Invalid value: ' + value ), null ];       
            }
            unescaped_safe_value = v;
            break;
        default:
            unescaped_safe_value = value;
            break;
    }

    let field, connection = options.connection, record;
    if( options.exists_in_table !== null )
    {
        field = options.property_name || options.exists_in_table + '_id';
        //todo make this query safer
        let sql = "select * from {1} where `{0}` = {2} ".format( field, options.exists_in_table, db.escape( unescaped_safe_value ) );
        [ err, results ] = await db.query( sql, { connection } );
        if( err ) { return [ err ]; }
        if( results.length === 0 ) { return [ createError( null, 404, 'No record found for {0}: {1}'.format( field, value ) ) ]; }
        record = results[ 0 ];
    }

    if( options.not_exists_in_table !== null )
    {
        field = options.property_name || options.not_exists_in_table + '_id';
        //todo make this query safer
        let sql = "select `{0}` from {1} where `{0}` = {2} ".format( field, options.not_exists_in_table, db.escape( unescaped_safe_value ) );
        [ err, results ] = await db.query( sql, { connection } );
        if( err ) { return [ err ]; }
        if( results.length !== 0 ) { return [ createError( null, 409, '{0}: {1} already exists'.format( field, value ) ) ]; }
    }

    let safe_value = unescaped_safe_value;
    switch( options.data_type )
    {
        case 'int':
        case 'float':
        case 'bool':
            break;
        default: 
            safe_value = options.return_escaped ? db.escape( unescaped_safe_value ) : unescaped_safe_value;
            break;
    }
    
    return [ null, safe_value, record ];
}

/*async function mapQueryResults( query_result_list, async_fn, args, options )
{
    let promise_list = [];
    for( query_result of query_result_list )
    {
        promise_list.push( async_fn( (...args) , options ) );
    }
    const promise_result_list = await Promise.all( promise_list );

    let result_list = [];
    for( promise_result of promise_result_list )
    {
        if( promise_result[ 0 ] ) { return promise_result; }
        result_list.push( promise_result[ 1 ] );
    }
    return [ null, result_list ];
}*/

function parameterizeString(sql, map)
{
    if( !map )  { return sql; }

    let key_list = Object.keys( map );
    if( key_list.length === 0 ) { return sql; }

    for( key of key_list )
    {
        let val = map[ key ] || '';
        var regex = new RegExp("{" + key + "}",'g');
        sql = sql.replace(regex,val);
    }
    return sql;
}

function roundFloat(value, toNearest, fixed)
{   
    return (Math.round(value / toNearest) * toNearest).toFixed(fixed) * 1; 
}

function get_range( data, start_ix, lookback, units ) //move to chart pattern analysis library
{
    var end_ix = start_ix || data.length - 1;
    switch( units )
    {
        case 'bars':
            var lookback_bar_count = lookback;
            break;
        case 'hours':
        case 'h':
        case 'minutes':
        case 'm':
            var last_bar = data[ end_ix ];
            var cutoff = moment( last_bar.close_ts ).subtract( lookback, units );
            //console.log('last_bar.close_ts:', last_bar.close_ts, ' / cutoff:', cutoff, ' / data.length:', data.length, ' / start_ix:', start_ix );
            var lookback_bar_count = null;
            for( var i = 0 ; i < end_ix ; i++ )
            {
                var bar = data[ end_ix - i ];
                var ts = moment( bar.open_ts );
                console.log('ts ', ts );
                if( ts.valueOf() <= cutoff.valueOf() )
                {
                    lookback_bar_count = i;
                    break;
                }
            }
            if( lookback_bar_count === null )
            {
                console.error('get_range is being asked to look further back than data provided');
                process.exit();
            }
            break;
        default:
            console.error('Unrecognized lookback units: ', units );
            process.exit();

    }

    console.log('2321213 lookback_bar_count: ', lookback_bar_count);
    console.log('903908 data: ', data);
    console.log('903908 end data')
    var range = 
    { 
        high: -9999999999,
        low: 9999999999
    }
    for( var i = 0; i < lookback_bar_count - 1; i++ )
    {
        var bar = data[ end_ix - i ];
        if( !bar )
        {
            break;
        }
        range.high = Math.max( bar.high, range.high );
        range.low = Math.min( bar.low, range.low );
    }

    return range;
}

function insertSqlFromObjectList( list, table, conflict_field_list, database_kind, db )
{
    db = db || data_db;
    var field_list = Object.keys( list[0] );

    switch( database_kind )
    {
        case 'postgres':
            var field_str = '"{0}"'.format( field_list.join('","'));
            break;
        case 'mysql':
            var field_str = '{0}'.format( field_list.join(','));
            break;
    }
    
    var value_str_list = [];
    for( l of list )
    {
        var v = [];
        for( f of field_list )
        {
            v.push( db.escape( l[ f ]) );
        }
        value_str_list.push( '(' + v.join( ',' ) + ')' );
    }

    var sql = "INSERT INTO {0} ({1}) VALUES {2}".format( table, field_str, value_str_list.join(',') );
    if( conflict_field_list && conflict_field_list.length > 0 )
    {
        sql += ' ON CONFLICT( {0} ) DO NOTHING'.format( conflict_field_list.join(',') )
    }
    return sql;
}

function fileExists(filename_with_path)
{
    var fs = require('fs');
    try {
        stats = fs.lstatSync(filename_with_path);

        if (stats.isFile()) {
            return true;
        }
        throw err;
    }
    catch (e) {
        return false;
    }
}

function jsonFromDelimFile(filename, file_type, field_delim, line_delim)
{
    file_type = file_type || 'utf8';
    field_delim = field_delim || ',';
    line_delim = line_delim || '\n';

    var raw_data = fs.readFileSync(filename, file_type);
    var line_list = raw_data.split(line_delim);

    var key_list = line_list[0].split(field_delim);
    key_list = key_list.filter( ( key ) => !isEmpty(key) && key!='\r' );
    
    for( ix = 0 ; ix < key_list.length ; ix++ )
    {
        key_list[ix] = key_list[ ix ] .toLowerCase().trim();
    }
    line_list = line_list.slice(1);
    
    var split_line_list = [];
    var regex = new RegExp(field_delim,"g");
    for( line of line_list )
    {
        if( isEmpty(line.replace(regex, '')))
        {
            split_line_list.push(line.split(field_delim));
        }
    }

    var result_list = [];
    for( value_list of split_line_list )
    {   
        var result = {};
        for( key of key_list )
        {
            var value = value_list[key_list.indexOf(key)];
            if(!isEmpty(value) && value != '\r' && value !== 'null' && value !== 'NULL')
            {
                result[key] = value.trim(); 
            }
            else
            {
                result[key] = null;
            }
        }
        if(!isEmpty(result))
        {
            result_list.push(result);   
        }
    }
    return result_list;
}


function writeS3Object(key,body,done)
{
    var buffer = new Buffer(body);
    var readable = new Readable({ highWaterMark: 5 * 1024 * 1024 });
    var pos = 0;
    readable._read = function(size)
    {
        if( pos >= buffer.length )
        {
            return readable.push(null);
        }
        var end = pos + size;
        if( end > buffer.length )
        {
            end = buffer.length;
        }
        readable.push(buffer.slice(pos, end));
        pos = end;
    };

    var s3_client = new AWS.S3();
    var params = {
        Body: readable,
        ContentLength: buffer.length,
        Bucket: config.load_data_bucket,
        CacheControl: "private, max-age=" + 365*24*60*60,
        ContentType: "text/csv",
        Key: key,
        ServerSideEncryption: "AES256",
    };
    s3_client.putObject(params,function(err,data)
    {
        if( err )
        {
            errorLog("S3 putObject error: ",err);
        }
        done(err);
    });
}

function streamS3Object(s3_key,path,content_type,done)
{
    var rs = fs.ReadStream(path);

    var s3_client = new AWS.S3();
    var params = {
        Body: rs,
        Bucket: config.load_data_bucket,
        CacheControl: "private, max-age=" + 365*24*60*60,
        ContentType: content_type,
        Key: s3_key,
        ServerSideEncryption: "AES256",
    };
    s3_client.putObject(params,function(err,data)
    {
        if( err )
        {
            errorLog("streamS3Object: putObject err:",err);
        }
        done(err);
        rs.close();
    });
}

function getFileMd5(path,done)
{
    var md5sum = crypto.createHash('md5');

    var rs = fs.ReadStream(path);
    rs.on('data', function(d)
    {
        md5sum.update(d);
    });
    rs.on('end',function()
    {
        var md5 = md5sum.digest('hex');
        rs.close();
        done(null,md5);
        done = function() {};
    });
    rs.on('error',function()
    {
        done('read_error');
        done = function() {};
        rs.close();
    });
}

function createError( err, code, message )
{
    if( !err && !code ) 
    {
        return null;
    }
    console.trace();
    var e = { code: code, message: message };
    if( err )
    {
        errorLog( e, err );    
    }
    return e;
}

function errorLog()
{
    var s = util.format.apply(this,arguments);
    console.error("[" + new Date().toUTCString() + "] " + s);
}
function log()
{
    var s = util.format.apply(this,arguments);
    console.log("[" + new Date().toUTCString() + "] " + s);
}

function paramsFromRequest( req, required_props, optional_props = [] )
{
    var raw_params = Object.assign({}, req.body, req.query, req.params );
    dbg('raw_params: ', raw_params );
    var cp_raw_params = Object.assign( {}, raw_params );
    let params = {};
    for( var i = 0; i < required_props.length ; i++ )
    {
        var p = required_props[ i ];
        if( !raw_params.hasOwnProperty( p ) )
        {
            return [ createError( null, 400, 'Missing required property: ' + p ) ];
        }
        params[ p ] = raw_params[ p ];
        delete cp_raw_params[ p ];
    }

    let default_val;
    for( op of optional_props )
    {
        for( key in op )
        {
            default_val = op[ key ];
            delete cp_raw_params[ key ];
            if( raw_params.hasOwnProperty( key ) )
            {
                params[ key ] = raw_params[ key ];
                continue;
            }
            if( default_val !== undefined )
            {
                params[ key ] = default_val;
            }
        }
    }

    const key_list = Object.keys(cp_raw_params);
    if( key_list.length > 0 )
    {
        return [ createError( null, 400, 'Invalid properties received: ' + key_list.join(',') ) ];
    }
    return [ null, params ];
}


function deepClone(obj)
{
    return JSON.parse(JSON.stringify(obj));
}


function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function uppercaseWords( str )
{
    const words = str.split(" ");
    for (let i = 0; i < words.length; i++) {    
        words[i] = words[i][0].toUpperCase() + words[i].substr(1);
    }
    return words.join(' ');
}

function isEmpty( value )
{
  return (
    value == null || // From standard.js: Always use === - but obj == null is allowed to check null || undefined
    (typeof value === 'object' && Object.keys(value).length === 0) ||
    (typeof value === 'string' && value.trim().length === 0)
  )
}
