import { useAuth } from "./AuthContext";

/** 对齐小程序 utils/permission.ts 的 can(resource, action)。后端以「resource:action」码做 RBAC 硬校验兜底。 */
export function useCan() {
  const { user } = useAuth();
  return (resource: string, action: string): boolean => {
    if (user?.isSuperuser) return true;
    const perms = user?.permissions || [];
    return perms.includes(`${resource}:${action}`) || perms.includes(`${resource}:*`);
  };
}
