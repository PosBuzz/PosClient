import { responseContract } from "../../../test/contracts/load";
import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "inventory-adjustments",
  page: <Page />,
  path: endpoints.inventoryAdjustments,
  contract: "inventory-adjustments",
  rowsKey: "data",
  rowLabel: (r) => r.reason,
  dependencies: { [endpoints.getBranches]: responseContract("branches") },
});
