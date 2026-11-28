// Bills deleted this month still count towards the plan's monthly limit, so
// deleting cannot be used to make unlimited bills.
const { istDate } = require("./common");

const thisMonth = () => istDate(Date.now()).slice(0, 7);

const deletedThisMonth = (user) =>
  user?.invoiceDeletions?.month === thisMonth() ? user.invoiceDeletions.count : 0;

module.exports = { thisMonth, deletedThisMonth };
