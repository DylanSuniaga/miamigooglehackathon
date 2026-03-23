"use client";

import { Check } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";

export function PeopleView() {
  const { currentUser, setCurrentUser, users } = useDemoUser();

  return (
    <div className="flex flex-1 flex-col bg-[var(--hm-bg)]">
      <div className="border-b border-[var(--hm-border)] px-6 py-4">
        <h1 className="text-xl font-bold text-[var(--hm-text)]">People</h1>
        <p className="text-sm text-[var(--hm-muted)] mt-1">
          Select who you want to chat as
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-3 max-w-md">
          {users.map((user) => {
            const isActive = currentUser.id === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setCurrentUser(user)}
                className={`flex items-center gap-4 rounded-xl px-5 py-4 text-left transition-all border-2 ${
                  isActive
                    ? "border-[var(--hm-accent)] bg-[var(--hm-surface)] shadow-sm"
                    : "border-transparent bg-[var(--hm-surface)] hover:border-[var(--hm-border)] hover:shadow-sm"
                }`}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
                  style={{ backgroundColor: user.color + "20" }}
                >
                  {user.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--hm-text)] text-[15px]">
                    {user.display_name}
                  </div>
                  <div className="text-sm text-[var(--hm-muted)]">
                    @{user.username}
                  </div>
                </div>
                {isActive && (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
