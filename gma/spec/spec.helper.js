/*globals JSpec, _ */
var checkPoint = function(check) {
    var actual = check[0];
    var expected = check[1];
    
    if (actual[0] === undefined) { actual[0] = null; }
    if (actual[1] === undefined) { actual[1] = null; }

    if (expected[0] === undefined) { expected[0] = null; }
    if (expected[1] === undefined) { expected[1] = null; }
    
    var results = [false, false];
    
    for (var i = 0; i < 2; i++) {
        if (_.isNumber(actual[i]) && _.isNumber(expected[i])) {
            results[i] = Math.abs(actual[i] - expected[i]) <= 0.015;
        }
        else {
            results[i] = actual[i] === expected[i];
        }
    }
    
    return _.all(results);
};

var getMessage = function(actual, expected, negate) {
    var actualString = "[" + actual + "]";
    var expectedString = "[" + expected[1] + "]";
    if (negate) {
        return "expected " + actualString + " to not equal " + expectedString;
    }
    else {
        return "expected " + actualString + " to equal " + expectedString;
    }
};

JSpec.addMatchers({
    be_same_point_as : {
        match : function(actual, expected){
            return checkPoint([actual, expected]);
        },
        message : function(actual, expected, negate) {
            return getMessage(actual, expected, negate);
        }
    },

    have_same_points_as : {
        match : function(actual, expected){
            return _.all(_.zip(actual, expected), checkPoint);
        },
        message : function(actual, expected, negate) {
            return getMessage(actual, expected, negate);
        }
    },
    
    have_only : {
        match : function(actual, expected) {
            if (_.isString(expected)) {
                expected = [expected];
            }
            
            var has = true;
            _.each(expected, function(id) {
                if (has) {
                    has = actual.find(id).length === 1;
                }
            })
            
            return has && actual.children().length === expected.length;
        }
    }
});
