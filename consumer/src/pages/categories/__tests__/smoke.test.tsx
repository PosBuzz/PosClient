import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "categories",
  page: <Page />,
  path: endpoints.getCategories,
  createPath: endpoints.createCategory,
  entity: "Category",
  nameLabel: "Category Name",
});
