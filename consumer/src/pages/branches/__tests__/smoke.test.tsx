import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "branches",
  page: <Page />,
  path: endpoints.getBranches,
  createPath: endpoints.createBranch,
  entity: "Branch",
  nameLabel: "Branch Name",
  fields: { "VAT Registration Number": "VAT-C4-31" },
});
