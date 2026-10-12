import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "quotations",
  page: <Page />,
  path: endpoints.getQuotations,
  contract: "quotations-list",
  rowsKey: "data",
  rowLabel: (r) => r.sale_number,
  dependencies: {},
});
