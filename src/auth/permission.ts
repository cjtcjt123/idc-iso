import type { AuthUser } from "../api/types";
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

/** 是否为管理组（超管 / 管理组角色 / 拥有 user:delete 权限）。对齐小程序 isAdmin。 */
export function isAdmin(user?: AuthUser | null): boolean {
  if (!user) return false;
  if (user.isSuperuser) return true;
  if (user.roleName === "管理组" || user.roleId === "role-admin") return true;
  return (user.permissions || []).includes("user:delete");
}

/** 客户组成员强制作用域：返回其 customerId，否则 null（对齐小程序 forcedCustomerId）。 */
export function customerScopeId(user?: AuthUser | null): string | null {
  if (user && user.userGroup === "customer" && user.customerId) return user.customerId;
  return null;
}
