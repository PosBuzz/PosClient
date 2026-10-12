import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "purchase-payments",
  page: <Page />,
  path: endpoints.getPurchasePaymentBatches,
  contract: "purchase-payment-batches",
  rowsKey: "data",
  rowLabel: (r) => r.batch_number,
  dependencies: {},
});
