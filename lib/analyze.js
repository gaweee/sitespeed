var request = require('request');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');

var analyze = (url, browser, callback) => {
	logger.debug('Making request to ' + url + ' with ' + JSON.stringify(browser));
	new Promise((resolve, reject) => { 
		request.post(
			{
				//url: 'http://localhost:3000/test',
				url: settings.domain + 'analysis/launch',
				headers: { 'accept': 'application/json' },
				timeout: settings.requestTimeout,
				json: {
					token: settings.token,
					url: url,
					location: browser.location,
					browser: {
						name: browser.name
					},
					mobileAnalysis: browser.isMobile,
					visualMetrics: false
				}
			}, (error, response, body) => {
				error ? reject(error) : resolve(body);
			}
		);
	}).then(data => {
		data.url = url;
		data.browser = browser;

		if (data.status == 200) {
			logger.info('Analyze request to ' + url + ' completed. Message: ' + data.message, data);
		} else if (data.status > 200 && data.status < 400) {
			logger.warn('Analyze request to ' + url + ' incomplete. Message: ' + data.message, data);
		} else if (data.status >= 400) {
			logger.error('Analyze request to ' + url + ' failed. Error message: ' + data.message, data);
		}

		if (typeof callback === 'function')
			callback(data);
	}).catch(error => {
		logger.error(error);
	});
};

module.exports = analyze;