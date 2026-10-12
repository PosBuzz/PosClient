import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "daily-target",
  page: <Page />,
  path: endpoints.getDailyTargetReport,
  contract: "daily-target",
  rowsKey: "rows",
  rowLabel: (r) => r.product_name,
  dependencies: {},
});
