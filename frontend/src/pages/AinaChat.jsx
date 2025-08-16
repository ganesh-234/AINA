import SideBar from "../components/Chat/SideBar";
import TopBar from "../components/Chat/TopBar";
import MainChat from "../components/Chat/MainChat";
import { useSelector } from "react-redux";
import { createChat } from "../../services/axios.service";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const AinaChat = () => {
  const { token, id } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const handleCreateChat = async () => {
    try {
      const response = await createChat("api/chat/create", token, id);
      console.log(response);
      const conversationId = response.data.conversation._id;
      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      {/* Main Content Area */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-20 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 transform
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:relative md:translate-x-0 md:w-1/4 md:block
          `}
        >
          <SideBar />
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <main className="w-full md:w-3/4 bg-gray-50 dark:bg-gray-900 flex flex-col h-full transition-colors duration-500">
          <div className="h-full flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-100 mb-4">
              Start a New Conversation
            </h2>
            <p className="text-gray-500 dark:text-gray-300 mb-6">
              Select an existing chat from the sidebar or create a new one.
            </p>
            <button
              onClick={handleCreateChat}
              className="bg-orange-600 text-white px-5 py-3 rounded-full hover:bg-orange-700 transition"
            >
              Create New Chat
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AinaChat;
