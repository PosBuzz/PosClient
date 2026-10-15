import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "customers",
  page: <Page />,
  path: endpoints.getCustomers,
  createPath: endpoints.createCustomer,
  entity: "Customer",
  nameLabel: "Customer Name",
  paginated: true,
});
