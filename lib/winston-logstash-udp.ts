/**
 * (C) 2018 uShip, Inc; 2013 Sazze, Inc.
 * MIT LICENCE
 *
 * Based on a gist by mbrevoort.
 * Available at: https://gist.github.com/mbrevoort/5848179
 *
 * Inspired by winston-logstash
 * Available at: https://github.com/jaakkos/winston-logstash
 */

import * as dgram from "dgram";
import * as os from "os";
import Transport from "winston-transport";
import { format } from "logform";

interface LogstashUdpOptions extends Transport.TransportStreamOptions {
    localhost?: string;
    host?: string;
    port?: number;
    appName?: string;
    pid?: number;
    trailingLineFeed?: boolean;
    trailingLineFeedChar?: string;
    udpType?: "udp6" | "udp4";
}

class LogstashUdp extends Transport {
    public name: "logstashUdp" = "logstashUdp";

    private static formatter = format.combine(
        format.timestamp(),
        format.json()
    );

    private localhost: string;
    private host: string;
    private port: number;
    private application: string;
    private pid: number;
    private trailingLineFeed: boolean;
    private trailingLineFeedChar: string;
    private udpType: "udp6" | "udp4";
    private client: dgram.Socket;

    constructor(options: LogstashUdpOptions) {
        super(options);
        options = options || {};

        this.name = "logstashUdp";
        this.level = options.level || "info";
        this.localhost = options.localhost || os.hostname();
        this.host =
            options.host || (options.udpType === "udp6" ? "::1" : "127.0.0.1");
        this.port = options.port || 9999;
        this.application = options.appName || process.title;
        this.pid = options.pid || process.pid;
        this.trailingLineFeed = options.trailingLineFeed === true;
        this.trailingLineFeedChar = options.trailingLineFeedChar || os.EOL;
        this.udpType = options.udpType === "udp6" ? "udp6" : "udp4";

        this.client = null;

        this.connect();
    }

    public connect() {
        this.client = dgram.createSocket(this.udpType);

        // Attach an error listener on the socket
        // It can also avoid top level exceptions like UDP DNS errors thrown by the socket
        this.client.on("error", function(err) {
            // in node versions <= 0.12, the error event is emitted even when a callback is passed to send()
            // we always pass a callback to send(), so it's safe to do nothing here
        });

        if (this.client.unref) {
            this.client.unref();
        }
    }

    log?(
        info: any,
        callback: (info: Error | null, success: boolean) => void
    ): true {
        if (this.silent) {
            callback(info, true);
            return true;
        }

        const { message, level } = info;

        const splat = info.splat || info[Symbol.for("splat")];
        let meta: { [key: string]: any } = {};
        if (splat && Array.isArray(splat)) {
            const error = splat.find(v => v instanceof Error) as Error | null;
            if (error) {
                meta = {
                    error: error.stack || error.toString(),
                };
            } else if (splat.length >= 1) {
                meta = splat[0];
            }
        }
        meta.application = this.application;
        meta.serverName = this.localhost;
        meta.pid = this.pid;

        const logObject = LogstashUdp.formatter.transform({
            message,
            ...meta,
            level: level || this.level,
            ["@version"]: 1,
        });

        let logstashMessage = logObject[Symbol.for("message")] as string;
        logstashMessage = logstashMessage.replace(
            /\"timestamp\"/,
            '"@timestamp"'
        );

        this.sendLog(logstashMessage, err => {
            this.emit("logged", !err);
            callback(err, !err);
        });

        return true;
    }

    sendLog(message: string, callback: (error: Error, bytes: number) => void) {
        if (this.trailingLineFeed === true) {
            message = message.replace(/\s+$/, "") + this.trailingLineFeedChar;
        }

        const messageBuffer = Buffer.from(message);

        callback = callback || function() {};

        this.client.send(
            messageBuffer,
            0,
            messageBuffer.length,
            this.port,
            this.host,
            callback
        );
    }
}

export default LogstashUdp;
