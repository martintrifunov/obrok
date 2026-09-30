import { fetchPublic } from "@/api/fetch";
import { queryClient } from "@/api/queryClient";
import { useAuthStore } from "@/store/authStore";

const useLogout = () => {
  const logoutAction = useAuthStore((state) => state.logout);

  const logout = async () => {
    logoutAction();
    // Drop cached admin data so the next account on this tab can't see it.
    queryClient.clear();
    try {
      await fetchPublic("/logout");
    } catch (err) {
      console.error(err);
    }
  };

  return logout;
};

export default useLogout;
