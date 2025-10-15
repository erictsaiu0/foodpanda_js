import getMenuData from "./extractMenu.js";
import { Logger } from "../lib/Logger.js";
import { log } from "console";

// Utility to pick the first non-undefined, non-null value
const pickFirst = (...vals) => vals.find(v => v !== undefined && v !== null);

/**
 * The function is used to extract data from given data
 * @param {Object} data
 * @param {Date} now
 * @param {number} latitude
 * @param {number} longitude
 * @param {Logger} logger
 */
export default function extractData(data, now, latitude, longitude, logger) {
  // setup result
  let result = {
    shopCode: NaN,
    localtion: `"${JSON.stringify([latitude, longitude])}"`,
    updateDate: now.toLocaleDateString(),
    shopName: NaN,
    address: NaN,
    postalCode: NaN,
    shopLat: NaN,
    shopLng: NaN,
    city: NaN,
    pickupTime: NaN,
    deliverFee: NaN,
    rate: NaN,
    rateCt: NaN,
    storeAvailabilityStatus: NaN,
    catLst: NaN,
    chain: NaN,
    menu: NaN,
    is_shop_price: NaN,
    popularityLabel: NaN,
  };

  // uuid and title（避免直接 return 導致整個 menu 變成 undefined）
  try {
    result.shopCode = pickFirst(data.code, data.uuid, data.id, data?.vendor?.code, data?.restaurant?.code, NaN);
    const nameVal = pickFirst(data.name, data?.vendor?.name, data?.restaurant?.name);
    result.shopName = nameVal !== undefined ? `"${nameVal}"` : NaN;
  } catch (e) {
    logger.error(`missing basic identity fields`);
  }

  // location data（容錯不同欄位命名）
  try {
    const addr = pickFirst(data.address, data?.location?.address, data?.vendor?.address, data?.restaurant?.address);
    result.address = addr !== undefined ? `"${addr}"` : NaN;
    result.postalCode = data.post_code ? `"${data.post_code}"` : (data?.postal_code ? `"${data.postal_code}"` : NaN);
    result.shopLat = pickFirst(data.latitude, data?.lat, data?.vendor?.latitude, data?.restaurant?.latitude);
    result.shopLng = pickFirst(data.longitude, data?.lng, data?.vendor?.longitude, data?.restaurant?.longitude);
  } catch (e) {
    logger.error(`no location info`);
  }

  // waiting-time
  try {
    result.pickupTime = `"${data.delivery_duration_range}"`;
  } catch (e) {
    logger.error(`${data.uuid} has no waiting-time info`);
  }

  // delivery fee
  try {
    result.deliverFee = `"${data.minimum_delivery_fee}"`;
  } catch (e) {
    logger.error(`${data.uuid} has no delivery-fee info`);
  }

  // rating
  try {
    result.rate = pickFirst(data.rating, data?.rating_score, data?.vendor?.rating);
    result.rateCt = pickFirst(data.rating_count, data?.votes, data?.total_ratings, data?.vendor?.rating_count, NaN);
  } catch (e) {
    logger.error(`no rating fields`);
  }

  // store available?
  try {
    result.storeAvailabilityStatus = pickFirst(data.storeAvailabilityStatus, data?.is_delivery_enabled, data?.availability_status, NaN);
  } catch (e) {
    logger.error(`no store availability field`);
  }

  // categories
  try {
    // encoded as base64
    result.catLst = Buffer.from(JSON.stringify(data.cuisines)).toString(
      "base64",
    );
  } catch (e) {
    logger.error(`${data.uuid} has no categories`);
  }

  // chain
  try {
    result.chain = Buffer.from(JSON.stringify(data.chain)).toString("base64");
  } catch (e) {
    logger.error(`${data.uuid} may not have a chain or something's wrong`);
  }

  // menu
  let menuArr;
  try {
    menuArr = getMenuData(data);
    result.menu = Buffer.from(JSON.stringify(menuArr)).toString("base64");
  } catch (e) {
    logger.error(`failed to extract menu`);
    result.menu = Buffer.from(JSON.stringify([])).toString("base64");
    menuArr = [];
  }

  // popularityLabel
  try {
    const popularityList = Array.isArray(menuArr)
      ? menuArr.map(it => {
          if (!it || !Array.isArray(it.tags)) return "normal";
          // case-insensitive match for the exact "popular" tag
          const isPopular = it.tags.some(t => typeof t === "string" && t.toLowerCase() === "popular");
          return isPopular ? "popular" : "normal";
        })
      : [];
    // logger && logger.info(`popularityList: ${JSON.stringify(popularityList)}`);
    result.popularityLabel = Buffer.from(JSON.stringify(popularityList)).toString("base64");
  } catch (e2) {
    logger && logger.error(`failed to build popularityLabel: ${e2?.message ?? e2}`);
    // even on error, ensure the field exists as an empty list
    try {
      result.popularityLabel = Buffer.from(JSON.stringify([])).toString("base64");
    } catch { /* no-op */ }
  }

  // is_shop_price
  try {
    for (let item of data["food_characteristics"]) {
      logger.info(item);
      if (item["name"].includes("店內價")) result.is_shop_price = true;
    }
  } catch (e) {
    logger.error(`${data.code} has no food_characteristics(shop_price)`);
  }

  return result;
}
