module.exports = {
	token: 'YOUR TOKEN HERE',
	domain: 'https://www.dareboost.com/api/0.5/',
	rounds: 1,								// Rounds of testing in a given run
	concurrency: 2,							// Number of concurrent threads
	attempts: 20,							// Number of times a request can be tried
	timeout: 60 * 1000,						// HTTP Timeout in miliseconds
	delay: 60 * 1000,						// Time in miliseconds between Analyze and Report tasks
	visualMetrics: false,					// Visual Metrics (2 credits per test)
	metricsOnly: true,						// Prevents the download of advisory content
	browsers: [
		{ location: 'Sydney', name: 'Chrome', isMobile: false },
		{ location: 'Sydney', name: 'Galaxy S6', isMobile: true },
		{ location: 'Hong Kong', name: 'Chrome', isMobile: false },
		{ location: 'Hong Kong', name: 'Galaxy S6', isMobile: true },
		{ location: 'Chennai', name: 'Chrome', isMobile: false },
		{ location: 'Chennai', name: 'Galaxy S6', isMobile: true }
	],
	cleanup: {
		interval: 5 * 60 * 1000,			// 5 mins
		failed_ttl: 6 * 60 * 60 * 1000,		// 6 hours
		active_ttl: 6 * 60 * 60 * 1000,		// 3 hours
		complete_ttl: 6 * 60 * 60 * 1000,	// 6 hours
	}
};