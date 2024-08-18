global.mergeObjects = function(obj1,obj2)
{
    var obj3 = {};
    
    for( var a in obj1 )
    {
        obj3[a] = obj1[a];
    }
    for( var a in obj2 )
    {
        obj3[a] = obj2[a];
    }
    return obj3;
};

if( typeof String.prototype.format !== 'function' )
{
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
                            return typeof args[number] != 'undefined'
                            ? args[number]
                            : '{' + number + '}'
                            ;
                            });
    };
}

if( typeof String.prototype.format !== 'function' )
{
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
                            return typeof args[number] != 'undefined'
                            ? args[number]
                            : '{' + number + '}'
                            ;
                            });
    };
}