import React, { useState, useEffect } from "react";
import {
  FiPlusCircle,
  FiClock,
  FiSettings,
  FiLogOut,
  FiSearch,
  FiMoreVertical,
  FiTrash2,
  FiShare2,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import {
  createChat,
  getChat,
  deleteChat,
} from "../../../services/axios.service";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { logout } from "../../slice/authSlice";

export default function SideBar() {
  const { id, token } = useSelector((state) => state.auth);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(null);

  const dispatch = useDispatch();

  const handleCreateChat = async () => {
    try {
      const response = await createChat("api/chat/create", token, id);
      const conversationId = response.data.conversation._id;
      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.log(error);
    }
  };

  const getChats = async () => {
    try {
      const response = await getChat("api/chat/getChats", token, id);
      setChats(response.conversation);
      console.log(response.conversation);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDelete = async (chatId) => {
    try {
      const response = await deleteChat("api/chat/delete", chatId, token);
      console.log(response);
      navigate("/chat");
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getChats();
  }, []);

  // Filter chats by search
  const filteredChats = chats.filter((conv) =>
    conv.title.toLowerCase().includes(search.toLowerCase())
  );

  // Get active chat id from URL
  const activeChatId = location.pathname.startsWith("/chat/")
    ? location.pathname.split("/chat/")[1]
    : null;

  // Helper for avatar (initials)
  const getInitials = (title) =>
    title
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  //handle logout
  const handleLogout = (e) => {
    e.preventDefault();
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="h-full flex flex-col ">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-500">
        <h2 className="text-xl font-bold text-orange-600">
          <Link to={"/"}>Aina</Link>
        </h2>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center space-x-2 transition-colors duration-500">
        <FiSearch className="text-gray-400 text-lg" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="flex-1 bg-transparent outline-none text-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded transition-colors duration-500 px-2 py-1"
        />
      </div>

      {/* Navigation - Scrollable Area */}
      <nav className="flex-1 flex flex-col py-4 overflow-y-auto min-h-0">
        <button
          className="flex items-center space-x-4 px-7 py-4 text-base text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition border-2 rounded-xl mx-5 text-center"
          onClick={handleCreateChat}
        >
          <FiPlusCircle className="text-lg" />
          <span>Create New Chat</span>
        </button>

        <span className="mx-6 my-4 font-semibold text-xs text-gray-500 tracking-wider uppercase">
          Chats
        </span>
        {filteredChats.length === 0 && (
          <div className="mx-6 my-6 text-gray-400 text-sm">No chats found.</div>
        )}
        {filteredChats.map((conv) => (
          <div key={conv._id} className="relative group">
            <button
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition text-left mb-1
                ${
                  conv._id === activeChatId
                    ? "bg-orange-100 border border-orange-300 text-orange-700 shadow"
                    : "hover:bg-orange-50 hover:text-orange-600"
                }`}
              onClick={() => navigate(`/chat/${conv._id}`)}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center font-bold text-orange-700 text-base">
                {getInitials(conv.title)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-xs text-gray-500 truncate">
                  {conv.messages && conv.messages.length > 0 ? (
                    conv.messages[conv.messages.length - 1].content
                  ) : (
                    <span className="italic text-gray-300">
                      No messages yet
                    </span>
                  )}
                </div>
              </div>
              {/* Three dots button */}
              <a
                type="button"
                className="ml-2 p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === conv._id ? null : conv._id);
                }}
              >
                <FiMoreVertical />
              </a>
            </button>
            {/* Dropdown menu */}
            {menuOpen === conv._id && (
              <div className="absolute right-4 top-12 bg-white border rounded shadow z-10">
                <button
                  className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  onClick={() => handleDelete(conv._id)}
                >
                  <FiTrash2 className="mr-2" /> Delete
                </button>
                <button
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                  onClick={() => {
                    setMenuOpen(null);
                    alert("Share feature coming soon!");
                  }}
                >
                  <FiShare2 className="mr-2" /> Share
                </button>
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="flex-shrink-0 border-t p-4 bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-500">
        <a
          href="#settings"
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition w-full px-2 py-2"
        >
          <FiSettings className="text-lg" />
          <span>Settings</span>
        </a>
        <button
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition w-full px-2"
          onClick={handleLogout}
        >
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
