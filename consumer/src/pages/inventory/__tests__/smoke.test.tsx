import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "inventory",
  page: <Page />,
  path: endpoints.inventoryBatches,
  contract: "inventory-batches",
  rowsKey: "data",
  rowLabel: (r) => r.batch_number,
  dependencies: {
    [endpoints.getBranches]: responseContract("branches"),
    [endpoints.getCategories]: [],
    [endpoints.inventorySummary]: responseContract("inventory-summary"),
  },
});
