"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { DEMO_USERS, type DemoUser } from "@/lib/demo-user";

interface DemoUserContextValue {
  currentUser: DemoUser;
  setCurrentUser: (user: DemoUser) => void;
  users: DemoUser[];
}

const DemoUserContext = createContext<DemoUserContextValue>({
  currentUser: DEMO_USERS[0],
  setCurrentUser: () => {},
  users: DEMO_USERS,
});

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<DemoUser>(DEMO_USERS[0]);

  useEffect(() => {
    const stored = localStorage.getItem("hivemind-user-id");
    if (stored) {
      const found = DEMO_USERS.find((u) => u.id === stored);
      if (found) setCurrentUserState(found);
    }
  }, []);

  function setCurrentUser(user: DemoUser) {
    setCurrentUserState(user);
    localStorage.setItem("hivemind-user-id", user.id);
  }

  return (
    <DemoUserContext.Provider value={{ currentUser, setCurrentUser, users: DEMO_USERS }}>
      {children}
    </DemoUserContext.Provider>
  );
}

export function useDemoUser() {
  return useContext(DemoUserContext);
}
