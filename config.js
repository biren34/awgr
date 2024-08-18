
var config = {
	dev: 
	{
		"host": "http://localhost",
		"port": 3040,
		"public_port": 3040,
		"api_ver": "1",
		"app_path":"/Users/biren/Dropbox/dev/perseid/awgr",
		// "email_credentials_file": "/Users/biren/.americano/email_credentials.json",
	    "db": 
	    {
	        "credentials_file": "/Users/biren/.awgr/db_credentials.json",
	    },
	    /*"aws": {
	        "credentials_file": "/Users/biren/.americano/aws_credentials.json",
	        "region":"us-west-2",
	    },*/
	    //"sku_image_host": "https://d2pvosoqf0p4rm.cloudfront.net",

	},
}

module.exports = function()
{
	if(!process.env.NODE_ENV || !config.hasOwnProperty(process.env.NODE_ENV))
	{
		return config.dev;
	}
	return config[process.env.NODE_ENV];
};
