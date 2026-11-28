// What one unit costs to buy, without GST
const costOf = (item) => {
  const price = item.purchasePrice || 0;
  return item.purchaseTaxMode === "inclusive" ? price / (1 + (item.gstPercent || 0) / 100) : price;
};

module.exports = { costOf };
