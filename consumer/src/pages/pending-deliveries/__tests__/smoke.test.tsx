import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "pending-deliveries",
  page: <Page />,
  path: `${endpoints.getSales}/pending-deliveries/list`,
  contract: "pending-deliveries",
  rowsKey: "data",
  rowLabel: (r) => r.sale_number,
  dependencies: {},
});
