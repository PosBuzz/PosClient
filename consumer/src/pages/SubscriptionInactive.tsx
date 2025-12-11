import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const SubscriptionInactive = () => {
  const navigate = useNavigate();
  const { validateSubdomain, isAuthenticated, subdomainValidation } = useAuthStore();
  const [isRetrying, setIsRetrying] = useState(false);

  // Check if user should even be on this page
  useEffect(() => {
    // If validation is complete and shows active, redirect away
    if (subdomainValidation.checked) {
      if (!subdomainValidation.exists) {
        // Subdomain doesn't exist, go to 404
        navigate("/404", { replace: true });
      } else if (subdomainValidation.active) {
        // Subdomain is active, shouldn't be on inactive page
        if (isAuthenticated) {
          navigate("/", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      }
      // If exists but not active, stay on this page (correct state)
    }
  }, [subdomainValidation, isAuthenticated, navigate]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Revalidate subdomain
      await validateSubdomain();
      
      // Get the latest validation state
      const validation = useAuthStore.getState().subdomainValidation;
      
      if (validation.exists && validation.active) {
        // Subscription is now active
        if (isAuthenticated) {
          // User is logged in, navigate to home/dashboard
          navigate("/", { replace: true });
        } else {
          // User not logged in, navigate to login
          navigate("/login", { replace: true });
        }
      } else if (validation.exists && !validation.active) {
        // Still inactive, just reload the page to show fresh data
        window.location.reload();
      } else {
        // Subdomain doesn't exist, navigate to 404
        navigate("/404", { replace: true });
      }
    } catch (error) {
      console.error("Retry failed:", error);
      // Show error or just reload
      window.location.reload();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="lg:px-24 lg:py-24 md:py-20 md:px-44 px-4 py-24 items-center flex justify-center flex-col-reverse lg:flex-row md:gap-28 gap-16">
      <div className="xl:pt-24 w-full xl:w-1/2 relative pb-12 lg:pb-0">
        <div className="relative">
          <div className="absolute">
            <div>
              <h1 className="my-2 text-gray-800 font-bold text-2xl">
                Subscription Inactive
              </h1>
              <p className="my-2 text-gray-800">
                Your subscription is currently inactive. Please contact support or renew your subscription to continue using our services.
              </p>
              <p className="my-2 text-gray-600 text-sm">
                If you believe this is an error, please reach out to our support team.
              </p>
              <div className="flex gap-4">
                <Link
                  to="mailto:support@posbuzz.com"
                  className="!my-2 !border !rounded !py-4 !px-8 !text-center !bg-indigo-600 !text-white !hover:bg-indigo-700 focus:!outline-none focus:!ring-2 focus:!ring-indigo-700 focus:!ring-opacity-50 !cursor-pointer"
                >
                  Contact Support
                </Link>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="my-2 border border-gray-300 rounded py-4 px-8 text-center bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying ? "Checking..." : "Retry"}
                </button>
              </div>
            </div>
          </div>
          <div>
            <img src="https://i.ibb.co/G9DC8S0/404-2.png" alt="Inactive subscription" />
          </div>
        </div>
      </div>
      <div>
        <img src="https://i.ibb.co/ck1SGFJ/Group.png" alt="Illustration" />
      </div>
    </div>
  );
};

export default SubscriptionInactive;
