/**
 * Compare two lists and categorize values based on where they appear
 * @param {Array} dbList - List of values from database
 * @param {Array} jsonKeyList - List of values from JSON payload
 * @returns {Object} Result with categorized values in arrays
 */
function compareValueLists(dbList, jsonKeyList) {
    var result = {
        'none': [],    // Values found in both lists
        'delete': [],  // Values only in dbList (to be deleted)
        'insert': []   // Values only in jsonKeyList (to be inserted)
    };
    
    // Create lookup objects for faster checking
    var dbLookup = {};
    var jsonLookup = {};
    
    // Populate lookup objects
    for (var i = 0; i < dbList.length; i++) {
        dbLookup[dbList[i]] = true;
    }
    
    for (var j = 0; j < jsonKeyList.length; j++) {
        jsonLookup[jsonKeyList[j]] = true;
    }
    
    // Find values in both lists (none)
    for (var k = 0; k < dbList.length; k++) {
        var dbItem = dbList[k];
        if (jsonLookup[dbItem]) {
            result.none.push(dbItem);
        }
    }
    
    // Find values only in dbList (delete)
    for (var l = 0; l < dbList.length; l++) {
        var dbOnlyItem = dbList[l];
        if (!jsonLookup[dbOnlyItem]) {
            result.delete.push(dbOnlyItem);
        }
    }
    
    // Find values only in jsonKeyList (insert)
    for (var m = 0; m < jsonKeyList.length; m++) {
        var jsonItem = jsonKeyList[m];
        if (!dbLookup[jsonItem]) {
            result.insert.push(jsonItem);
        }
    }
    
    return result;
}

// Test with your example data
var dbList = ['123/abc/234', '231/sdf/123', '899/kjk/098'];
var jsonKeyList = ['123/abc/234', '789/oiu/908', '899/kjk/098'];

var result = compareValueLists(dbList, jsonKeyList);
console.log(result);
