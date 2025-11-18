import { appendFileSync } from "fs";

export class Logger {
  INFO = "INFO";
  WARN = "WARN";
  ERROR = "ERROR";
  constructor(path) {
    this.path = path;
  }
  log(message, logLevel) {
    const output = `${new Date().toISOString()}[${logLevel}]${message}\n`;
    appendFileSync(this.path, output, "utf8");
  }
  info(message) {
    this.log(message, this.INFO);
  }
  warn(message) {
    this.log(message, this.WARN);
  }
  error(message) {
    this.log(message, this.ERROR);
  }
}
