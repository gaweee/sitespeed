var request = require('request');
var sleep = require('sleep');
var fs = require('fs');
var tmp = require('tmp');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');

var report = (id, callback) => {
	//logger.debug('Making request to ' + url + ' with ' + JSON.stringify(browser));
	
	//var filename = tmp.tmpNameSync({ template: 'data/result-XXXXXXXX.json' });
	//var filestream = fs.createWriteStream(filename);

	new Promise((resolve, reject) => { 
		sleep.msleep(200);
		if (Math.random() * 2 > 1) {
			resolve({"status":200,"message":"OK","reportId":"58864bf80cf24b310ad84a27"});
		} else { 
			resolve({"status":400,"message":"Some weird message"});
		}

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
		// if (data.status == 200) {
		// 	logger.info('Report request for #' + id + ' completed. Message: ' + data.message, data);
		// } else if (data.status > 200 && data.status < 400) {
		// 	logger.warn('Report request for #' + id + ' incomplete. Message: ' + data.message, data);
		// } else if (data.status >= 400) {
		// 	logger.error('Report request for #' + id + ' failed. Error message: ' + data.message, data);
		// }

		if (typeof callback === 'function')
			callback(data);
	}).catch(error => {
		logger.error(error);
	});
};

module.exports = report;