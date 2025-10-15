import sendReqMenu from "./sendReqMenu.js";
import { mkdirSync, writeFileSync } from "fs";
import extractData from "./extractData.js";
import { Logger } from "../lib/Logger.js";

/**
 *
 * @param {string} shopUuid
 * @param {string} shopName
 * @param {number} latitude
 * @param {number} longitude
 * @param {boolean} grepJson
 * @param {Logger} logger
 */
export default async function getMenu(
  shopUuid,
  shopName,
  latitude,
  longitude,
  grepJson,
  logger,
) {
  // delay
  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * 1_000 + 1_000),
  );

  let get = await fetch(
    `https://www.foodpanda.com.tw/restaurant/${shopUuid}/`,
    {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.7",
        priority: "u=0, i",
        "sec-ch-ua":
          '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "sec-gpc": "1",
        "upgrade-insecure-requests": "1",
      },
      referrer: "https://www.google.com/",
      method: "GET",
      mode: "cors",
    },
  );

  const setCookie = get.headers.getSetCookie();
  let perseus_client_id = "";
  let perseus_session_id = "";
  for (const setCookieStr of setCookie) {
    if (setCookieStr.includes("PerseusGuestId"))
      perseus_client_id = setCookieStr.split(";")[0].split("=")[1];
    else if (setCookieStr.includes("PerseusSessionId"))
      perseus_session_id = setCookieStr.split(";")[0].split("=")[1];
  }

  let now = new Date();

  // fetch logic
  let response = await sendReqMenu(
    shopUuid,
    latitude,
    longitude,
    "1751293229242.035865992059667991.ctokxyw375",
    "1751299673870.686325495878323394.2hc61mq3mq",
    logger,
  );
  logger.info(shopUuid, latitude, longitude, response.status);
  if (!response) {
    logger.error(`${shopUuid}, ${latitude}, ${longitude} Failed`);
  }
  const data = await response.json();
  // normalize payload path（不同 API 版本結構不一樣）
  const payload =
    (data && (data.data || data.restaurant || data.vendor || data.result)) || data;

  if (!payload) {
    logger.error(`${shopUuid} empty response body or missing payload`);
    // 回傳基本骨架，避免上游看到 undefined
    try {
      return extractData({}, now, latitude, longitude, logger);
    } catch {
      return {};
    }
  }

  // write to json
  if (grepJson) {
    const TODAY = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const jsonPath = `../../../panda_data_js/panda_menu/json/${TODAY}`;
    try {
      mkdirSync(jsonPath, { recursive: true });
    } catch (err) {}
    try {
      writeFileSync(
        `${jsonPath}/${latitude}_${longitude}_${shopUuid}.json`,
        JSON.stringify(data),
      );
    } catch (error) {}
  }

  // data conversion
  return extractData(payload, now, latitude, longitude, logger);
}
