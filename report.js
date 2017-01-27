var settings = require(__dirname + '/settings.js');
var request = require('request');
var sleep = require('sleep');
var fs = require('fs');
var tmp = require('tmp');

var pageTest = (url, browser, callback) => {
	//console.log('Webservice call for ' + url + ' with ' + JSON.stringify(browser));
	
	//var filename = tmp.tmpNameSync({ template: 'data/result-XXXXXX.json' });
	//var filestream = fs.createWriteStream(filename);

	new Promise((resolve, reject) => { 
		sleep.msleep(200);
		resolve();
		// request.post(
		// 	{
		// 		//url: 'http://localhost:3000/test',
		// 		url: settings.domain + 'analysis/launch',
		// 		headers: { 'accept': 'application/json' },
		// 		json: {
		// 			token: settings.token,
		// 			url: url,
		// 			location: browser.location,
		// 			browser: {
		// 				name: browser.name
		// 			},
		// 			mobileAnalysis: browser.isMobile,
		// 			visualMetrics: false
		// 		}
		// 	}, function(error, response, body) {
		// 		console.log('data received');
		// 		console.log(body);
		// 		error ? reject(error) : resolve(body);
		// 	}
		// ).pipe(filestream);
	}).then(data => {
		if (typeof callback === 'function')
			callback(data);
	}).catch(error => {
		console.log(error)
	});
};

module.exports = pageTest;