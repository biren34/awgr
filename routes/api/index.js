
var order = require('./contract_order.js');


exports.addRoutes = function(app,prefix)
{
    console.log('prefix:', prefix);
    
    order.addRoutes( app, prefix + '/contract-orders');


    //invoice.addRoutes( app, prefix + '/invoices');
};

