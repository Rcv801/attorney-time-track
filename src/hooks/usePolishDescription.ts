import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function usePolishDescription() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (description: string) => {
      if (!user) throw new Error("Not authenticated");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) throw new Error("No access token available");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/polish-description`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to polish description");
      }

      const data = await response.json();
      return data.polished;
    },
  });
}
