import getMenu from "./getMenu.js";
import { mkdirSync, writeFileSync } from "fs";
import { Logger } from "../lib/Logger.js";
import { readCSV } from "danfojs-node";

const date = new Date();

let TODAY = `${date.getFullYear()}`;
if (date.getMonth() + 1 < 10) TODAY += `-0${date.getMonth() + 1}`;
else TODAY += `-${date.getMonth() + 1}`;
if (date.getDate() < 10) TODAY += `-0${date.getDate()}`;
else TODAY += `-${date.getDate()}`;

const PATH = `../../../panda_data_js/panda_menu/${TODAY}`;

const DEBUG_MODE = false;
const logger = new Logger(`${TODAY}.log`);

async function main() {
  // 確保輸出目錄存在
  try {
    mkdirSync(PATH, { recursive: true });
  } catch (e) { }

  // 如果在 debug 模式，側特定的店家就夠了
  if (DEBUG_MODE) {
    await getMenu("abmy", "", 25.0531908, 121.45147382, true);
    return;
  }

  // read shopinformation
  const locationPath = `../../../panda_data/shopLst/rolling.csv`;
  const menuPath = `../../../panda_data_js/panda_menu/${TODAY}`;

  let stores = [];
  let retries = [];
  let df = await readCSV(locationPath);
  df = df.loc({
    columns: ["shopCode", "shopName", "latitude", "longitude"],
  }).values;
  logger.info(`(${df[0][2]}, ${df[0][3]}): ${df.length} shops`);

  // const grepJson = date.getDate() >= 10 && date.getDate() < 17;
  const grepJson = true;

  for (const row of df) {
    try {
      // add random delay to avoid 429
      const delay = Math.floor(Math.random() * 1000) + 5000; // 3 to 5 seconds
      await new Promise((resolve) => setTimeout(resolve, delay));

      const menu = await getMenu(
        row[0],
        row[1],
        row[2],
        row[3],
        grepJson,
        logger,
      );
      try {
        if (menu !== undefined && menu !== null) {
          writeFileSync(
            `${PATH}/${row[2]}_${row[3]}_${row[0]}.json`,
            JSON.stringify(menu),
          );
        } else {
          logger.info(`[SKIP WRITE] ${row[0]} menu is undefined/null`);
        }
      } catch (error) { }
      stores.push(menu);
    } catch (e) {
      logger.error(e);
      retries.push([row[0], row[1], row[2], row[3]]);
    }
  }
  for (const row of retries) {
    try {
      const menu = await getMenu(
        row[0],
        row[1],
        row[2],
        row[3],
        grepJson,
        logger,
      );
            try {
        writeFileSync(
          `${PATH}/${row[2]}_${row[3]}_${row[0]}.json`,
          JSON.stringify(menu),
        );
      } catch (error) { }
      stores.push(menu);
    } catch (e) {
      logger.error(e);
    }
  }
  try {
    writeFileSync(`${PATH}/${TODAY}_all.json`, JSON.stringify(stores));
  } catch (error) {
    logger.error(error);
  }
}

try {
  main();
} catch (e) {
  logger.error("Totally failed");
  logger.error(e.toString());
}
