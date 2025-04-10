import { useQuery } from "@tanstack/react-query";
import { getUrlForModel } from "../../api/endpoints";
import { get } from "../../api/crud-api";

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
      <h1 className="text-4xl">This is Admin</h1>
    </>
  );
}

export default index;
