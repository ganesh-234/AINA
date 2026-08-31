import { useContext } from "react";
import { ThemeContext } from "./ThemeContextValue";

export const useTheme = () => useContext(ThemeContext);
