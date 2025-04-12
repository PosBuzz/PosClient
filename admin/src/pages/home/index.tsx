import { useQuery } from "@tanstack/react-query";
import { get } from "../../api/crud-api";
import { getUrlForModel } from "../../api/endpoints";
import PageTitle from "../../components/Pagetitle";
import { Button } from "antd";
import { TiPlusOutline } from "react-icons/ti";
import { BiPlus } from "react-icons/bi";

function index() {
  // const { logout } = useAuth();
  // const navigate = useNavigate();

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => get(getUrlForModel("Plan")),
    staleTime: 0,
  });

  console.log(plans);

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
