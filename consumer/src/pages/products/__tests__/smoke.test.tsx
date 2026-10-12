import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
listPageSmoke({
  id: "products",
  page: <Page />,
  path: endpoints.products,
  contract: "products-list",
  rowsKey: "data",
  rowLabel: (r) => r.name,
  dependencies: {
    [endpoints.getCategories]: [],
    [endpoints.getBrands]: [],
    [endpoints.getTags]: [],
    [endpoints.productLimit]: { max_products: null, current_count: 3 },
  },
});
