import { Button } from "antd";
import { BiPlus } from "react-icons/bi";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";

function index() {
  return (
    <>
      {setPageTitle("PosBuzz | Home")}
      <PageTitle
        title={"Home"}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Home",
          },
        ]}
        rightSection={
          <Button type="primary" icon={<BiPlus />}>
            Add New
          </Button>
        }
      />
      <h1 className="text-4xl">Welcome to PosBuzz</h1>
    </>
  );
}

export default index;
