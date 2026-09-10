import { useAuthSession } from "@/hooks/use-auth-session";

import ContactsScreen from "../screens/ContactsScreen/ContactsScreen";

const ChatTab = () => {
  const { user } = useAuthSession();
  if (!user) return null;
  return <ContactsScreen user={user} />;
};

export default ChatTab;
