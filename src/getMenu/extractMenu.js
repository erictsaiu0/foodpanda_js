/**
 * Generates a menu object from the given data.
 *
 * @param {object} data - The data to extract the menu from.
 * @return {object[]} - The generated menu array.
 */
export default function getMenuData(data) {
  const out = [];
  // 柔性抓取 menus 結構（不同回傳版本可能在 data/vendor/restaurant 下）
  const menus =
    data?.menus ??
    data?.menu ??
    data?.vendor?.menus ??
    data?.restaurant?.menus ??
    [];
  if (!Array.isArray(menus) || menus.length === 0) {
    return out;
  }
  const firstMenu = menus[0];
  const categories = firstMenu?.menu_categories ?? firstMenu?.categories ?? [];
  for (const category of categories) {
    const products = category?.products ?? [];
    for (const product of products) {
      const productId = product?.id ?? NaN;
      const productCode = product?.code ?? NaN;
      const productName = product?.name ?? NaN;
      const productDesc = product?.description ?? NaN;
      const variations = product?.product_variations ?? product?.variations ?? [ { price: product?.price, price_before_discount: product?.price_before_discount, code: product?.code, name: undefined } ];
      const tags = product?.tags ?? [];

      for (const variation of variations) {
        out.push({
          id: productId,
          productCode: productCode,
          variationCode: variation?.code ?? NaN,
          product: `${productName}` + (variation?.name ? `-${variation.name}` : ""),
          description: productDesc,
          preDiscountPrice: variation?.price_before_discount ?? NaN,
          price: variation?.price ?? NaN,
          isSoldOut: product?.is_sold_out ?? false,
          tags: tags,
        });
      }
    }
  }
  return out;
}
