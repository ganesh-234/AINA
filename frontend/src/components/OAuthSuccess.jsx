import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import { login } from "../slice/authSlice";

const OAuthSuccess = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      axios
        .get("http://localhost:3000/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((res) => {
          console.log(res);
          let data = {
            name: res.data.name,
            email: res.data.name,
            token: token,
            id: res.data._id,
            image: res.data.image,
            createdAt: res.data.createdAt,
          };
          console.log(data);
          dispatch(login(data));
          navigate("/chat");
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, []);

  return <p>Logging in...</p>;
};

export default OAuthSuccess;
