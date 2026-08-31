import { toast } from "react-toastify";

const toastConfig = {
  position: "top-center",
  autoClose: "4000",
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "colored",
};
export const successToast = (message) => {
  toast.success(message, toastConfig);
};
export const errorToast = (message) => {
  toast.error(message, toastConfig);
};
export const infoToast = (message) => {
  toast.info(message, toastConfig);
};
