import { createSlice } from "@reduxjs/toolkit";

let initialState = {
  isLoggedIn: true,
  name: "",
  email: "",
  image: "",
  token: "",
  createdAt: "",
  role: "user",
  id: "",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      console.log(action.payload);
      state.isLoggedIn = true;
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.image = action.payload.image;
      state.token = action.payload.token;
      state.createdAt = action.payload.createdAt;
      state.role = action.payload.role;
      state.id = action.payload.id;
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.name = "";
      state.email = "";
      state.image = "";
      state.token = "";
      state.createdAt = "";
      state.role = "";
      state.id = "";
    },
  },
});
export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
