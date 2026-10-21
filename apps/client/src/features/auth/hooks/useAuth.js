import { useAuthStore } from "@/store/authStore";
import { roleFromToken } from "@/features/auth/utils/roleFromToken";

const useAuth = () => {
  const auth = useAuthStore((state) => state.auth);
  const setAuth = useAuthStore((state) => state.setAuth);
  const persist = useAuthStore((state) => state.persist);
  const setPersist = useAuthStore((state) => state.setPersist);

  const isAdmin = roleFromToken(auth?.accessToken) === "admin";

  return { auth, setAuth, persist, setPersist, isAdmin };
};

export default useAuth;
