var http = require('http');
var url = require('url');
var queryString = require('querystring');
var fs = require('fs');
var path = require('path');

Array.prototype.indexOfItem = function(comparer) {
    for (var i = 0; i < this.length; i++)
        if (comparer(this[i]))
            return i;

    return -1;
}

Array.prototype.update = function(newArray, key) {
    var result = [];
    
    for (var i = 0; i < this.length; i++) {
        result[i] = this[i];
    };

    for (var i = newArray.length - 1; i >= 0; i--) {
        var newItem = newArray[i];
        var newItemKey = key(newItem);
        var oldItemIndex = this.indexOfItem(function(item) { return key(item) === newItemKey; });

        if (oldItemIndex !== -1) {
            result[oldItemIndex] = newItem;
        }
        else {
            result.unshift(newItem);
        }
    };

    return result;
}

function getData(baseUrl, queryParams, callback) {
    var requestUrl = url.parse(baseUrl + '?' + queryString.stringify(queryParams));
    var client = http.createClient(requestUrl.port || 80, requestUrl.hostname);
    var request = client.request("GET", requestUrl.path || '/');

    request.on('response', function(response) {
        response.setEncoding('utf8');
        var body = '';

        response.on('data', function(data) {
            body += data;
        })

        response.on('end', function() {
            callback(response, body);
        })
    });

    request.end();
}

function getJsonData(baseUrl, queryParams, callback) {
    getData(baseUrl, queryParams, function(response, data) {
        callback(JSON.parse(data));
    })
}

function getItems(baseUrl, queryParams, callback) {
    var allItems = [];

    function getPartialItems() {
        getJsonData(baseUrl, queryParams, processItems);
    }

    function processItems(items) {
        if (allItems.length > 0 && items.length > 0 && allItems[allItems.length - 1].id === items[0].id) {
            items.shift();
        }

        if (items.length === 0) {
            callback(allItems);
            return;
        }

        for (var i = 0; i < items.length; i++) {
            allItems.push(items[i]);
        }

        console.log('Items retrieved so far: ' + allItems.length);

        queryParams.max_id = items[items.length - 1].id;
        getPartialItems();
    }

    getPartialItems();
}

function getTweets(username, callback) {
    var baseUrl = 'http://api.twitter.com/1/statuses/user_timeline.json';
    var queryParams = {
        include_entities: true,
        include_rts: true,
        trim_user: true,
        count: 200,
        screen_name: username,
    };

    return getItems(baseUrl, queryParams, callback);
}

function getFavorites(username, callback) {
    var baseUrl = 'http://api.twitter.com/1/favorites.json';
    var queryParams = {
        include_entities: true,
        trim_user: true,
        count: 200,
        screen_name: username,
    };

    return getItems(baseUrl, queryParams, callback);
}

function saveItems(items, dir, filename, callback) {
    var fullFileName = path.join(dir, filename);

    fs.readFile(fullFileName, function(error, data) {
        var oldItems = !error ? JSON.parse(data) : [];
        var newItems = oldItems.update(items, function(item) { return item.id; });
        fs.writeFile(fullFileName, JSON.stringify(newItems, null, 2), callback);       
    });
}

function saveTweets(username, dir, callback) {
    getTweets(username, function(tweets) {
        saveItems(tweets, dir, username + '.tweets.json', callback);
    });
}

function saveFavorites(username, dir, callback) {
    getFavorites(username, function(favorites) {
        saveItems(favorites, dir, username + '.favorites.json', callback);
    });
}

var args = {
    username: process.argv[2],
    dir: process.argv[3],
};

if (!args.username)
    throw 'Error: Please specify your username.';

if (args.dir && !path.existsSync(args.dir))
    throw 'Error: Dir not found.';

console.log('Saving your tweets...');

saveTweets(args.username, args.dir, function() {
    console.log('Saving your favorites...');

    saveFavorites(args.username, args.dir, function() {
        console.log('Done.');
    });
});
