import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "vendors",
  page: <Page />,
  path: endpoints.getVendors,
  createPath: endpoints.createVendor,
  entity: "Vendor",
  nameLabel: "Vendor Name",
});
