import sendReqMenu from "./sendReqMenu.js";
import { mkdirSync, writeFileSync } from "fs";
import extractData from "./extractData.js";
import { Logger } from "../lib/Logger.js";

const randomDigits = (length) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const randomAlphaNum = (length) =>
  Array.from({ length }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");

const buildPerseusClientId = () =>
  `${Date.now()}.${randomDigits(18)}.${randomAlphaNum(10)}`;

const buildPerseusSessionId = () =>
  `${Date.now()}.${randomDigits(18)}.${randomAlphaNum(10)}`;

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

  logger.info(
    `[bootstrap] ${shopUuid} html status=${get.status} cookies=${get.headers.get("set-cookie") ? "Y" : "N"}`,
  );

  const setCookie = get.headers.getSetCookie?.() ?? [];
  const cookieJar = new Map();
  let perseus_client_id = "";
  let perseus_session_id = "";
  for (const setCookieStr of setCookie) {
    const [cookiePair] = setCookieStr.split(";");
    if (!cookiePair) continue;
    const eqIndex = cookiePair.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = cookiePair.slice(0, eqIndex).trim();
    const value = cookiePair.slice(eqIndex + 1).trim();
    if (!key) continue;
    cookieJar.set(key, value);
    if (key === "PerseusGuestId") perseus_client_id = value;
    else if (key === "PerseusSessionId") perseus_session_id = value;
  }

  if (!perseus_client_id || !perseus_session_id) {
    logger.warn(
      `[${shopUuid}] missing perseus cookie (client: ${perseus_client_id}, session: ${perseus_session_id})`,
    );
  }
  if (!perseus_client_id) {
    perseus_client_id = buildPerseusClientId();
    cookieJar.set("PerseusGuestId", perseus_client_id);
  }
  if (!perseus_session_id) {
    perseus_session_id = buildPerseusSessionId();
    cookieJar.set("PerseusSessionId", perseus_session_id);
  }
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  if (!cookieHeader) {
    logger.warn(`[${shopUuid}] html response did not return any cookies`);
  }

  let now = new Date();

  // fetch logic
  let response = await sendReqMenu(
    shopUuid,
    latitude,
    longitude,
    perseus_client_id,
    perseus_session_id,
    cookieHeader,
    logger,
  );
  if (!response) {
    const error = new Error(
      `${shopUuid}, ${latitude}, ${longitude} request failed`,
    );
    logger.error(error.message);
    throw error;
  }
  logger.info(
    `[api] ${shopUuid} (${latitude}, ${longitude}) status=${response.status}`,
  );
  const data = await response.json();

  const blockedByPerimeterX =
    data &&
    typeof data === "object" &&
    data.appId &&
    data.jsClientSrc &&
    data.blockScript;
  if (blockedByPerimeterX) {
    const error = new Error(`[${shopUuid}] blocked by PerimeterX`);
    logger.warn(error.message);
    throw error;
  }

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
