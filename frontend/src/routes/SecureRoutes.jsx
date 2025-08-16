import { useSelector } from "react-redux";
import { Outlet, Navigate } from "react-router-dom";

const SecureRoutes = () => {
  const { isLoggedIn } = useSelector((state) => state.auth);
  return (
    <>
      {isLoggedIn ? (
        <Outlet />
      ) : (
        <>
          <Navigate to={"/login"} replace />
        </>
      )}{" "}
    </>
  );
};

export default SecureRoutes;
