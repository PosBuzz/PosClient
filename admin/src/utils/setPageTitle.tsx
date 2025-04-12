import { Helmet } from "react-helmet-async"


export const setPageTitle = (title: string) => {
  return (
      <Helmet>
          <title>{title}</title> {/*TODO postfix app name*/}
      </Helmet>
  )
}
