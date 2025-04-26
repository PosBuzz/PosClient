import { Helmet } from "@dr.pogodin/react-helmet";

export const setPageTitle = (title: string) => {
  return <Helmet title={title} />;
};
