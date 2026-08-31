import axios from "axios";
export const registerUser = async (uri, data) => {
    const response = await axios.post(
      `${import.meta.env.VITE_SERVER_URL}/${uri}`,
      data
    );
    return response.data;
};
export const loginUser = async (uri, data) => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_SERVER_URL}/${uri}`,
      data
    );
    return response.data;
  } catch (error) {
    console.log(error.response);
    throw error.response;
  }
};
export const createChat = async (uri, token, userId) => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_SERVER_URL}/${uri}`,
      { userId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
  } catch (error) {
    console.log(error.response);
    throw error;
  }
};
export const getChat = async (uri, token, userId) => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_SERVER_URL}/${uri}/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log(response);
    return response.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
export const getSingleChat = async (uri, token, id) => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_SERVER_URL}/${uri}/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
export const handleResponse = async (uri, token, data, signal) => {
  const response = await axios.post(
    `${import.meta.env.VITE_SERVER_URL}/${uri}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    }
  );
  return response;
};
export const editTitle = async (uri, id, token, title) => {
    const response = await axios.put(
      `${import.meta.env.VITE_SERVER_URL}/${uri}/${id}`,
      { title },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
};
export const deleteChat = async (uri, id, token) => {
    const response = await axios.delete(
      `${import.meta.env.VITE_SERVER_URL}/${uri}/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response;
};
// export const GoogleOAuth = async (uri) => {
//   try {
//     const response = await axios.get(
//       `${import.meta.env.VITE_SERVER_URL}/${uri}`
//     );
//     console.log(response);
//     return response;
//   } catch (error) {
//     throw error;
//   }
// };
