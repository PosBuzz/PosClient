import { Button } from "antd";
import { BiPlus } from "react-icons/bi";
import PageTitle from "../../components/PageTitle";

function index() {

  return (
    <>
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
      <h1 className="text-4xl">This is Admin</h1>
    </>
  );
}

export default index;
