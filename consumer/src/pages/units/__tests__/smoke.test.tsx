import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "units",
  page: <Page />,
  path: endpoints.getUnits,
  createPath: endpoints.createUnit,
  entity: "Unit",
  nameLabel: "Unit Name",
});
