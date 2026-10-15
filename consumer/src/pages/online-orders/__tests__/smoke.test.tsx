import { responseContract } from "../../../test/contracts/load";
import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "online-orders",
  page: <Page />,
  path: `${endpoints.getSales}/online-orders/list`,
  contract: "online-orders-list",
  rowsKey: "data",
  rowLabel: (r) => r.sale_number,
  dependencies: {
    [endpoints.getVendors]: [],
    [`${endpoints.getSales}/online-orders/stats`]: responseContract(
      "online-orders-stats",
    ),
  },
});
