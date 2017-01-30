var _ = require('underscore');
var request = require('request');
var sleep = require('sleep');
var fs = require('fs');
var tmp = require('tmp');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');

// Setup Queue
var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000);

// @Todo: mkdir data/key

// Setup worker to process fetch analysis reports
queue.process('sitespeed-report-' + process.env.key, (job, done) => {
	report(job.data, (response) => {
		// 200: OK
		// 202: The analysis is currently processing
		// 204: No data available or added (e.g. you request is correct but there is no data corresponding)
		// 206: The request is ok but the result is not complete : the analysis report is not complete (missing some rules or some timings) or all creation / edition have not be done (e.g. for the events)
		// 400: Missing parameters or bad value
		// 401: Authentication required (no token or invalid token)
		// 403: Action forbidden (quotas reached, unauthorized url)
		// 404: Page is unreachable (unknown url / check server response failed)
		// 406: Not a valid json format
		// 408: The analysis has timeout
		// 417: The last analysis of the monitoring results in error
		// 500: Internal server error (unknown error, contact us)
		// 503: The API is temporarily unavailable, try again in a few minutes

		var status;
		switch(response.status) {
			case 200:
				logger.info('[Report] Successful request of Report #' + response.id, response);
				var filename = tmp.tmpNameSync({ template: 'data/XXXXXXXX' });
				fs.writeFile(filename + '.json', JSON.stringify(response, false, '\t'), function(err) {
				    if (err) { logger.error(err); }
				}); 

				// @Todo this requires shpuld be part of a promise before the response
				request(response.report.harFileUrl).pipe(fs.createWriteStream(filename + '.har'));
				break;

			case 404:
				logger.error('[Report] Failed request of Report #' + response.id + '. Error message: ' + response.message, response);
				status = new Error(response.message);
				job.attempts(1).failed().error(response.message);
				break;

			case 400:
			case 401:
			case 406:
			case 500:
			case 503:
				logger.crit('[Report] Critical failure on request of Report # ' + response.id + '. Error message: ' + response.message, response);
				throw new Error('Critical failure: ' + response.message);

			default: 
				logger.warn('[Report] Incomplete request of Report #' + response.id + '. Message: ' + response.message, response);
				status = new Error(response.message);	
		}


		// Do something with the data
		sleep.msleep(process.env.pretend == "true" ? 1000 : settings.delay);
		done(status);
	});
});


function report(params, callback) {
	logger.debug('Making request to fetch report #' + params.id);
	new Promise((resolve, reject) => { 
		if (process.env.pretend == "true") {
			resolve({"status":200,"message":"OK","reportId":"58864bf80cf24b310ad84a27"});
		} else {
			request.post(
				{
					url: settings.domain + 'analysis/report',
					headers: { 'accept': 'application/json' },
					timeout: settings.requestTimeout,
					json: {
						token: settings.token,
						reportId: params.id,
						metricsOnly: settings.metricsOnly
					}
				}, (error, response, body) => {
					error ? reject(error) : resolve(body);
				}
			);
		}
	}).then(response => {
		if (typeof callback === 'function')
			callback(_.extend(response, params));
	}).catch(error => {
		logger.error(error);
	});
}