import { Route, Routes } from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AinaChat from "./pages/AinaChat";
import ConversationPage from "./pages/ConversationPage";
import About from "./pages/About";
import Feature from "./pages/Feature";
import Contact from "./pages/Contact";
import OAuthSuccess from "./components/OAuthSuccess";
import SecureRoutes from "./routes/SecureRoutes";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Feature />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* secure routing */}
        <Route element={<SecureRoutes />}>
          <Route path="/chat" element={<AinaChat />} />
          <Route path="/chat/:conversationId" element={<ConversationPage />} />
        </Route>
        <Route path="/oauth-success" element={<OAuthSuccess />} />
      </Routes>
    </>
  );
}

export default App;
