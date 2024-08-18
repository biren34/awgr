
var util = require('../../bin/util.js');

const G_ORDER_CHANNEL_ID = 'website';
const G_AGENT_ID = 1;
const G_PAYMENT_TERMS_ID = 'prepaid';

exports.addRoutes = function(app,prefix)
{
    //app.post(prefix, createSalesOrderFromShoppingCart );
    //app.get(prefix + '/quotes', getSalesOrderByShoppingCartId );
    app.get(prefix + '/:sales_order_id', getContractOrder );
    //app.patch(prefix + '/:sales_order_id', updateSalesOrder );
};


async function getContractOrder( req, res )
{
    
}