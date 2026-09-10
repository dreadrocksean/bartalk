import ContactsScreen from "../screens/ContactsScreen/ContactsScreen";
import { useAuthSession } from "@/hooks/use-auth-session";

const ChatTab = () => {
  const { user } = useAuthSession();
  if (!user) return null;
  return <ContactsScreen user={user} />;
};

export default ChatTab;
