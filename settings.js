module.exports = {
	token: 'Your Token Here',
	domain: 'https://www.dareboost.com/api/0.5/',
	rounds: 1,
	concurrency: 2,
	browsers: [
		{ location: 'Sydney', name: 'Chrome', isMobile: false },
		{ location: 'Sydney', name: 'Galaxy S6', isMobile: true },
		{ location: 'Hong Kong', name: 'Chrome', isMobile: false },
		{ location: 'Hong Kong', name: 'Galaxy S6', isMobile: true },
		{ location: 'Chennai', name: 'Chrome', isMobile: false },
		{ location: 'Chennai', name: 'Galaxy S6', isMobile: true }
	]
};