import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const NotFound = () => {
  const navigate = useNavigate();
  const { subdomainValidation, isAuthenticated } = useAuthStore();

  // Check if user should even be on this page
  useEffect(() => {
    // If validation is complete and subdomain exists, redirect away
    if (subdomainValidation.checked && subdomainValidation.exists) {
      if (subdomainValidation.active) {
        // Subdomain exists and is active
        if (isAuthenticated) {
          navigate("/", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      } else {
        // Subdomain exists but is inactive
        navigate("/inactive", { replace: true });
      }
    }
    // If subdomain doesn't exist, stay on 404 (correct state)
  }, [subdomainValidation, isAuthenticated, navigate]);

  return (
    <div className="lg:px-24 lg:py-24 md:py-20 md:px-44 px-4 py-24 items-center flex justify-center flex-col-reverse lg:flex-row md:gap-28 gap-16">
      <div className="xl:pt-24 w-full xl:w-1/2 relative pb-12 lg:pb-0">
        <div className="relative">
          <div className="absolute">
            <div>
              <h1 className="my-2 text-gray-800 font-bold text-2xl">
                Looks like you've found the doorway to the great nothing
              </h1>
              <p className="my-2 text-gray-800">
                Sorry about that! Please visit our hompage to get where you need
                to go.
              </p>
              <button
                onClick={() => {
                  window.location.replace("/");
                  // navigate(0);
                }}
                className="sm:w-full lg:w-auto my-2 border rounded md py-4 px-8 text-center bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-opacity-50 cursor-pointer"
              >
                Take me there!
              </button>
            </div>
          </div>
          <div>
            <img src="https://i.ibb.co/G9DC8S0/404-2.png" />
          </div>
        </div>
      </div>
      <div>
        <img src="https://i.ibb.co/ck1SGFJ/Group.png" />
      </div>
    </div>
  );
};

export default NotFound;
