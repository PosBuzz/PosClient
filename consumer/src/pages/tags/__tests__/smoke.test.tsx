import { endpoints } from "../../../api/endpoints";
import { crudPageSmoke } from "../../../test/crud-page-smoke";
import Page from "../index";

crudPageSmoke({
  id: "tags",
  page: <Page />,
  path: endpoints.getTags,
  createPath: endpoints.createTag,
  entity: "Tag",
  nameLabel: "Tag Name",
});
