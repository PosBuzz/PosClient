import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "inventory-stock-by-variant",
  page: <Page />,
  path: endpoints.inventoryStockByVariant,
  contract: "inventory-stock-by-variant",
  rowsKey: "data",
  rowLabel: (r) => r.product.name,
  dependencies: { [endpoints.getBranches]: responseContract("branches") },
});
