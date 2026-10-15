import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "brands",
  page: <Page />,
  path: endpoints.getBrands,
  createPath: endpoints.createBrand,
  entity: "Brand",
  nameLabel: "Brand Name",
});
