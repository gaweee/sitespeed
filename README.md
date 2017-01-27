## About
Sitespeed is a utility used to analyse the performance of different sites and urls.
It utilizes [DareBoost API](https://www.dareboost.com/en/documentation-api) to retrieve from different locations
* Time to First Byte (TTFB)
* Download Time
* Dom Ready Time 
* Page Load Time
* Full Page size
* Asset Count, Sizes
* CSS/JS Count and Sizes
* External Script speeds (WIP)

## Setup
Install a redis server (used for queues)

Run index.js either with a url.txt file or a list of options
* Location - Location from which to run the tests (Hong Kong, Sydney, Washington)
* Browser - Browser used to simulate the load
* Mobile - Boolean to indicate if the browser is a mobile
* Rounds - Number of tests to perform for each location-browser combination
* Flags include:
	* -r Resume a previously setup test run
	* -v Verbose (logging)

	Usage: node index.js <url|url.txt> [options]


## How it works
index.js loads the urls into a redis server queue
Worker threads are then started that send the urls (based on a constrained concurrency) to the Dareboost API for analysis.
Successful analysis are added back into another queue for another round of processing
A separate set of worker threads will fetch the reports from [DareBoost API](https://www.dareboost.com/en/documentation-api) and aggregate the information
Finally the information both raw and summarized are put into a CSV file for easier processing

## Todo
* Actual download of the report
* Report generation
**Note:** Still a work in progress

