## About
Sitespeed is a utility used to analyse the performance of different sites and urls.
It utilizes DareBoost API to retrieve from different locations
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

	Usage: node index.js <url|url.txt> [options]


## How it works
index.js loads the urls into a redis server
analysis-worker.js will send the urls (based on a constrained concurrency) to the Dareboost API for analysis.
Successful analysis are added back into the queue for another round of processing
report-worker.js will fetch the report information from Dareboost API and aggregate the information
_WIP_ Someone somewhere will write the report

```javascript
node index.js urls.txt

node analysis-worker.js

node report-worker.js

```

**Note:** Still a work in progress

