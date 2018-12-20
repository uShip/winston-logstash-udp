const winston = require('winston');
const logstashUdp = require('../lib/winston-logstash-udp').default;

const logger = winston.createLogger({
    transports: [
        new logstashUdp({
            port: 9997,
            appName: 'example test',
            localhost: 'localhost'
        })
    ]
})

logger.info({
    thing: 1
});