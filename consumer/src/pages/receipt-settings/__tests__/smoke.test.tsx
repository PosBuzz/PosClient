import { responseContract } from "../../../test/contracts/load";
import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "receipt-settings",
  page: <Page />,
  path: endpoints.receiptSettingsByType("receipt"),
  contract: "receipt-settings-list",
  rowLabel: (r) => r.name,
  dependencies: { [endpoints.getBranches]: responseContract("branches") },
});
