# Log and Audit Plan
## Generation and Collection
Application logs and auditable events are generated in JSON format and output to stdout for collection by cloud.gov along 
with the other log information from the system such as: 
* Web access logs
* FBO Scraper logs
* cloud.gov system event logs

cloud.gov logs all operations performed on organizations and spaces. This includes over 75 distinct events which describe the action 
taken and the user who authorized the action. Event logs are useful for continuous security, compliance and monitoring actions 
taken on the system. More information on cloud.gov log processing can be found in on the [Logs](https://cloud.gov/docs/apps/logs/) 
page of the cloud.gov documentation.

SRT developers wrote logging functions within the SRT codebase that is verbose enough to support after-the-fact introspection and 
troubleshooting when issues arise. Audit records for application events include a timestamp of when the event occurred, 
the source of the event, the outcome of the event, and the identity of any individuals associated with the event.

## Retention 
Log files are retained by cloud.gov for 180 days.

## Searching and Review
Only those users with the proper cloud.gov roles in the SRT organization are able to see log data.  The combinded log files can be 
viewed and searched using Kibana hosted at [https://logs.fr.cloud.gov/](https://logs.fr.cloud.gov/) (login requried). 
Documentation on using Kibana can be found at [https://www.elastic.co/guide/en/kibana/current/index.html](https://www.elastic.co/guide/en/kibana/current/index.html)
